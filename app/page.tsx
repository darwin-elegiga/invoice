"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import Link from "next/link"
import { InvoicePreview } from "./components/InvoicePreview"
import { jsPDF } from "jspdf"
import { ChevronDown, PlusCircle } from "lucide-react"
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
import html2canvas from "html2canvas"

const TRANSFER_FIELDS = [
  { key: "bankName", label: "Banco" },
  { key: "swiftBic", label: "SWIFT/BIC" },
  { key: "beneficiary", label: "Beneficiario" },
  { key: "bankAccount", label: "Cuenta" },
  { key: "cci", label: "CCI" },
  { key: "bankAddress", label: "Dirección" },
] as const

const CARD_FIELDS = [
  { key: "cardHolder", label: "Titular" },
  { key: "cardLast4", label: "Últimos 4 dígitos" },
  { key: "cardBrand", label: "Marca (Visa, Mastercard…)" },
] as const

const LINK_FIELDS = [
  { key: "paymentPlatform", label: "Plataforma (Stripe, PayPal…)" },
  { key: "paymentLink", label: "Enlace de pago" },
] as const

const WESTERN_UNION_FIELDS = [
  { key: "wuName", label: "Nombre y apellidos" },
  { key: "wuAddress", label: "Dirección" },
  { key: "wuPostalCode", label: "Código postal" },
  { key: "wuPassport", label: "Pasaporte" },
  { key: "wuPhone", label: "Número de teléfono" },
] as const

const BANK_FIELDS = [...TRANSFER_FIELDS, ...CARD_FIELDS, ...LINK_FIELDS, ...WESTERN_UNION_FIELDS] as const

type PaymentMethod = "transferencia" | "tarjeta" | "enlace" | "western"

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "transferencia", label: "Transferencia internacional" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "enlace", label: "Enlace de pago" },
  { value: "western", label: "Western Union" },
]

const PAYMENT_METHOD_SECTIONS: Record<
  PaymentMethod,
  { title: string; fields: readonly { key: string; label: string }[] }
> = {
  transferencia: { title: "Transferencia internacional", fields: TRANSFER_FIELDS },
  tarjeta: { title: "Tarjeta", fields: CARD_FIELDS },
  enlace: { title: "Enlace de pago", fields: LINK_FIELDS },
  western: { title: "Western Union", fields: WESTERN_UNION_FIELDS },
}


interface InvoiceItem {
  description: string
  client: string
}

export default function InvoiceGenerator() {
  const [items, setItems] = useState<InvoiceItem[]>([{ description: "", client: "" }])
  const [invoiceUnits, setInvoiceUnits] = useState("")
  const [invoicePrice, setInvoicePrice] = useState("")
  const [invoiceTotal, setInvoiceTotal] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("transferencia")

  const [editableText, setEditableText] = useState({
    companyName: "LYN Soluciones Tecnológicas S.L",
    nif: "B72652290",
    bankName: "BBVA Perú",
    swiftBic: "BCONPEPL",
    beneficiary: "Grisel Rosabal Safonts",
    bankAccount: "0011-0814-0291745585",
    cci: "011-814-000291745585-15",
    bankAddress: "Calle 4 Nro 110, Dpto 4A, 15088, Lima, Perú",
    cardHolder: "",
    cardLast4: "",
    cardBrand: "",
    paymentLink: "",
    paymentPlatform: "",
    wuName: "",
    wuAddress: "",
    wuPostalCode: "",
    wuPassport: "",
    wuPhone: "",
    address:
      "c/ Marie Curie 9-15, Edificio B-Bioma, 4ª planta, oficina 409,\n28521, Rivas Vaciamadrid,\nMADRID\nESPAÑA",
    clientName: "Darwin Alejandro Elégiga López",
    clientId: "L547719",
    clientAddress: "Carrera 12B 7B-17, Melgar, Tolima, Colombia",
    invoiceNumber: getCurrentMonthInvoiceNumber(),
    date: getLastDayOfMonth(),
  })

  const [bankInfoLoaded, setBankInfoLoaded] = useState(false)
  const [bankEditMode, setBankEditMode] = useState(false)
  const [bankDraft, setBankDraft] = useState<Record<string, string>>({})
  const [bankSaveStatus, setBankSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [selectedIsoDate, setSelectedIsoDate] = useState<string>(() => getLastDayIsoForDate())

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

  useEffect(() => {
    let cancelled = false
    fetch("/api/bank-info")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setEditableText((prev) => ({ ...prev, ...data }))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBankInfoLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleEditableTextChange = (key: string, value: string) => {
    setEditableText((prev) => ({ ...prev, [key]: value }))
  }

  const startBankEdit = () => {
    setBankDraft(
      Object.fromEntries(
        BANK_FIELDS.map(({ key }) => [key, (editableText as Record<string, string>)[key]]),
      ),
    )
    setBankSaveStatus("idle")
    setBankEditMode(true)
  }

  const cancelBankEdit = () => {
    setBankDraft({})
    setBankEditMode(false)
    setBankSaveStatus("idle")
  }

  const saveBankEdit = async () => {
    setBankSaveStatus("saving")
    try {
      const res = await fetch("/api/bank-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bankDraft),
      })
      if (!res.ok) throw new Error("save failed")
      const saved = await res.json()
      setEditableText((prev) => ({ ...prev, ...saved }))
      setBankSaveStatus("saved")
      setBankEditMode(false)
      setBankDraft({})
    } catch {
      // Aun sin servidor disponible, aplicar cambios localmente para que la UI refleje la edición
      setEditableText((prev) => ({ ...prev, ...bankDraft }))
      setBankEditMode(false)
      setBankDraft({})
      setBankSaveStatus("error")
    }
  }

  const handleBankDraftChange = (key: string, value: string) => {
    setBankDraft((prev) => ({ ...prev, [key]: value }))
  }

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string) => {
    const newItems = [...items]
    newItems[index][field] = value
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
  let mmPerPx: number
  let xOffset: number
  let yOffset: number
  if (pdfHeight > maxHeight) {
    const ratio = maxHeight / pdfHeight
    const adjustedWidth = pdfWidth * ratio
    const adjustedHeight = maxHeight
    xOffset = (pdfWidth - adjustedWidth) / 2
    yOffset = 0
    mmPerPx = adjustedWidth / content.getBoundingClientRect().width
    pdf.addImage(imgData, "JPEG", xOffset, yOffset, adjustedWidth, adjustedHeight)
  } else {
    xOffset = 0
    yOffset = 0
    mmPerPx = pdfWidth / content.getBoundingClientRect().width
    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight)
  }

  // Superponer enlace clickeable sobre el "Enlace de pago" (si está visible)
  if (paymentMethod === "enlace" && editableText.paymentLink) {
    const linkEl = document.getElementById("invoice-payment-link")
    if (linkEl) {
      const contentRect = content.getBoundingClientRect()
      const url = /^https?:\/\//i.test(editableText.paymentLink)
        ? editableText.paymentLink
        : `https://${editableText.paymentLink}`
      const rects = linkEl.getClientRects()
      for (const r of Array.from(rects)) {
        const x = xOffset + (r.left - contentRect.left) * mmPerPx
        const y = yOffset + (r.top - contentRect.top) * mmPerPx
        const w = r.width * mmPerPx
        const h = r.height * mmPerPx
        pdf.link(x, y, w, h, { url })
      }
    }
  }

  const selectedDateObj = isoToDate(selectedIsoDate) ?? new Date()
  const fileName = `FACTURA DARWIN ELÉGIGA ${getInvoiceNameForDate(selectedDateObj)}.pdf`
  pdf.save(fileName)
  await saveInvoiceToHistory(pdf.output("blob"), fileName)
}

const saveInvoiceToHistory = async (blob: Blob, fileName: string) => {
  const isoDate = toIsoDate(editableText.date)
  if (!isoDate) {
    console.warn("No se pudo guardar en historial: fecha inválida", editableText.date)
    return
  }
  const fd = new FormData()
  fd.append("file", new File([blob], fileName, { type: "application/pdf" }))
  fd.append("invoiceNumber", editableText.invoiceNumber)
  fd.append("date", isoDate)
  fd.append("total", invoiceTotal)
  fd.append("clientName", editableText.clientName)
  fd.append("notes", items.map((i) => i.description).filter(Boolean).join(" | "))
  try {
    const res = await fetch("/api/invoices", { method: "POST", body: fd })
    if (!res.ok) console.warn("Fallo al guardar en historial", await res.text())
  } catch (err) {
    console.warn("Fallo al guardar en historial", err)
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
  if (paymentMethod === "transferencia") {
    pdf.text("Forma de pago (Transferencia Internacional)", margin, yPos)
    yPos += 7
    pdf.text(`Banco: ${editableText.bankName}`, margin, yPos)
    yPos += 7
    pdf.text(`SWIFT/BIC: ${editableText.swiftBic}`, margin, yPos)
    yPos += 7
    pdf.text(`Beneficiario: ${editableText.beneficiary}`, margin, yPos)
    yPos += 7
    pdf.text(`Cuenta: ${editableText.bankAccount}`, margin, yPos)
    yPos += 7
    pdf.text(`CCI: ${editableText.cci}`, margin, yPos)
    yPos += 7
    pdf.text(`Dirección: ${editableText.bankAddress}`, margin, yPos)
  } else if (paymentMethod === "tarjeta") {
    pdf.text("Forma de pago (Tarjeta)", margin, yPos)
    yPos += 7
    if (editableText.cardBrand) {
      pdf.text(`Marca: ${editableText.cardBrand}`, margin, yPos)
      yPos += 7
    }
    if (editableText.cardHolder) {
      pdf.text(`Titular: ${editableText.cardHolder}`, margin, yPos)
      yPos += 7
    }
    if (editableText.cardLast4) {
      pdf.text(`Tarjeta: **** **** **** ${editableText.cardLast4}`, margin, yPos)
    }
  } else if (paymentMethod === "enlace") {
    pdf.text("Forma de pago (Enlace de pago)", margin, yPos)
    yPos += 7
    if (editableText.paymentPlatform) {
      pdf.text(`Plataforma: ${editableText.paymentPlatform}`, margin, yPos)
      yPos += 7
    }
    if (editableText.paymentLink) {
      pdf.text(`Enlace: ${editableText.paymentLink}`, margin, yPos)
    }
  } else {
    pdf.text("Forma de pago (Western Union)", margin, yPos)
    yPos += 7
    if (editableText.wuName) {
      pdf.text(`Nombre y apellidos: ${editableText.wuName}`, margin, yPos)
      yPos += 7
    }
    if (editableText.wuAddress) {
      pdf.text(`Dirección: ${editableText.wuAddress}`, margin, yPos)
      yPos += 7
    }
    if (editableText.wuPostalCode) {
      pdf.text(`Código postal: ${editableText.wuPostalCode}`, margin, yPos)
      yPos += 7
    }
    if (editableText.wuPassport) {
      pdf.text(`Pasaporte: ${editableText.wuPassport}`, margin, yPos)
      yPos += 7
    }
    if (editableText.wuPhone) {
      pdf.text(`Teléfono: ${editableText.wuPhone}`, margin, yPos)
    }
  }
  yPos += 10

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
          
          {/* Items: Proyecto y Cliente */}
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="space-y-2 p-4 border rounded">
                <div>
                  <Label htmlFor={`description-${index}`}>Proyecto</Label>
                  <Input
                    id={`description-${index}`}
                    value={item.description}
                    onChange={(e) => handleItemChange(index, "description", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`client-${index}`}>Cliente</Label>
                  <Input
                    id={`client-${index}`}
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

          {/* Método de pago */}
          <div className="mt-4 p-4 border rounded bg-gray-50 space-y-2">
            <h3 className="font-semibold">Método de Pago</h3>
            <div className="flex flex-wrap gap-3">
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="payment-method"
                    value={opt.value}
                    checked={paymentMethod === opt.value}
                    onChange={() => setPaymentMethod(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
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
            <div>
              <Label htmlFor="invoice-units">Unidades</Label>
              <Input
                id="invoice-units"
                value={invoiceUnits}
                onChange={(e) => handleUnitsChange(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="invoice-price">Precio por unidad (opcional)</Label>
              <Input
                id="invoice-price"
                value={invoicePrice}
                onChange={(e) => handlePriceChange(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="invoice-total">Total</Label>
              <Input
                id="invoice-total"
                value={invoiceTotal}
                onChange={(e) => setInvoiceTotal(e.target.value)}
              />
            </div>
          </div>
          <Button className="mt-4" onClick={exportToPDF}>
            Exportar a PDF
          </Button>

          {/* Datos de cobro (colapsable, persistencia en JSON) */}
          <Collapsible className="mt-6 border rounded bg-gray-50">
            <CollapsibleTrigger className="flex w-full items-center justify-between p-4 font-semibold group">
              <span>Datos de Cobro</span>
              <span className="flex items-center gap-2 text-xs font-normal text-gray-500">
                {bankSaveStatus === "saving" && "Guardando…"}
                {bankSaveStatus === "saved" && "Guardado"}
                {bankSaveStatus === "error" && "Solo local (servidor no disponible)"}
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4 space-y-4">
              {[PAYMENT_METHOD_SECTIONS[paymentMethod]].map(({ title, fields }) => (
                <div key={title} className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
                  {fields.map(({ key, label }) => {
                    const value = bankEditMode
                      ? bankDraft[key] ?? ""
                      : (editableText as Record<string, string>)[key]
                    return (
                      <div key={key}>
                        <Label htmlFor={`bank-${key}`}>{label}</Label>
                        <Input
                          id={`bank-${key}`}
                          value={value}
                          disabled={!bankEditMode}
                          onChange={(e) => handleBankDraftChange(key, e.target.value)}
                        />
                      </div>
                    )
                  })}
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                {bankEditMode ? (
                  <>
                    <Button
                      onClick={saveBankEdit}
                      disabled={bankSaveStatus === "saving"}
                    >
                      {bankSaveStatus === "saving" ? "Guardando…" : "Guardar"}
                    </Button>
                    <Button variant="outline" onClick={cancelBankEdit}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    onClick={startBankEdit}
                    disabled={!bankInfoLoaded}
                  >
                    Editar
                  </Button>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Vista Previa</h2>
          <InvoicePreview
            items={items}
            units={invoiceUnits}
            price={invoicePrice}
            total={invoiceTotal}
            editableText={editableText}
            paymentMethod={paymentMethod}
            onEditableTextChange={handleEditableTextChange}
          />
        </div>
      </div>
    </div>
  )
}