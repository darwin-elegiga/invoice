"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InvoicePreview } from "./components/InvoicePreview"
import { jsPDF } from "jspdf"
import { PlusCircle } from "lucide-react"
import { getCurrentMonthInvoiceNumber, getLastDayOfMonth } from "./utils/date-utils"
import html2canvas from "html2canvas"
import { Checkbox } from "@/components/ui/checkbox"


interface InvoiceItem {
  description: string
  units: string
  price?: string
  total: string
  client: string
}

export default function InvoiceGenerator() {
  const [items, setItems] = useState<InvoiceItem[]>([{ description: "", units: "", price: "", total: "", client: "" }])
  const [useImprovedLayout, setUseImprovedLayout] = useState(false)
  const [editableText, setEditableText] = useState({
    companyName: "LYN Soluciones Tecnológicas S.L",
    nif: "B72652290",
    bankAccount: "ES46 2100 3211 0422 0040 1276",
    address:
      "c/ Marie Curie 9-15, Edificio B-Bioma, 4ª planta, oficina 409,\n28521, Rivas Vaciamadrid,\nMADRID\nESPAÑA",
    clientName: "Darwin Alejandro Elégiga López",
    clientId: "02100682665",
    clientAddress: "Calle Martí # 162, Palma Soriano, Santiago de Cuba, Cuba",
    invoiceNumber: getCurrentMonthInvoiceNumber(),
    date: getLastDayOfMonth(),
  })

  useEffect(() => {
    setEditableText((prev) => ({
      ...prev,
      invoiceNumber: getCurrentMonthInvoiceNumber(),
      date: getLastDayOfMonth(),
    }))
  }, [])

  const handleEditableTextChange = (key: string, value: string) => {
    setEditableText((prev) => ({ ...prev, [key]: value }))
  }

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string) => {
    const newItems = [...items]
    newItems[index][field] = value
    setItems(newItems)
  }

  const addItem = () => {
    setItems([...items, { description: "", units: "", price: "", total: "", client: "" }])
  }

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
  }

  const calculateTotal = () => {
    return items
      .reduce((total, item) => {
        return total + Number.parseFloat(item.total || "0")
      }, 0)
      .toFixed(2)
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
  if (pdfHeight > maxHeight) {
    const ratio = maxHeight / pdfHeight
    const adjustedWidth = pdfWidth * ratio
    const adjustedHeight = maxHeight
    const xOffset = (pdfWidth - adjustedWidth) / 2
    pdf.addImage(imgData, "JPEG", xOffset, 0, adjustedWidth, adjustedHeight)
  } else {
    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight)
  }
  
  pdf.save(`FACTURA DARWIN ELÉGIGA ${getCurrentMonthInvoiceNumber()}.pdf`)
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
  pdf.text(editableText.clientName, margin, yPos)
  yPos += 7
  pdf.text(editableText.clientId, margin, yPos)
  yPos += 7
  
  const clientAddressLines = editableText.clientAddress.split('\n')
  clientAddressLines.forEach(line => {
    pdf.text(line, margin, yPos)
    yPos += 5
  })
  yPos += 20

  // Tabla de items
  const tableStartY = yPos
  const hasPrices = items.some((item) => item.price && item.price.trim() !== "")
  
  if (useImprovedLayout) {
    // Layout mejorado - Proyectos
    pdf.setFontSize(10)
    pdf.text("Descripción", margin, yPos)
    pdf.text("Cliente", margin + 100, yPos)
    yPos += 7
    
    // Línea de separación
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

    // Resumen de pagos
    const tableX = pageWidth - margin - 80
    pdf.text("Unidades", tableX, yPos)
    if (hasPrices) pdf.text("Precio x h", tableX + 25, yPos)
    pdf.text("Total", tableX + 55, yPos)
    yPos += 7
    
    pdf.line(tableX, yPos, pageWidth - margin, yPos)
    yPos += 7

    items.forEach(item => {
      pdf.text(item.units, tableX, yPos)
      if (hasPrices) pdf.text(item.price ? `${item.price} EUR` : "", tableX + 25, yPos)
      pdf.text(item.total ? `${item.total} EUR` : "", tableX + 55, yPos)
      yPos += 7
    })
  } else {
    // Layout original
    pdf.setFontSize(10)
    pdf.text("Descripción", margin, yPos)
    pdf.text("Cliente", margin + 50, yPos)
    pdf.text("Unidades", margin + 90, yPos)
    if (hasPrices) pdf.text("Precio x h", margin + 120, yPos)
    pdf.text("Total", pageWidth - margin - 30, yPos)
    yPos += 7
    
    pdf.line(margin, yPos, pageWidth - margin, yPos)
    yPos += 7

    items.forEach(item => {
      pdf.text(item.description, margin, yPos)
      pdf.text(item.client, margin + 50, yPos)
      pdf.text(item.units, margin + 90, yPos)
      if (hasPrices) pdf.text(item.price ? `${item.price} EUR` : "", margin + 120, yPos)
      pdf.text(item.total ? `${item.total} EUR` : "", pageWidth - margin - 30, yPos)
      yPos += 7
    })
  }

  // Información de pago y total al final de la página
  yPos = pageHeight - 40

  pdf.setFontSize(10)
  pdf.text("Forma de pago (Transferencia)", margin, yPos)
  yPos += 7
  pdf.text("Cuenta bancaria:", margin, yPos)
  yPos += 7
  pdf.text(editableText.bankAccount, margin, yPos)
  yPos += 10

  pdf.setLineDashPattern([2, 2], 0)
  pdf.line(margin, yPos, pageWidth - margin, yPos)
  pdf.setLineDashPattern([], 0)
  yPos += 10

  pdf.setFontSize(12)
  pdf.text(`TOTAL: ${calculateTotal()} EUR`, pageWidth - margin, yPos, { align: 'right' })
  pdf.save(`FACTURA DARWIN ELÉGIGA ${getCurrentMonthInvoiceNumber()}`)
}

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Generador de Facturas</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Entrada de Datos</h2>
          
          {/* Checkbox para layout mejorado */}
          <div className="mb-4 p-4 border rounded bg-gray-50">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="improved-layout" 
                checked={useImprovedLayout}
                onCheckedChange={(checked) => setUseImprovedLayout(checked as boolean)}
              />
              <Label htmlFor="improved-layout" className="text-sm font-medium">
                Usar layout mejorado (separa proyectos de resumen de pagos)
              </Label>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Mejora la estética separando la información de proyectos del resumen de pagos con más espacio entre columnas
            </p>
          </div>
          
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="space-y-2 p-4 border rounded">
                <div>
                  <Label htmlFor={`description-${index}`}>Descripción</Label>
                  <Input
                    id={`description-${index}`}
                    value={item.description}
                    onChange={(e) => handleItemChange(index, "description", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`units-${index}`}>Unidades</Label>
                  <Input
                    id={`units-${index}`}
                    value={item.units}
                    onChange={(e) => handleItemChange(index, "units", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`price-${index}`}>Precio por unidad (opcional)</Label>
                  <Input
                    id={`price-${index}`}
                    value={item.price}
                    onChange={(e) => handleItemChange(index, "price", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`total-${index}`}>Total</Label>
                  <Input
                    id={`total-${index}`}
                    value={item.total}
                    onChange={(e) => handleItemChange(index, "total", e.target.value)}
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
          <Button className="mt-4" onClick={exportToPDF}>
            Exportar a PDF
          </Button>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Vista Previa</h2>
          <InvoicePreview
            items={items}
            total={calculateTotal()}
            editableText={editableText}
            onEditableTextChange={handleEditableTextChange}
            useImprovedLayout={useImprovedLayout}
          />
        </div>
      </div>
    </div>
  )
}