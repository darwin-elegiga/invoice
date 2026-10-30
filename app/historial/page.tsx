"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AppHeader } from "@/app/components/AppHeader"
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronRight } from "lucide-react"
import { formatEsNumberString } from "../utils/number-utils"

type InvoiceRecord = {
  id: string
  invoiceNumber: string
  date: string
  year: number
  month: number
  total: string
  clientName: string
  notes: string
  paymentMethod: string
  fileType: "pdf" | "xlsx"
  fileName: string
  uploadedAt: string
  items: { project: string; client: string }[]
}

type CatalogEntry = {
  id: number
  project: string
  client: string
  timesUsed: number
}

const FILE_LABELS: Record<InvoiceRecord["fileType"], string> = {
  pdf: "Ver PDF",
  xlsx: "Ver XLS",
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
  const [clientFilter, setClientFilter] = useState<string>(ALL)
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])

  const [file, setFile] = useState<File | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [date, setDate] = useState("")
  const [total, setTotal] = useState("")
  const [notes, setNotes] = useState("")
  const [project, setProject] = useState("")
  const [projectClient, setProjectClient] = useState("")
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

  const loadCatalog = async () => {
    const res = await fetch("/api/catalog")
    if (res.ok) setCatalog(await res.json())
  }

  useEffect(() => {
    loadRecords()
    loadCatalog()
  }, [])

  const years = useMemo(() => {
    const set = new Set(records.map((r) => r.year))
    return Array.from(set).sort((a, b) => b - a)
  }, [records])

  const clients = useMemo(() => {
    const set = new Set(records.flatMap((r) => r.items.map((i) => i.client)).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"))
  }, [records])

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (yearFilter !== ALL && String(r.year) !== yearFilter) return false
      if (monthFilter !== ALL && String(r.month) !== monthFilter) return false
      if (clientFilter !== ALL && !r.items.some((i) => i.client === clientFilter)) return false
      return true
    })
  }, [records, yearFilter, monthFilter, clientFilter])

  const handleDeleteCatalogEntry = async (entry: CatalogEntry) => {
    if (!confirm(`¿Dejar de sugerir «${entry.project} · ${entry.client}»?`)) return
    const res = await fetch(`/api/catalog?id=${entry.id}`, { method: "DELETE" })
    if (res.ok) setCatalog(await res.json())
  }

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
    fd.append("notes", notes)
    fd.append("items", JSON.stringify([{ project, client: projectClient }]))
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
      setNotes("")
      setProject("")
      setProjectClient("")
      const fileInput = document.getElementById("upload-file") as HTMLInputElement | null
      if (fileInput) fileInput.value = ""
      await Promise.all([loadRecords(), loadCatalog()])
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
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <AppHeader title="Historial" />

      <div className="space-y-8">
        {/* Rarely used (invoices made outside the app), so it stays folded */}
        <Collapsible className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <CollapsibleTrigger className="group flex w-full items-center gap-2 px-5 py-3 text-left text-sm">
            <ChevronRight className="h-4 w-4 text-zinc-400 transition-transform group-data-[state=open]:rotate-90" />
            <span className="font-medium">Subir factura</span>
            <span className="text-zinc-400">· hecha fuera de la app</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-5 pb-5">
          <form onSubmit={handleUpload} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              <Label htmlFor="upload-project">Proyecto</Label>
              <Input
                id="upload-project"
                list="historial-projects"
                autoComplete="off"
                value={project}
                onChange={(e) => {
                  setProject(e.target.value)
                  const match = catalog.find((c) => c.project === e.target.value)
                  if (match && !projectClient) setProjectClient(match.client)
                }}
              />
            </div>
            <div>
              <Label htmlFor="upload-project-client">Cliente del proyecto</Label>
              <Input
                id="upload-project-client"
                list="historial-clients"
                autoComplete="off"
                value={projectClient}
                onChange={(e) => setProjectClient(e.target.value)}
              />
            </div>
            <datalist id="historial-projects">
              {Array.from(new Set(catalog.map((c) => c.project))).map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <datalist id="historial-clients">
              {Array.from(new Set(catalog.map((c) => c.client))).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <div>
              <Label htmlFor="upload-notes">Notas</Label>
              <Input
                id="upload-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {uploadError && (
              <p className="text-sm text-red-600 sm:col-span-full">{uploadError}</p>
            )}
            <Button type="submit" disabled={uploading} className="sm:col-span-full sm:w-fit sm:justify-self-end">
              {uploading ? "Subiendo…" : "Subir"}
            </Button>
          </form>
          </CollapsibleContent>
        </Collapsible>

        <div>
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
            <div className="w-52">
              <Label>Cliente</Label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-zinc-500">
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
                <span className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50">
                  Importar JSON
                </span>
              </label>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Nº</TableHead>
                  <TableHead>Proyectos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-zinc-500 py-6">
                      Sin facturas
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>{r.invoiceNumber}</TableCell>
                    <TableCell>
                      {r.items.length > 0
                        ? r.items.map((i, idx) => (
                            <div key={idx}>
                              {i.project || "—"}
                              {i.client && <span className="text-zinc-500"> · {i.client}</span>}
                            </div>
                          ))
                        : r.notes || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.total ? `${formatEsNumberString(r.total)} EUR` : "—"}
                      {r.paymentMethod && (
                        <div className="text-xs text-zinc-500">{r.paymentMethod}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <a
                        href={`/api/invoices/${r.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
                      >
                        {FILE_LABELS[r.fileType] ?? "Ver archivo"}
                      </a>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-sm text-zinc-400 hover:text-red-600"
                      >
                        Eliminar
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold">Proyectos y clientes guardados</h2>
            <p className="text-xs text-zinc-500 mb-3">
              Se guardan solos al exportar una factura y aparecen como sugerencias en el
              generador.
            </p>
            {catalog.length === 0 ? (
              <p className="text-sm text-zinc-500">Todavía no hay ninguno.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {catalog.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {entry.project} <span className="text-zinc-500">· {entry.client}</span>
                      <span className="ml-2 text-xs text-zinc-400">
                        {entry.timesUsed} {entry.timesUsed === 1 ? "factura" : "facturas"}
                      </span>
                    </span>
                    <button
                      onClick={() => handleDeleteCatalogEntry(entry)}
                      className="text-zinc-400 hover:text-red-600"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
