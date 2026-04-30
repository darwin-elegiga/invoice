"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type InvoiceRecord = {
  id: string
  invoiceNumber: string
  date: string
  year: number
  month: number
  total: string
  clientName: string
  notes: string
  fileName: string
  uploadedAt: string
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

const ALL = "all"

export default function HistorialPage() {
  const [records, setRecords] = useState<InvoiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState<string>(ALL)
  const [monthFilter, setMonthFilter] = useState<string>(ALL)

  const [file, setFile] = useState<File | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [date, setDate] = useState("")
  const [total, setTotal] = useState("")
  const [clientName, setClientName] = useState("")
  const [notes, setNotes] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const loadRecords = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/invoices")
      if (res.ok) setRecords(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecords()
  }, [])

  const years = useMemo(() => {
    const set = new Set(records.map((r) => r.year))
    return Array.from(set).sort((a, b) => b - a)
  }, [records])

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (yearFilter !== ALL && String(r.year) !== yearFilter) return false
      if (monthFilter !== ALL && String(r.month) !== monthFilter) return false
      return true
    })
  }, [records, yearFilter, monthFilter])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploadError(null)
    if (!file) {
      setUploadError("Selecciona un PDF")
      return
    }
    if (!invoiceNumber || !date) {
      setUploadError("Número de factura y fecha son obligatorios")
      return
    }
    const fd = new FormData()
    fd.append("file", file)
    fd.append("invoiceNumber", invoiceNumber)
    fd.append("date", date)
    fd.append("total", total)
    fd.append("clientName", clientName)
    fd.append("notes", notes)
    setUploading(true)
    try {
      const res = await fetch("/api/invoices", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error al subir")
      }
      setFile(null)
      setInvoiceNumber("")
      setDate("")
      setTotal("")
      setClientName("")
      setNotes("")
      const fileInput = document.getElementById("upload-file") as HTMLInputElement | null
      if (fileInput) fileInput.value = ""
      await loadRecords()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error al subir")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta factura del historial?")) return
    const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" })
    if (res.ok) await loadRecords()
  }

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const res = await fetch("/api/invoices/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error al importar")
      }
      const result = await res.json()
      alert(
        `Importación: ${result.added} añadidas, ${result.updated} actualizadas, ${result.skipped} ignoradas. Total: ${result.total}.`,
      )
      await loadRecords()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al importar JSON")
    }
  }

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(records, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `invoices-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Historial de Facturas</h1>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← Volver al generador
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 p-4 border rounded bg-gray-50">
          <h2 className="font-semibold mb-3">Subir factura</h2>
          <form onSubmit={handleUpload} className="space-y-3">
            <div>
              <Label htmlFor="upload-file">PDF</Label>
              <Input
                id="upload-file"
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <Label htmlFor="upload-number">Número de factura</Label>
              <Input
                id="upload-number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="upload-date">Fecha</Label>
              <Input
                id="upload-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="upload-total">Total (EUR)</Label>
              <Input
                id="upload-total"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="upload-client">Cliente</Label>
              <Input
                id="upload-client"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="upload-notes">Notas</Label>
              <Input
                id="upload-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {uploadError && (
              <p className="text-sm text-red-600">{uploadError}</p>
            )}
            <Button type="submit" disabled={uploading} className="w-full">
              {uploading ? "Subiendo…" : "Subir"}
            </Button>
          </form>
        </div>

        <div className="md:col-span-2">
          <div className="flex flex-wrap gap-3 mb-4 items-end">
            <div className="w-40">
              <Label>Año</Label>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-44">
              <Label>Mes</Label>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {MONTHS.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-gray-500">
              {loading ? "Cargando…" : `${filtered.length} de ${records.length}`}
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadJson}
                disabled={records.length === 0}
              >
                Descargar JSON
              </Button>
              <label>
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleImportJson}
                />
                <span className="inline-flex items-center justify-center h-10 px-4 py-2 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer">
                  Importar JSON
                </span>
              </label>
            </div>
          </div>

          <div className="border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-6">
                      Sin facturas
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>{r.invoiceNumber}</TableCell>
                    <TableCell>{r.clientName || "—"}</TableCell>
                    <TableCell className="text-right">
                      {r.total ? `${r.total} EUR` : "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <a
                        href={`/api/invoices/${r.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Ver PDF
                      </a>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-red-600 hover:underline text-sm"
                      >
                        Eliminar
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}
