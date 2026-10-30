"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import html2canvas from "html2canvas"
import { jsPDF } from "jspdf"
import { Check, ChevronLeft, ChevronRight, Download, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppHeader } from "@/app/components/AppHeader"
import { InvoicePreview } from "./components/InvoicePreview"
import { PaymentMethodsPanel, type PaymentMethod } from "./components/PaymentMethodsPanel"
import { TimesheetEditor, formatHours, type CatalogEntry } from "./components/TimesheetEditor"
import {
  buildDefaultMonth,
  timesheetFileName,
  timesheetLines,
  totalHours,
  workedDays,
  type TimesheetMonth,
} from "@/lib/timesheets"
import { linesForNewMonth } from "@/lib/timesheet-lines"
import type { Profile } from "@/lib/profile"
import { useProfile } from "@/hooks/use-profile"
import { fromIsoDate, getInvoiceNameForDate, getInvoiceNumberForDate, getLastDayIsoForDate } from "./utils/date-utils"
import { formatEsNumber } from "./utils/number-utils"

// Monthly flow: 1) fill in the hours sheet, 2) review the invoice built from
// it, then export both files (PDF + Excel) and archive them in the history.

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

// Fields of the invoice template filled from the settings profile
const profileText = (p: Profile) => ({
  companyName: p.companyName,
  nif: p.companyNif,
  address: p.companyAddress,
  clientName: p.fullName,
  clientIdLabel: p.idLabel,
  clientId: p.idNumber,
  clientAddress: p.address,
})

type ExportStatus =
  | { kind: "idle" | "working" }
  | { kind: "done"; archived: boolean }
  | { kind: "error"; message: string }

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function renderInvoicePdf(): Promise<jsPDF | null> {
  const content = document.getElementById("invoice-preview")
  if (!content) return null

  // The preview column scrolls on its own; capture it unscrolled so the
  // sheet isn't clipped, then put the user's scroll back.
  const scroller = content.closest(".overflow-auto")
  const previousScroll = scroller ? { top: scroller.scrollTop, left: scroller.scrollLeft } : null
  scroller?.scrollTo(0, 0)
  const canvas = await html2canvas(content, {
    scale: 1.5,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    removeContainer: true,
    allowTaint: false,
    foreignObjectRendering: false,
  })
  if (scroller && previousScroll) scroller.scrollTo(previousScroll.left, previousScroll.top)

  const imgData = canvas.toDataURL("image/jpeg", 0.85)
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true })
  const imgProps = pdf.getImageProperties(imgData)
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
  const maxHeight = pdf.internal.pageSize.getHeight()
  if (pdfHeight > maxHeight) {
    // Shrink to fit a single page
    const ratio = maxHeight / pdfHeight
    pdf.addImage(imgData, "JPEG", (pdfWidth - pdfWidth * ratio) / 2, 0, pdfWidth * ratio, maxHeight)
  } else {
    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight)
  }
  return pdf
}

export default function InvoicePage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [step, setStep] = useState<1 | 2>(1)
  const profile = useProfile()

  const [sheet, setSheet] = useState<TimesheetMonth | null>(null)
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null)
  const selectedPaymentMethod = paymentMethods.find((m) => m.id === paymentMethodId) ?? null

  const [exportStatus, setExportStatus] = useState<ExportStatus>({ kind: "idle" })
  const [subjectCopied, setSubjectCopied] = useState(false)

  const loadCatalog = () =>
    fetch("/api/catalog")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCatalog(Array.isArray(data) ? data : []))
      .catch(() => {})

  useEffect(() => {
    loadCatalog()
    fetch("/api/payment-methods")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PaymentMethod[]) => {
        if (!Array.isArray(data)) return
        setPaymentMethods(data)
        setPaymentMethodId((data.find((m) => m.isDefault) ?? data[0])?.id ?? null)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/timesheets?year=${year}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: TimesheetMonth[]) => {
        if (cancelled) return
        setSheet(Array.isArray(data) ? data.find((m) => m.month === month) ?? null : null)
        setDirty(false)
        setSaveStatus("idle")
        setExportStatus({ kind: "idle" })
      })
      .catch(() => !cancelled && setSheet(null))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [year, month])

  // Everything on the invoice is derived from the sheet and the settings
  const invoiceDate = new Date(year, month, 0)
  const invoiceNumber = getInvoiceNumberForDate(invoiceDate)
  const isoDate = getLastDayIsoForDate(invoiceDate)
  const lines = sheet ? timesheetLines(sheet).filter((l) => l.project || l.client) : []
  const hours = sheet ? totalHours(sheet) : 0
  const rate = profile.hourlyRate
  const total = Math.round(hours * rate * 100) / 100
  const monthName = getInvoiceNameForDate(invoiceDate)
  const pdfName = `FACTURA ${profile.shortName} ${monthName}.pdf`
  const xlsxName = timesheetFileName(year, month, profile.shortName)
  const emailSubject = `${profile.shortName} ${monthName} Parte de horas y factura`

  const shiftMonth = (delta: number) => {
    if (dirty && !window.confirm("Hay cambios sin guardar en el parte. ¿Cambiar de mes igualmente?")) return
    const index = year * 12 + (month - 1) + delta
    setYear(Math.floor(index / 12))
    setMonth((index % 12) + 1)
    setStep(1)
  }

  const updateSheet = (next: TimesheetMonth) => {
    setSheet(next)
    setDirty(true)
    setSaveStatus("idle")
    setExportStatus({ kind: "idle" })
  }

  const createSheet = async () =>
    updateSheet(buildDefaultMonth(year, month, await linesForNewMonth(year, month)))

  const saveSheet = async () => {
    if (!sheet) return false
    if (!dirty) return true
    setSaveStatus("saving")
    try {
      const res = await fetch("/api/timesheets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sheet),
      })
      if (!res.ok) throw new Error()
      setDirty(false)
      setSaveStatus("saved")
      return true
    } catch {
      setSaveStatus("error")
      return false
    }
  }

  const goToInvoice = async () => {
    if (await saveSheet()) setStep(2)
  }

  const archive = async (file: File, extra: Record<string, string>) => {
    const fd = new FormData()
    fd.append("file", file)
    fd.append("invoiceNumber", invoiceNumber)
    fd.append("date", isoDate)
    for (const [k, v] of Object.entries(extra)) fd.append(k, v)
    const res = await fetch("/api/invoices", { method: "POST", body: fd })
    return res.ok
  }

  const exportAll = async () => {
    if (!sheet) return
    if (hours <= 0 || lines.length === 0) {
      const missing = [hours <= 0 && "horas", lines.length === 0 && "proyectos"].filter(Boolean).join(" ni ")
      if (!window.confirm(`El parte no tiene ${missing}. ¿Exportar igualmente?`)) return
    }
    setExportStatus({ kind: "working" })
    try {
      if (!(await saveSheet())) throw new Error("no se pudo guardar el parte")

      const pdf = await renderInvoicePdf()
      if (!pdf) throw new Error("no se encontró la vista previa")
      const pdfBlob = pdf.output("blob")

      const xlsxRes = await fetch(`/api/timesheets/xlsx?year=${year}&month=${month}`)
      if (!xlsxRes.ok) throw new Error("no se pudo generar el Excel")
      const xlsxBlob = await xlsxRes.blob()

      downloadBlob(pdfBlob, pdfName)
      downloadBlob(xlsxBlob, xlsxName)

      const archived = (
        await Promise.all([
          archive(new File([pdfBlob], pdfName, { type: "application/pdf" }), {
            total: formatEsNumber(total),
            notes: `${formatHours(hours)} h × ${formatEsNumber(rate)} EUR`,
            items: JSON.stringify(lines),
            paymentMethod: selectedPaymentMethod?.name ?? "",
          }),
          // No project lines here, so the catalog isn't counted twice
          archive(new File([xlsxBlob], xlsxName), { notes: "Parte de horas" }),
        ])
      ).every(Boolean)
      setExportStatus({ kind: "done", archived })
      loadCatalog()
    } catch (err) {
      setExportStatus({ kind: "error", message: err instanceof Error ? err.message : String(err) })
    }
  }

  const copyEmailSubject = async () => {
    try {
      await navigator.clipboard.writeText(emailSubject)
      setSubjectCopied(true)
      setTimeout(() => setSubjectCopied(false), 2000)
    } catch {}
  }

  const steps = [
    { n: 1 as const, label: "Parte de horas" },
    { n: 2 as const, label: "Factura" },
  ]

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:py-12 xl:flex xl:h-screen xl:flex-col xl:py-6">
        <AppHeader title="Facturas LYN" />

        {/* On wide screens each column scrolls on its own: steps left, PDF right */}
        <div className="grid grid-cols-1 gap-8 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(26rem,1fr)_auto]">
          <div className="xl:-mr-2 xl:overflow-y-auto xl:pb-6 xl:pr-2">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Mes anterior"
                  className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                  onClick={() => shiftMonth(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <h2 className="min-w-40 text-center text-xl font-semibold tracking-tight">
                  {MONTHS[month - 1]} <span className="font-normal text-zinc-400">{year}</span>
                </h2>
                <button
                  type="button"
                  aria-label="Mes siguiente"
                  className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                  onClick={() => shiftMonth(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <ol className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1 text-sm">
                {steps.map(({ n, label }) => (
                  <li key={n}>
                    <button
                      type="button"
                      disabled={n === 2 && !sheet}
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 transition-colors disabled:opacity-40 ${
                        step === n ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                      }`}
                      onClick={() => (n === 2 ? goToInvoice() : setStep(1))}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                          step === n ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-600"
                        }`}
                      >
                        {n}
                      </span>
                      {label}
                    </button>
                  </li>
                ))}
              </ol>
            </div>

            {loading && !sheet ? (
              <p className="py-16 text-center text-sm text-zinc-400">Cargando…</p>
            ) : !sheet ? (
              <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-12 text-center shadow-sm">
                <p className="mb-4 text-sm text-zinc-500">
                  Empieza por el parte de horas de {MONTHS[month - 1].toLowerCase()}.
                </p>
                <Button onClick={createSheet}>Crear parte de horas</Button>
                <p className="mx-auto mt-3 max-w-sm text-xs text-zinc-400">
                  8 h en cada día laborable, con fines de semana, festivos y vacaciones marcados, y los
                  proyectos del mes anterior.
                </p>
              </section>
            ) : step === 1 ? (
              <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
                <div className="mb-6 flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold">Parte de horas</h3>
                  <span className="text-sm text-zinc-500">
                    <strong className="text-lg font-semibold text-zinc-900 tabular-nums">{formatHours(hours)} h</strong>{" "}
                    · {workedDays(sheet)} días
                  </span>
                </div>
                <TimesheetEditor value={sheet} onChange={updateSheet} catalog={catalog} />
                <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-zinc-100 pt-6">
                  <span className="mr-auto text-xs text-zinc-400">
                    {dirty && saveStatus !== "saving" && "Cambios sin guardar"}
                    {saveStatus === "saved" && !dirty && "Guardado"}
                    {saveStatus === "error" && <span className="text-red-600">No se pudo guardar</span>}
                  </span>
                  <Button variant="outline" onClick={saveSheet} disabled={!dirty || saveStatus === "saving"}>
                    Guardar
                  </Button>
                  <Button onClick={goToInvoice} disabled={saveStatus === "saving"}>
                    Continuar a la factura <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </section>
            ) : (
              <div className="space-y-6">
                <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
                  <h3 className="mb-4 text-sm font-semibold">Revisa la factura</h3>
                  <dl className="divide-y divide-zinc-100 text-sm">
                    <div className="flex justify-between py-2">
                      <dt className="text-zinc-500">Factura</dt>
                      <dd className="font-mono">{invoiceNumber}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-zinc-500">Fecha</dt>
                      <dd>{fromIsoDate(isoDate)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 py-2">
                      <dt className="text-zinc-500">Proyectos</dt>
                      <dd className="text-right">
                        {lines.length === 0 ? (
                          <span className="text-amber-700">Ninguno</span>
                        ) : (
                          lines.map((l, i) => (
                            <div key={i}>
                              {l.project || "—"} <span className="text-zinc-400">· {l.client || "—"}</span>
                            </div>
                          ))
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-zinc-500">Horas</dt>
                      <dd className="tabular-nums">
                        {formatHours(hours)} h <span className="text-zinc-400">· {workedDays(sheet)} días</span>
                      </dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-zinc-500">Precio por hora</dt>
                      <dd className="flex items-center gap-2 tabular-nums">
                        {formatEsNumber(rate)} EUR
                        <Link href="/ajustes" title="Se cambia en Ajustes" className="text-zinc-300 hover:text-zinc-600">
                          <Lock className="h-3.5 w-3.5" />
                        </Link>
                      </dd>
                    </div>
                    <div className="flex justify-between py-3">
                      <dt className="font-medium">Total</dt>
                      <dd className="text-lg font-semibold tabular-nums">{formatEsNumber(total)} EUR</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className="mt-2 text-sm text-zinc-500 hover:text-zinc-900"
                    onClick={() => setStep(1)}
                  >
                    ← Corregir el parte de horas
                  </button>
                </section>

                <PaymentMethodsPanel
                  methods={paymentMethods}
                  selectedId={paymentMethodId}
                  onSelect={setPaymentMethodId}
                  onMethodsChange={setPaymentMethods}
                />

                <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
                  <Button className="w-full" size="lg" onClick={exportAll} disabled={exportStatus.kind === "working"}>
                    <Download className="mr-2 h-4 w-4" />
                    {exportStatus.kind === "working" ? "Exportando…" : "Exportar PDF y Excel"}
                  </Button>
                  <ul className="space-y-1 text-xs text-zinc-500">
                    <li>{pdfName}</li>
                    <li>{xlsxName}</li>
                  </ul>
                  {exportStatus.kind === "done" && (
                    <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      <Check className="h-4 w-4" />
                      {exportStatus.archived
                        ? "Descargados y guardados en el historial."
                        : "Descargados, pero no se pudieron guardar en el historial."}
                    </p>
                  )}
                  {exportStatus.kind === "error" && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                      No se pudo exportar: {exportStatus.message}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                    <span className="text-zinc-500">Asunto:</span>
                    <span className="font-medium">{emailSubject}</span>
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={copyEmailSubject}>
                      {subjectCopied ? "Copiado" : "Copiar"}
                    </Button>
                  </div>
                </section>
              </div>
            )}
          </div>

          <div className="min-w-0 xl:flex xl:min-h-0 xl:flex-col">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">Vista previa</h2>
            <div className="overflow-auto rounded-2xl border border-zinc-200 bg-zinc-100 p-4 sm:p-6 xl:min-h-0 xl:flex-1">
              <div className="w-fit shadow-lg">
                <InvoicePreview
                  items={lines.map((l) => ({ description: l.project, client: l.client }))}
                  units={formatHours(hours)}
                  price={String(rate)}
                  total={formatEsNumber(total)}
                  editableText={{ ...profileText(profile), invoiceNumber, date: fromIsoDate(isoDate) }}
                  paymentMethod={selectedPaymentMethod}
                  onEditableTextChange={() => {}}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
