"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { InvoicePreview } from "./components/InvoicePreview"
import { PaymentMethodsPanel, type PaymentMethod } from "./components/PaymentMethodsPanel"
import { timesheetFileName, totalHours, workedDays, type TimesheetMonth } from "@/lib/timesheets"
import { jsPDF } from "jspdf"
import { ChevronRight, PlusCircle, Trash2 } from "lucide-react"
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
    setExpandedItems(data.items?.length ? new Set() : new Set([0]))
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
          setExpandedItems(new Set())
          return lastItems
        })
      })
      .catch(() => {})
  }, [])

  const clearPrefilledItems = () => {
    setItems([{ description: "", client: "" }])
    setExpandedItems(new Set([0]))
    setPrefilledFrom(null)
  }

  const emailSubject = `DARWIN ELÉGIGA ${getInvoiceNameForDate(invoiceDateObj ?? new Date())} Parte de horas y factura`
  const [subjectCopied, setSubjectCopied] = useState(false)

  // Hours sheet of the invoiced month, to reuse its total as invoice units
  const invoiceYear = (invoiceDateObj ?? new Date()).getFullYear()
  const invoiceMonth = (invoiceDateObj ?? new Date()).getMonth() + 1
  const timesheetHref = `/horas?year=${invoiceYear}&month=${invoiceMonth}`
  const [timesheet, setTimesheet] = useState<TimesheetMonth | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/timesheets?year=${invoiceYear}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: TimesheetMonth[]) => {
        if (!cancelled) setTimesheet(Array.isArray(data) ? data.find((m) => m.month === invoiceMonth) ?? null : null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [invoiceYear, invoiceMonth])

  const timesheetHours = timesheet ? totalHours(timesheet) : null
  const [timesheetArchived, setTimesheetArchived] = useState<boolean | null>(null)

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

  // Lines start collapsed (just "Proyecto · Cliente"); new empty ones open
  const [expandedItems, setExpandedItems] = useState<Set<number>>(() => new Set([0]))

  const toggleItem = (index: number, open: boolean) =>
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (open) next.add(index)
      else next.delete(index)
      return next
    })

  const addItem = () => {
    setItems([...items, { description: "", client: "" }])
    setExpandedItems((prev) => new Set(prev).add(items.length))
  }

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
    setExpandedItems(
      (prev) => new Set(Array.from(prev).filter((i) => i !== index).map((i) => (i > index ? i - 1 : i))),
    )
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

  // The preview column scrolls on its own; capture it unscrolled so the
  // sheet isn't clipped, then put the user's scroll back.
  const scroller = content.closest(".overflow-auto")
  const previousScroll = scroller ? { top: scroller.scrollTop, left: scroller.scrollLeft } : null
  scroller?.scrollTo(0, 0)

  const canvas = await html2canvas(content, {
    scale: 1.5, // Reducido de 2 a 1.5 para menor peso
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff', // Fondo blanco explícito
    removeContainer: true, // Mejora la renderización
    allowTaint: false,
    foreignObjectRendering: false, // Mejora compatibilidad
  })

  if (scroller && previousScroll) scroller.scrollTo(previousScroll.left, previousScroll.top)

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

// Stores the hours sheet next to the invoice in the history. No project
// lines, so the catalog isn't counted twice.
const archiveTimesheet = async (isoDate: string) => {
  try {
    const res = await fetch(`/api/timesheets/xlsx?year=${invoiceYear}&month=${invoiceMonth}`)
    if (!res.ok) throw new Error()
    const fd = new FormData()
    fd.append("file", new File([await res.blob()], timesheetFileName(invoiceYear, invoiceMonth)))
    fd.append("invoiceNumber", editableText.invoiceNumber)
    fd.append("date", isoDate)
    fd.append("notes", "Parte de horas")
    const saved = await fetch("/api/invoices", { method: "POST", body: fd })
    setTimesheetArchived(saved.ok)
  } catch {
    setTimesheetArchived(false)
  }
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
  setTimesheetArchived(null)
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
    if (timesheet) archiveTimesheet(isoDate)
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
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:py-12 xl:flex xl:h-screen xl:flex-col xl:py-6">
      <header className="mb-10 flex shrink-0 items-center justify-between text-sm xl:mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Facturas LYN</h1>
        <nav className="flex gap-5 text-zinc-500">
          <Link href={timesheetHref} className="hover:text-zinc-900">
            Parte de horas
          </Link>
          <Link href="/historial" className="hover:text-zinc-900">
            Historial
          </Link>
        </nav>
      </header>
      {/* On wide screens each column scrolls on its own: form left, PDF right */}
      <div className="grid grid-cols-1 gap-8 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(24rem,1fr)_auto]">
        <div className="xl:-mr-2 xl:overflow-y-auto xl:pb-6 xl:pr-2">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">Datos de la factura</h2>
          
          {drafts.length > 0 && (
            <div className="mb-6 space-y-2 rounded-2xl bg-amber-50 p-4 text-sm">
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
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">
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
                <div className="text-xs text-zinc-500">Reutilizar proyecto y cliente:</div>
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
                        className="rounded-l-none border-l-0 px-2 text-zinc-400 hover:text-red-600"
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
            {items.map((item, index) => {
              const open = expandedItems.has(index)
              return (
                <Collapsible
                  key={index}
                  open={open}
                  onOpenChange={(next) => toggleItem(index, next)}
                  className="rounded-2xl border border-zinc-200 bg-white shadow-sm"
                >
                  <div className="flex items-center gap-2 px-5 py-3">
                    <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
                      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-data-[state=open]:rotate-90" />
                      {item.description || item.client ? (
                        <span className="truncate">
                          <span className="font-medium">{item.description || "Sin proyecto"}</span>
                          <span className="text-zinc-500"> · {item.client || "Sin cliente"}</span>
                        </span>
                      ) : (
                        <span className="text-zinc-400">Línea vacía</span>
                      )}
                    </CollapsibleTrigger>
                    {items.length > 1 && (
                      <button
                        type="button"
                        aria-label="Eliminar línea"
                        className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <CollapsibleContent className="space-y-3 px-5 pb-5">
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
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
            <Button onClick={addItem} variant="outline" className="w-full border-dashed text-zinc-500">
              <PlusCircle className="mr-2 h-4 w-4" /> Añadir línea
            </Button>
          </div>

          {/* Fecha de la factura */}
          <div className="mt-6 space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold">Fecha de la factura</h3>
            <p className="text-xs text-zinc-500">
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
            <div className="text-xs text-zinc-500">
              Número de factura: <span className="font-mono">{editableText.invoiceNumber}</span>
            </div>
          </div>

          {/* Resumen de pago (global) */}
          <div className="mt-6 space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold">Resumen de Pago</h3>
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm">
              {timesheet && timesheetHours !== null ? (
                <>
                  <span>
                    Parte de horas: <strong>{formatEsNumber(timesheetHours)} h</strong> ·{" "}
                    {workedDays(timesheet)} días
                  </span>
                  {parsedUnits !== timesheetHours && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnitsChange(String(timesheetHours))}
                    >
                      Usar {formatEsNumber(timesheetHours)} h
                    </Button>
                  )}
                  <Link href={timesheetHref} className="ml-auto text-zinc-500 hover:text-zinc-900">
                    Editar parte
                  </Link>
                </>
              ) : (
                <>
                  <span className="text-zinc-500">Este mes no tiene parte de horas.</span>
                  <Link href={timesheetHref} className="ml-auto text-zinc-500 hover:text-zinc-900">
                    Crear parte
                  </Link>
                </>
              )}
            </div>
            {workdaySuggestion && (
              <div className="space-y-1 rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
                <div>
                  💡 Sugerencia (no oficial) — {suggestionMonthLabel}:{" "}
                  {workdaySuggestion.workdaysMin === workdaySuggestion.workdaysMax
                    ? `${workdaySuggestion.workdaysMax} días laborables ≈ ${workdaySuggestion.hoursMax} h`
                    : `${workdaySuggestion.workdaysMin}–${workdaySuggestion.workdaysMax} días laborables ≈ ${workdaySuggestion.hoursMin}–${workdaySuggestion.hoursMax} h`}{" "}
                  ({HOURS_PER_DAY} h/día)
                </div>
                {suggestionDetails.length > 0 && (
                  <div className="text-xs text-sky-700">{suggestionDetails.join(" · ")}</div>
                )}
                {!workdaySuggestion.hasData && (
                  <div className="text-xs text-sky-700">
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
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                ⚠️ Posible intercambio: el precio por hora ({formatEsNumber(parsedPrice)} EUR) es
                inusualmente alto y las unidades ({invoiceUnits}) inusualmente bajas. Revisa si has
                invertido Unidades y Precio.
              </div>
            ) : (
              <>
                {priceError && (
                  <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    ⚠️ El precio por hora ({formatEsNumber(parsedPrice)} EUR) nunca debería llegar a
                    100. Revísalo.
                  </div>
                )}
                {priceUnusual && (
                  <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    ⚠️ El precio por hora ({formatEsNumber(parsedPrice)} EUR) rara vez pasa de 10.
                    Comprueba que es correcto.
                  </div>
                )}
                {unitsUnusual && (
                  <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
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
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={saveDraft} disabled={draftStatus === "saving"}>
              {draftStatus === "saving" ? "Guardando…" : "Guardar borrador"}
            </Button>
            <Button onClick={exportToPDF}>Finalizar</Button>
            {timesheet && (
              <Button variant="outline" asChild>
                <a href={`/api/timesheets/xlsx?year=${invoiceYear}&month=${invoiceMonth}`}>
                  Descargar parte de horas
                </a>
              </Button>
            )}
            <span className="text-xs text-zinc-500">
              {draftStatus === "saved" && "Borrador guardado"}
              {draftStatus === "error" && "No se pudo guardar el borrador"}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
            <span className="text-zinc-500">Asunto del correo:</span>
            <span className="font-medium">{emailSubject}</span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={copyEmailSubject}>
              {subjectCopied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          {historyStatus.kind === "saving" && (
            <p className="mt-3 text-sm text-zinc-500">Guardando en el historial…</p>
          )}
          {historyStatus.kind === "saved" && (
            <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              ✓ Factura guardada en el historial
              {timesheetArchived === true && " junto con el parte de horas"}
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
          {historyStatus.kind === "saved" && timesheetArchived === false && (
            <p className="mt-1 text-xs text-amber-700">
              No se pudo guardar el parte de horas en el historial.
            </p>
          )}
          {historyStatus.kind === "error" && (
            <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
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
        <div className="min-w-0 xl:flex xl:min-h-0 xl:flex-col">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">Vista previa</h2>
          <div className="overflow-auto rounded-2xl border border-zinc-200 bg-zinc-100 p-4 sm:p-6 xl:min-h-0 xl:flex-1">
            <div className="w-fit shadow-lg">
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
      </div>
    </div>
    </div>
  )
}