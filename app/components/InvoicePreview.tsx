import { formatEsNumberString } from "../utils/number-utils"
import type { PaymentMethod } from "./PaymentMethodsPanel"

interface InvoiceItem {
  description: string
  client: string
}

interface EditableTextProps {
  companyName: string
  nif: string
  address: string
  clientName: string
  clientIdLabel: string
  clientId: string
  clientAddress: string
  invoiceNumber: string
  date: string
}

export function InvoicePreview({
  items,
  units,
  price,
  total,
  editableText,
  paymentMethod,
  onEditableTextChange,
}: {
  items: InvoiceItem[]
  units: string
  price: string
  total: string
  editableText: EditableTextProps
  paymentMethod: PaymentMethod | null
  onEditableTextChange: (key: string, value: string) => void
}) {
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
          <div><span className="font-semibold">Nombre: </span>{editableText.clientName}</div>
          <div><span className="font-semibold">{editableText.clientIdLabel}: </span>{editableText.clientId}</div>
          <div><span className="font-semibold">Dirección: </span><span className="whitespace-pre-line">{editableText.clientAddress}</span></div>
        </div>

        {/* Invoice Items - Proyectos y Clientes */}
        <div className="flex-grow">
          <table className="w-full mb-8">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left py-3 pr-8 font-normal w-2/5">Proyecto</th>
                <th className="text-left py-3 pr-8 font-normal w-1/4">Cliente</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="py-3 pr-8 align-top">{item.description}</td>
                  <td className="py-3 pr-8 align-top">{item.client}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Línea divisoria */}
          <div className="border-t border-gray-300 my-6"></div>

          {/* Resumen de pagos (global) */}
          <div className="flex justify-end">
            <div className="w-1/2">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-black">
                    <th className="text-left py-2 font-normal">Unidades</th>
                    {price && <th className="text-left py-2 font-normal">Precio x h</th>}
                    <th className="text-right py-2 font-normal">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2">{units}</td>
                    {price && <td className="py-2">{formatEsNumberString(price)} EUR</td>}
                    <td className="text-right py-2">{total ? `${formatEsNumberString(total)} EUR` : ""}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Payment Info */}
        <div className="mt-auto">
          <div className="mb-8">
            <div className="border-t border-dotted border-black w-full my-4"></div>
            {paymentMethod && (
              <>
                <p className="mb-1">{paymentMethod.name}</p>
                {paymentMethod.lines.map((line, i) => (
                  <p key={i} className="mb-1 last:mb-0">
                    {line.label}: {line.value}
                  </p>
                ))}
              </>
            )}
            <div className="border-t border-dotted border-black w-full my-4"></div>
          </div>

          {/* Total */}
          <div className="text-right">
            <p className="font-normal">TOTAL: {total ? `${formatEsNumberString(total)} EUR` : ""}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
