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

interface InvoiceItem {
  description: string
  units: string
  price?: string
  total: string
}

export default function InvoiceGenerator() {
  const [items, setItems] = useState<InvoiceItem[]>([{ description: "", units: "", price: "", total: "" }])
  const [editableText, setEditableText] = useState({
    companyName: "LYN Soluciones Tecnológicas S.L",
    nif: "B72652290",
    bankAccount: "ES46 2100 3211 0422 0040 1276",
    address:
      "c/ Marie Curie 9-15, Edificio B-Bioma, 4ª planta, oficina 415,\n28521, Rivas Vaciamadrid,\nMADRID\nESPAÑA",
    clientName: "Darwin Alejandro Elégiga López",
    clientId: "02100682665",
    clientAddress: "Calle Martí # 162, Palma Soriano, Santiago de Cuba, Cuba",
    invoiceNumber: getCurrentMonthInvoiceNumber(),
    date: getLastDayOfMonth(),
  })

  useEffect(() => {
    // Update invoice number and date at the start of each month
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
    setItems([...items, { description: "", units: "", price: "", total: "" }])
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
      scale: 2,
      useCORS: true,
      logging: false,
    })

    const imgData = canvas.toDataURL("image/png")
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const imgProps = pdf.getImageProperties(imgData)
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight)
    pdf.save("invoice.pdf")
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Generador de Facturas</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Entrada de Datos</h2>
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
          />
        </div>
      </div>
    </div>
  )
}

