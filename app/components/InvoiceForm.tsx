import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"

interface InvoiceItem {
  description: string
  units: string
  price?: string
  total: string
  client: string
}

interface EditableTextProps {
  companyName: string
  nif: string
  bankName: string
  swiftBic: string
  beneficiary: string
  bankAccount: string
  cci: string
  bankAddress: string
  address: string
  clientName: string
  clientId: string
  clientAddress: string
  invoiceNumber: string
  date: string
}

interface InvoiceFormProps {
  items: InvoiceItem[]
  editableText: EditableTextProps
  onItemChange: (index: number, field: keyof InvoiceItem, value: string) => void
  onEditableTextChange: (key: string, value: string) => void
  onAddItem: () => void
  onRemoveItem: (index: number) => void
}

export function InvoiceForm({
  items,
  editableText,
  onItemChange,
  onEditableTextChange,
  onAddItem,
  onRemoveItem,
}: InvoiceFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div>
          <Label>Número de Factura</Label>
          <Input
            value={editableText.invoiceNumber}
            onChange={(e) => onEditableTextChange("invoiceNumber", e.target.value)}
          />
        </div>
        <div>
          <Label>Fecha</Label>
          <Input value={editableText.date} onChange={(e) => onEditableTextChange("date", e.target.value)} />
        </div>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="space-y-2 p-4 border rounded">
            <div>
              <Label htmlFor={`description-${index}`}>Descripción</Label>
              <Input
                id={`description-${index}`}
                value={item.description}
                onChange={(e) => onItemChange(index, "description", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`units-${index}`}>Unidades</Label>
              <Input
                id={`units-${index}`}
                value={item.units}
                onChange={(e) => onItemChange(index, "units", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`price-${index}`}>Precio por unidad (opcional)</Label>
              <Input
                id={`price-${index}`}
                value={item.price}
                onChange={(e) => onItemChange(index, "price", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`total-${index}`}>Total</Label>
              <Input
                id={`total-${index}`}
                value={item.total}
                onChange={(e) => onItemChange(index, "total", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`client-${index}`}>Cliente</Label>
              <Input
                id={`client-${index}`}
                value={item.client}
                onChange={(e) => onItemChange(index, "client", e.target.value)}
              />
            </div>
            {index > 0 && (
              <Button variant="destructive" onClick={() => onRemoveItem(index)}>
                Eliminar
              </Button>
            )}
          </div>
        ))}
        <Button onClick={onAddItem} className="w-full">
          <PlusCircle className="mr-2 h-4 w-4" /> Agregar Item
        </Button>
      </div>
    </div>
  )
}

