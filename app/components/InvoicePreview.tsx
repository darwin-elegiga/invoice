interface EditableTextProps {
  companyName: string
  nif: string
  bankAccount: string
  address: string
  clientName: string
  clientId: string
  clientAddress: string
  invoiceNumber: string
  date: string
}

interface InvoiceItem {
  description: string
  units: string
  price?: string
  total: string
  client: string
}

interface InvoicePreviewProps {
  items: InvoiceItem[]
  total: string
  editableText: EditableTextProps
  onEditableTextChange: (key: string, value: string) => void
}

export function InvoicePreview({ items, total, editableText, onEditableTextChange }: InvoicePreviewProps) {
  // Verificar si al menos un ítem tiene precio
  const hasPrices = items.some((item) => item.price && item.price.trim() !== "")

  return (
    <div id="invoice-preview" className="bg-white w-[210mm] min-h-[297mm] p-[20mm] mx-auto">
      <div className="flex flex-col min-h-full">
        {/* Header Section with Invoice Number and Date */}
        <div className="text-right mb-16">
          <div className="inline-block">
            <div className="flex justify-end whitespace-nowrap mb-1">
              <span className="mr-1">Factura:</span>
              <span>{editableText.invoiceNumber}</span>
            </div>
            <div className="flex justify-end whitespace-nowrap">
              <span className="mr-1">Fecha:</span>
              <span>{editableText.date}</span>
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className="text-right mb-24">
          <div className="inline-block text-right">
            <div className="mb-1">{editableText.companyName}</div>
            <div className="mb-1 whitespace-nowrap">
              <span className="mr-1">NIF:</span>
              <span>{editableText.nif}</span>
            </div>
            <div className="whitespace-pre-line max-w-[300px] ml-auto">{editableText.address}</div>
          </div>
        </div>

        {/* Client Info */}
        <div className="mb-24">
          <div>{editableText.clientName}</div>
          <div>{editableText.clientId}</div>
          <div className="whitespace-pre-line">{editableText.clientAddress}</div>
        </div>

        {/* Invoice Items */}
        <div className="flex-grow">
          <table className="w-full mb-16">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left py-2 font-normal">Descripción</th>
                <th className="text-left py-2 font-normal">Cliente</th>
                <th className="text-left py-2 font-normal">Unidades</th>
                {hasPrices && <th className="text-left py-2 font-normal">Precio x h</th>}
                <th className="text-right py-2 font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="py-2">{item.description}</td>
                  <td className="py-2">{item.client}</td>
                  <td className="py-2">{item.units}</td>
                  {hasPrices && <td className="py-2">{item.price ? `${item.price} EUR` : ""}</td>}
                  <td className="text-right py-2">{item.total ? `${item.total} EUR` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Payment Info */}
        <div className="mt-auto">
          <div className="mb-8">
            <p className="mb-1">Forma de pago (Transferencia)</p>
            <p className="mb-1">Cuenta bancaria:</p>
            <p>{editableText.bankAccount}</p>
            <div className="border-t border-dotted border-black w-full my-4"></div>
          </div>

          {/* Total */}
          <div className="text-right">
            <p className="font-normal">TOTAL: {total ? `${total} EUR` : ""}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

