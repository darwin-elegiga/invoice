"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { InvoicePreview } from "./components/InvoicePreview"
import { PaymentMethodsPanel, type PaymentMethod } from "./components/PaymentMethodsPanel"
import { jsPDF } from "jspdf"
import { PlusCircle } from "lucide-react"
import {
  getCurrentMonthInvoiceNumber,
  getInvoiceNameForDate,
  getInvoiceNumberForDate,
  getLastDayIsoForDate,
  getLastDayOfMonth,
  fromIsoDate,
  isoToDate,
  toIsoDate,
} from "./utils/date-utils"
import { parseFlexibleNumber, formatEsNumber, formatEsNumberString } from "./utils/number-utils"
import { getWorkdaySuggestion, HOURS_PER_DAY } from "./utils/workdays"
import html2canvas from "html2canvas"


interface InvoiceItem {
  description: string
  client: string
}

// Project/client pair already used in a past invoice (from /api/catalog)
interface CatalogEntry {
  id: number
  project: string
  client: string
  timesUsed: number
  lastUsedAt: string
}

const RECENT_CATALOG_LIMIT = 6

interface DraftData {
  items: InvoiceItem[]
  invoiceUnits: string
  invoicePrice: string
  invoiceTotal: string
  selectedIsoDate: string
  editableText: Record<string, string>
  paymentMethodId?: number | null
}

interface Draft {
  invoiceNumber: string
  data: DraftData
  updatedAt: string
}

const formatDraftTime = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })

export default function InvoiceGenerator() {
  const [items, setItems] = useState<InvoiceItem[]>([{ description: "", client: "" }])
  const [invoiceUnits, setInvoiceUnits] = useState("")
  const [invoicePrice, setInvoicePrice] = useState("")
  const [invoiceTotal, setInvoiceTotal] = useState("")

  const [editableText, setEditableText] = useState({
    companyName: "LYN Soluciones Tecnológicas S.L",
    nif: "B72652290",
    address:
      "c/ Marie Curie 9-15, Edificio B-Bioma, 4ª planta, oficina 409,\n28521, Rivas Vaciamadrid,\nMADRID\nESPAÑA",
    clientName: "Darwin Alejandro Elégiga López",
    clientId: "L547719",
    clientAddress: "Carrera 12B 7B-17, Melgar, Tolima, Colombia",
    invoiceNumber: getCurrentMonthInvoiceNumber(),
    date: getLastDayOfMonth(),
  })

  // Alarmas de validación: el precio por hora rara vez pasa de 10 y nunca
  // llega a 100; las unidades (horas trabajadas) rara vez bajan de 100.
  const parsedUnits = parseFlexibleNumber(invoiceUnits)
  const parsedPrice = parseFlexibleNumber(invoicePrice)
  const priceError = !Number.isNaN(parsedPrice) && parsedPrice >= 100
  const priceUnusual = !Number.isNaN(parsedPrice) && parsedPrice > 10 && parsedPrice < 100
  const unitsUnusual = !Number.isNaN(parsedUnits) && parsedUnits > 0 && parsedUnits < 100
  // Precio raro Y unidades raras a la vez: lo más probable es que estén intercambiados
  const swapWarning = (priceError || priceUnusual) && unitsUnusual

  const [selectedIsoDate, setSelectedIsoDate] = useState<string>(() => getLastDayIsoForDate())

  // Sugerencia (no oficial) de días/horas trabajadas del mes facturado,
  // según el calendario LYN 2026 (Madrid) + vacaciones de Darwin
  const invoiceDateObj = isoToDate(selectedIsoDate)
  const workdaySuggestion = invoiceDateObj
    ? getWorkdaySuggestion(invoiceDateObj.getFullYear(), invoiceDateObj.getMonth())
    : null
  const suggestionMonthLabel = invoiceDateObj
    ? getInvoiceNameForDate(invoiceDateObj).toLowerCase()
    : ""
  const shortDate = (iso: string) => {
    const d = isoToDate(iso)
    return d ? `${d.getDate()}/${d.getMonth() + 1}` : iso
  }
  const suggestionDetails: string[] = []
  if (workdaySuggestion) {
    if (workdaySuggestion.holidays.length > 0) {
      suggestionDetails.push(
        `Festivos: ${workdaySuggestion.holidays.map((h) => `${shortDate(h.date)} ${h.name}`).join(", ")}`,
      )
    }
    if (workdaySuggestion.tentativeHolidays.length > 0) {
      suggestionDetails.push(
        `Por confirmar: ${workdaySuggestion.tentativeHolidays.map((h) => `${shortDate(h.date)} ${h.name}`).join(", ")}`,
      )
    }
    if (workdaySuggestion.vacationDays.length > 0) {
      suggestionDetails.push(
        `Vacaciones: ${workdaySuggestion.vacationDays.map((v) => shortDate(v.date)).join(" y ")}`,
      )
    }
  }

  useEffect(() => {
    const iso = getLastDayIsoForDate()
    setSelectedIsoDate(iso)
    setEditableText((prev) => ({
      ...prev,
      invoiceNumber: getCurrentMonthInvoiceNumber(),
      date: getLastDayOfMonth(),
    }))
  }, [])

  const handleDateChange = (iso: string) => {
    setSelectedIsoDate(iso)
    const d = isoToDate(iso)
    if (!d) return
    setEditableText((prev) => ({
      ...prev,
      date: fromIsoDate(iso),
      invoiceNumber: getInvoiceNumberForDate(d),
    }))
  }

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null)
  const selectedPaymentMethod = paymentMethods.find((m) => m.id === paymentMethodId) ?? null

  useEffect(() => {
    fetch("/api/payment-methods")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PaymentMethod[]) => {
        if (!Array.isArray(data)) return
        setPaymentMethods(data)
        // Keep a method picked from a loaded draft; otherwise use the default
        setPaymentMethodId((current) => current ?? (data.find((m) => m.isDefault) ?? data[0])?.id ?? null)
      })
      .catch(() => {})
  }, [])

  const [drafts, setDrafts] = useState<Draft[]>([])
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [historyStatus, setHistoryStatus] = useState<
    | { kind: "idle" | "saving" }
    | { kind: "saved"; pairs: number; incomplete: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" })

  const updateDrafts = (res: Response) =>
    res.ok ? res.json().then((data) => setDrafts(Array.isArray(data) ? data : [])) : Promise.reject()

  useEffect(() => {
    fetch("/api/drafts").then(updateDrafts).catch(() => {})
  }, [])

  const saveDraft = async () => {
    setDraftStatus("saving")
    const data: DraftData = {
      items,
      invoiceUnits,
      invoicePrice,
      invoiceTotal,
      selectedIsoDate,
      editableText,
      paymentMethodId,
    }
    try {
      await fetch("/api/drafts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceNumber: editableText.invoiceNumber, data }),
      }).then(updateDrafts)
      setDraftStatus("saved")
      loadCatalog()
    } catch {
      setDraftStatus("error")
    }
  }

  const loadDraft = (draft: Draft) => {
    const { data } = draft
    setItems(data.items?.length ? data.items : [{ description: "", client: "" }])
    setInvoiceUnits(data.invoiceUnits ?? "")
    setInvoicePrice(data.invoicePrice ?? "")
    setInvoiceTotal(data.invoiceTotal ?? "")
    if (data.selectedIsoDate) setSelectedIsoDate(data.selectedIsoDate)
    setPrefilledFrom(null)
    setEditableText((prev) => ({ ...prev, ...data.editableText }))
    if (data.paymentMethodId) setPaymentMethodId(data.paymentMethodId)
    setDraftStatus("idle")
  }

  const discardDraft = async (invoiceNumber: string) => {
    if (!window.confirm(`¿Descartar el borrador ${invoiceNumber}?`)) return
    await fetch(`/api/drafts?invoiceNumber=${encodeURIComponent(invoiceNumber)}`, {
      method: "DELETE",
    })
      .then(updateDrafts)
      .catch(() => {})
  }

  // Project/client lines barely change month to month, so a fresh form starts
  // with the lines of the latest finalized invoice
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/invoices")
      .then((res) => (res.ok ? res.json() : []))
      .then((records: { invoiceNumber: string; items?: { project: string; client: string }[] }[]) => {
        const last = Array.isArray(records) ? records.find((r) => r.items?.length) : undefined
        if (!last?.items) return
        const lastItems = last.items.map((i) => ({ description: i.project, client: i.client }))
        setItems((current) => {
          if (current.some((i) => i.description || i.client)) return current
          setPrefilledFrom(last.invoiceNumber)
          return lastItems
        })
      })
      .catch(() => {})
  }, [])

  const clearPrefilledItems = () => {
    setItems([{ description: "", client: "" }])
    setPrefilledFrom(null)
  }

  const emailSubject = `DARWIN ELÉGIGA ${getInvoiceNameForDate(invoiceDateObj ?? new Date())} Parte de horas y factura`
  const [subjectCopied, setSubjectCopied] = useState(false)

  const copyEmailSubject = async () => {
    try {
      await navigator.clipboard.writeText(emailSubject)
      setSubjectCopied(true)
      setTimeout(() => setSubjectCopied(false), 2000)
    } catch {}
  }

  const [catalog, setCatalog] = useState<CatalogEntry[]>([])

  const loadCatalog = () =>
    fetch("/api/catalog")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCatalog(Array.isArray(data) ? data : []))
      .catch(() => {})

  useEffect(() => {
    loadCatalog()
  }, [])

  // Catalog is sorted by last use, so the first match is the most recent
  const catalogProjects = Array.from(new Set(catalog.map((e) => e.project)))
  const catalogClients = Array.from(new Set(catalog.map((e) => e.client)))

  const removeCatalogEntry = async (entry: CatalogEntry) => {
    if (!window.confirm(`¿Quitar «${entry.project} · ${entry.client}» de guardados?`)) return
    await fetch(`/api/catalog?id=${entry.id}`, { method: "DELETE" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setCatalog(Array.isArray(data) ? data : []))
      .catch(() => {})
  }

  const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
  const isEntryInItems = (entry: CatalogEntry) =>
    items.some((i) => sameText(i.description, entry.project) && sameText(i.client, entry.client))

  const applyCatalogEntry = (entry: CatalogEntry) => {
    if (isEntryInItems(entry)) return
    const filled = { description: entry.project, client: entry.client }
    const emptyIndex = items.findIndex((i) => !i.description && !i.client)
    if (emptyIndex === -1) {
      setItems([...items, filled])
    } else {
      setItems(items.map((item, i) => (i === emptyIndex ? filled : item)))
    }
  }

  const handleEditableTextChange = (key: string, value: string) => {
    setEditableText((prev) => ({ ...prev, [key]: value }))
  }

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string) => {
    const newItems = items.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    // Picking a known project fills in its client when none was typed yet
    if (field === "description" && !newItems[index].client) {
      const match = catalog.find((e) => e.project === value)
      if (match) newItems[index].client = match.client
    }
    setItems(newItems)
  }

  const handleUnitsChange = (value: string) => {
    setInvoiceUnits(value)
    const units = parseFlexibleNumber(value) || 0
    const price = parseFlexibleNumber(invoicePrice) || 0
    if (units && price) {
      setInvoiceTotal(formatEsNumber(units * price))
    }
  }

  const handlePriceChange = (value: string) => {
    setInvoicePrice(value)
    const units = parseFlexibleNumber(invoiceUnits) || 0
    const price = parseFlexibleNumber(value) || 0
    if (units && price) {
      setInvoiceTotal(formatEsNumber(units * price))
    }
  }

  const addItem = () => {
    setItems([...items, { description: "", client: "" }])
  }

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
  }

const exportToPDF = async () => {
  if (swapWarning || priceError || priceUnusual || unitsUnusual) {
    const issues: string[] = []
    if (swapWarning) {
      issues.push(
        `parece que Unidades (${invoiceUnits}) y Precio (${formatEsNumber(parsedPrice)} EUR) están intercambiados`,
      )
    } else {
      if (priceError) {
        issues.push(`el precio por hora (${formatEsNumber(parsedPrice)} EUR) nunca debería llegar a 100`)
      } else if (priceUnusual) {
        issues.push(`el precio por hora (${formatEsNumber(parsedPrice)} EUR) rara vez pasa de 10`)
      }
      if (unitsUnusual) {
        issues.push(`las unidades (${invoiceUnits}) rara vez bajan de 100`)
      }
    }
    const ok = window.confirm(`Aviso: ${issues.join(" y ")}. ¿Exportar de todos modos?`)
    if (!ok) return
  }
  const content = document.getElementById("invoice-preview")
  if (!content) return

  const canvas = await html2canvas(content, {
    scale: 1.5, // Reducido de 2 a 1.5 para menor peso
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff', // Fondo blanco explícito
    removeContainer: true, // Mejora la renderización
    allowTaint: false,
    foreignObjectRendering: false, // Mejora compatibilidad
  })

  const imgData = canvas.toDataURL("image/jpeg", 0.85) // JPEG con 85% calidad en lugar de PNG
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true, // Activar compresión del PDF
  })

  const imgProps = pdf.getImageProperties(imgData)
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width

  // Si la imagen es muy alta, ajustar para que quepa en una página
  const maxHeight = pdf.internal.pageSize.getHeight()
  if (pdfHeight > maxHeight) {
    const ratio = maxHeight / pdfHeight
    const adjustedWidth = pdfWidth * ratio
    const adjustedHeight = maxHeight
    const xOffset = (pdfWidth - adjustedWidth) / 2
    pdf.addImage(imgData, "JPEG", xOffset, 0, adjustedWidth, adjustedHeight)
  } else {
    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight)
  }

  const selectedDateObj = isoToDate(selectedIsoDate) ?? new Date()
  const fileName = `FACTURA DARWIN ELÉGIGA ${getInvoiceNameForDate(selectedDateObj)}.pdf`
  pdf.save(fileName)
  await saveInvoiceToHistory(pdf.output("blob"), fileName)
}

const saveInvoiceToHistory = async (blob: Blob, fileName: string) => {
  const isoDate = toIsoDate(editableText.date)
  if (!isoDate) {
    setHistoryStatus({ kind: "error", message: `fecha inválida (${editableText.date})` })
    return
  }
  const lines = items.map((i) => ({ project: i.description.trim(), client: i.client.trim() }))
  const fd = new FormData()
  fd.append("file", new File([blob], fileName, { type: "application/pdf" }))
  fd.append("invoiceNumber", editableText.invoiceNumber)
  fd.append("date", isoDate)
  fd.append("total", invoiceTotal)
  fd.append("notes", items.map((i) => i.description).filter(Boolean).join(" | "))
  fd.append("items", JSON.stringify(lines))
  fd.append("paymentMethod", selectedPaymentMethod?.name ?? "")
  setHistoryStatus({ kind: "saving" })
  try {
    const res = await fetch("/api/invoices", { method: "POST", body: fd })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    setHistoryStatus({
      kind: "saved",
      pairs: lines.filter((l) => l.project && l.client).length,
      incomplete: lines.filter((l) => !l.project !== !l.client).length,
    })
    loadCatalog()
    // A finalized invoice no longer needs its draft
    fetch(`/api/drafts?invoiceNumber=${encodeURIComponent(editableText.invoiceNumber)}`, {
      method: "DELETE",
    })
      .then(updateDrafts)
      .catch(() => {})
  } catch (err) {
    setHistoryStatus({ kind: "error", message: err instanceof Error ? err.message : String(err) })
  }
}

// Alternativa más ligera usando solo jsPDF (sin html2canvas):
// Si quieres una alternativa que genere PDFs aún más ligeros,
// aquí tienes una función que crea el PDF directamente:

const exportToPDFLightweight = () => {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  let yPos = margin

  // Configurar fuente
  pdf.setFont("helvetica", "normal")

  // Header - Factura y Fecha
  pdf.setFontSize(12)
  pdf.text(`Factura: ${editableText.invoiceNumber}`, pageWidth - margin, yPos, { align: 'right' })
  yPos += 7
  pdf.text(`Fecha: ${editableText.date}`, pageWidth - margin, yPos, { align: 'right' })
  yPos += 20

  // Información de la empresa
  pdf.setFontSize(11)
  pdf.text(editableText.companyName, pageWidth - margin, yPos, { align: 'right' })
  yPos += 7
  pdf.text(`NIF: ${editableText.nif}`, pageWidth - margin, yPos, { align: 'right' })
  yPos += 7
  
  const addressLines = editableText.address.split('\n')
  addressLines.forEach(line => {
    pdf.text(line, pageWidth - margin, yPos, { align: 'right' })
    yPos += 5
  })
  yPos += 15

  // Información del cliente
  pdf.setFontSize(11)
  pdf.text(`Nombre: ${editableText.clientName}`, margin, yPos)
  yPos += 7
  pdf.text(`ID: ${editableText.clientId}`, margin, yPos)
  yPos += 7
  pdf.text(`Dirección: ${editableText.clientAddress}`, margin, yPos)
  yPos += 20

  // Tabla de items - Proyectos y Clientes
  pdf.setFontSize(10)
  pdf.text("Proyecto", margin, yPos)
  pdf.text("Cliente", margin + 100, yPos)
  yPos += 7

  pdf.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 7

  items.forEach(item => {
    pdf.text(item.description, margin, yPos)
    pdf.text(item.client, margin + 100, yPos)
    yPos += 7
  })

  yPos += 10
  pdf.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 15

  // Resumen de pagos (global)
  const tableX = pageWidth - margin - 80
  pdf.text("Unidades", tableX, yPos)
  if (invoicePrice) pdf.text("Precio x h", tableX + 25, yPos)
  pdf.text("Total", tableX + 55, yPos)
  yPos += 7

  pdf.line(tableX, yPos, pageWidth - margin, yPos)
  yPos += 7

  pdf.text(invoiceUnits, tableX, yPos)
  if (invoicePrice) pdf.text(`${formatEsNumberString(invoicePrice)} EUR`, tableX + 25, yPos)
  pdf.text(invoiceTotal ? `${formatEsNumberString(invoiceTotal)} EUR` : "", tableX + 55, yPos)
  yPos += 7

  // Información de pago y total al final de la página
  yPos = pageHeight - 40

  pdf.setFontSize(10)
  if (selectedPaymentMethod) {
    pdf.text(selectedPaymentMethod.name, margin, yPos)
    yPos += 7
    selectedPaymentMethod.lines.forEach((line) => {
      pdf.text(`${line.label}: ${line.value}`, margin, yPos)
      yPos += 7
    })
  }
  yPos += 3

  pdf.setLineDashPattern([2, 2], 0)
  pdf.line(margin, yPos, pageWidth - margin, yPos)
  pdf.setLineDashPattern([], 0)
  yPos += 10

  pdf.setFontSize(12)
  pdf.text(`TOTAL: ${formatEsNumberString(invoiceTotal)} EUR`, pageWidth - margin, yPos, { align: 'right' })
  pdf.save(`FACTURA DARWIN ELÉGIGA ${getCurrentMonthInvoiceNumber()}`)
}

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Facturas LYN</h1>
        <Link href="/historial" className="text-sm text-blue-600 hover:underline">
          Historial →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Entrada de Datos</h2>
          
          {drafts.length > 0 && (
            <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm space-y-2">
              <div className="font-semibold text-amber-800">Borradores guardados</div>
              {drafts.map((draft) => (
                <div key={draft.invoiceNumber} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{draft.invoiceNumber}</span>
                  <span className="text-xs text-amber-700">
                    guardado {formatDraftTime(draft.updatedAt)}
                  </span>
                  <span className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => loadDraft(draft)}>
                      Cargar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600"
                      onClick={() => discardDraft(draft.invoiceNumber)}
                    >
                      Descartar
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Items: Proyecto y Cliente */}
          <div className="space-y-4">
            <datalist id="catalog-projects">
              {catalogProjects.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <datalist id="catalog-clients">
              {catalogClients.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {prefilledFrom && (
              <div className="flex flex-wrap items-center gap-2 rounded border border-blue-200 bg-blue-50 p-2 text-sm text-blue-800">
                <span>
                  Líneas copiadas de la última factura (
                  <span className="font-mono">{prefilledFrom}</span>).
                </span>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={clearPrefilledItems}>
                  Vaciar
                </Button>
              </div>
            )}
            {catalog.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500">Reutilizar proyecto y cliente:</div>
                <div className="flex flex-wrap gap-2">
                  {catalog.slice(0, RECENT_CATALOG_LIMIT).map((entry) => (
                    <span key={entry.id} className="inline-flex">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-r-none disabled:opacity-60"
                        disabled={isEntryInItems(entry)}
                        title={isEntryInItems(entry) ? "Ya está en la factura" : undefined}
                        onClick={() => applyCatalogEntry(entry)}
                      >
                        {isEntryInItems(entry) && "✓ "}
                        {entry.project} · {entry.client}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-l-none border-l-0 px-2 text-gray-400 hover:text-red-600"
                        title="Quitar de guardados"
                        aria-label={`Quitar ${entry.project} · ${entry.client} de guardados`}
                        onClick={() => removeCatalogEntry(entry)}
                      >
                        ×
                      </Button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {items.map((item, index) => (
              <div key={index} className="space-y-2 p-4 border rounded">
                <div>
                  <Label htmlFor={`description-${index}`}>Proyecto</Label>
                  <Input
                    id={`description-${index}`}
                    list="catalog-projects"
                    autoComplete="off"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, "description", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`client-${index}`}>Cliente</Label>
                  <Input
                    id={`client-${index}`}
                    list="catalog-clients"
                    autoComplete="off"
                    value={item.client}
                    onChange={(e) => handleItemChange(index, "client", e.target.value)}
                  />
                </div>
                {index > 0 && (
                  <Button variant="destructive" onClick={() => removeItem(index)}>
                    Eliminar
                  </Button>
                )}
              </div>
            ))}
            <Button onClick={addItem} className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" /> Agregar Item
            </Button>
          </div>

          {/* Fecha de la factura */}
          <div className="mt-4 p-4 border rounded bg-gray-50 space-y-2">
            <h3 className="font-semibold">Fecha de la factura</h3>
            <p className="text-xs text-gray-500">
              Por defecto se usa el último día del mes actual. Puedes seleccionar una fecha
              de un mes pasado y el número de factura y el nombre del PDF se ajustarán al
              mes/año elegido.
            </p>
            <div>
              <Label htmlFor="invoice-date">Fecha</Label>
              <Input
                id="invoice-date"
                type="date"
                value={selectedIsoDate}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </div>
            <div className="text-xs text-gray-600">
              Número de factura: <span className="font-mono">{editableText.invoiceNumber}</span>
            </div>
          </div>

          {/* Resumen de pago (global) */}
          <div className="mt-4 p-4 border rounded bg-gray-50 space-y-2">
            <h3 className="font-semibold">Resumen de Pago</h3>
            {workdaySuggestion && (
              <div className="rounded border border-blue-200 bg-blue-50 p-2 text-sm text-blue-800 space-y-1">
                <div>
                  💡 Sugerencia (no oficial) — {suggestionMonthLabel}:{" "}
                  {workdaySuggestion.workdaysMin === workdaySuggestion.workdaysMax
                    ? `${workdaySuggestion.workdaysMax} días laborables ≈ ${workdaySuggestion.hoursMax} h`
                    : `${workdaySuggestion.workdaysMin}–${workdaySuggestion.workdaysMax} días laborables ≈ ${workdaySuggestion.hoursMin}–${workdaySuggestion.hoursMax} h`}{" "}
                  ({HOURS_PER_DAY} h/día)
                </div>
                {suggestionDetails.length > 0 && (
                  <div className="text-xs text-blue-700">{suggestionDetails.join(" · ")}</div>
                )}
                {!workdaySuggestion.hasData && (
                  <div className="text-xs text-blue-700">
                    Sin festivos ni vacaciones: no hay calendario cargado para{" "}
                    {invoiceDateObj?.getFullYear()}.
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  {workdaySuggestion.hoursMin !== workdaySuggestion.hoursMax && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnitsChange(String(workdaySuggestion.hoursMin))}
                    >
                      Usar {workdaySuggestion.hoursMin} h
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUnitsChange(String(workdaySuggestion.hoursMax))}
                  >
                    Usar {workdaySuggestion.hoursMax} h
                  </Button>
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="invoice-units">Unidades</Label>
              <Input
                id="invoice-units"
                value={invoiceUnits}
                onChange={(e) => handleUnitsChange(e.target.value)}
                className={
                  swapWarning
                    ? "border-red-500 focus-visible:ring-red-500"
                    : unitsUnusual
                      ? "border-amber-500 focus-visible:ring-amber-500"
                      : undefined
                }
              />
            </div>
            <div>
              <Label htmlFor="invoice-price">Precio por unidad (opcional)</Label>
              <Input
                id="invoice-price"
                value={invoicePrice}
                onChange={(e) => handlePriceChange(e.target.value)}
                className={
                  swapWarning || priceError
                    ? "border-red-500 focus-visible:ring-red-500"
                    : priceUnusual
                      ? "border-amber-500 focus-visible:ring-amber-500"
                      : undefined
                }
              />
            </div>
            {swapWarning ? (
              <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                ⚠️ Posible intercambio: el precio por hora ({formatEsNumber(parsedPrice)} EUR) es
                inusualmente alto y las unidades ({invoiceUnits}) inusualmente bajas. Revisa si has
                invertido Unidades y Precio.
              </div>
            ) : (
              <>
                {priceError && (
                  <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                    ⚠️ El precio por hora ({formatEsNumber(parsedPrice)} EUR) nunca debería llegar a
                    100. Revísalo.
                  </div>
                )}
                {priceUnusual && (
                  <div className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-700">
                    ⚠️ El precio por hora ({formatEsNumber(parsedPrice)} EUR) rara vez pasa de 10.
                    Comprueba que es correcto.
                  </div>
                )}
                {unitsUnusual && (
                  <div className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-700">
                    ⚠️ Las unidades ({invoiceUnits}) rara vez bajan de 100 horas. Comprueba que es
                    correcto.
                  </div>
                )}
              </>
            )}
            <div>
              <Label htmlFor="invoice-total">Total</Label>
              <Input
                id="invoice-total"
                value={invoiceTotal}
                onChange={(e) => setInvoiceTotal(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={saveDraft} disabled={draftStatus === "saving"}>
              {draftStatus === "saving" ? "Guardando…" : "Guardar borrador"}
            </Button>
            <Button onClick={exportToPDF}>Finalizar</Button>
            <span className="text-xs text-gray-500">
              {draftStatus === "saved" && "Borrador guardado"}
              {draftStatus === "error" && "No se pudo guardar el borrador"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded border bg-gray-50 p-2 text-sm">
            <span className="text-gray-500">Asunto del correo:</span>
            <span className="font-medium">{emailSubject}</span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={copyEmailSubject}>
              {subjectCopied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          {historyStatus.kind === "saving" && (
            <p className="mt-2 text-sm text-gray-500">Guardando en el historial…</p>
          )}
          {historyStatus.kind === "saved" && (
            <div className="mt-2 rounded border border-green-300 bg-green-50 p-2 text-sm text-green-800">
              ✓ Factura guardada en el historial
              {historyStatus.pairs > 0 &&
                ` · ${historyStatus.pairs} ${historyStatus.pairs === 1 ? "proyecto-cliente guardado" : "proyectos-cliente guardados"}`}
              {historyStatus.incomplete > 0 && (
                <div className="text-xs text-amber-700">
                  {historyStatus.incomplete === 1
                    ? "1 línea no tiene proyecto y cliente a la vez, así que no se guardó como sugerencia."
                    : `${historyStatus.incomplete} líneas no tienen proyecto y cliente a la vez, así que no se guardaron como sugerencia.`}
                </div>
              )}
            </div>
          )}
          {historyStatus.kind === "error" && (
            <div className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
              ⚠️ El PDF se descargó, pero no se guardó en el historial: {historyStatus.message}
            </div>
          )}

          <PaymentMethodsPanel
            methods={paymentMethods}
            selectedId={paymentMethodId}
            onSelect={setPaymentMethodId}
            onMethodsChange={setPaymentMethods}
          />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Vista Previa</h2>
          <InvoicePreview
            items={items}
            units={invoiceUnits}
            price={invoicePrice}
            total={invoiceTotal}
            editableText={editableText}
            paymentMethod={selectedPaymentMethod}
            onEditableTextChange={handleEditableTextChange}
          />
        </div>
      </div>
    </div>
  )
}