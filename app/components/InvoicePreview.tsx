
interface InvoiceItem {
  description: string
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
  cardHolder: string
  cardLast4: string
  cardBrand: string
  paymentLink: string
  paymentPlatform: string
  wuName: string
  wuAddress: string
  wuPostalCode: string
  wuPassport: string
  wuPhone: string
  address: string
  clientName: string
  clientId: string
  clientAddress: string
  invoiceNumber: string
  date: string
}

type PaymentMethod = "transferencia" | "tarjeta" | "enlace" | "western"

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
  paymentMethod: PaymentMethod
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
          <div><span className="font-semibold">Pasaporte: </span>{editableText.clientId}</div>
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
                    {price && <td className="py-2">{price} EUR</td>}
                    <td className="text-right py-2">{total ? `${total} EUR` : ""}</td>
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
            {paymentMethod === "transferencia" && (
              <>
                <p className="mb-1">Forma de pago (Transferencia Internacional)</p>
                <p className="mb-1">Banco: {editableText.bankName}</p>
                <p className="mb-1">SWIFT/BIC: {editableText.swiftBic}</p>
                <p className="mb-1">Beneficiario: {editableText.beneficiary}</p>
                <p className="mb-1">Cuenta: {editableText.bankAccount}</p>
                <p className="mb-1">CCI: {editableText.cci}</p>
                <p>Dirección: {editableText.bankAddress}</p>
              </>
            )}
            {paymentMethod === "tarjeta" && (
              <>
                <p className="mb-1">Forma de pago (Tarjeta)</p>
                {editableText.cardBrand && <p className="mb-1">Marca: {editableText.cardBrand}</p>}
                {editableText.cardHolder && <p className="mb-1">Titular: {editableText.cardHolder}</p>}
                {editableText.cardLast4 && (
                  <p className="mb-1">Tarjeta: **** **** **** {editableText.cardLast4}</p>
                )}
              </>
            )}
            {paymentMethod === "enlace" && (
              <>
                <p className="mb-1">Forma de pago (Enlace de pago)</p>
                {editableText.paymentPlatform && (
                  <p className="mb-1">Plataforma: {editableText.paymentPlatform}</p>
                )}
                {editableText.paymentLink && (
                  <p className="mb-1 break-all">
                    Enlace:{" "}
                    <a
                      id="invoice-payment-link"
                      href={editableText.paymentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      {editableText.paymentLink}
                    </a>
                  </p>
                )}
              </>
            )}
            {paymentMethod === "western" && (
              <>
                <p className="mb-1">Forma de pago (Western Union)</p>
                {editableText.wuName && <p className="mb-1">Nombre y apellidos: {editableText.wuName}</p>}
                {editableText.wuAddress && <p className="mb-1">Dirección: {editableText.wuAddress}</p>}
                {editableText.wuPostalCode && (
                  <p className="mb-1">Código postal: {editableText.wuPostalCode}</p>
                )}
                {editableText.wuPassport && <p className="mb-1">Pasaporte: {editableText.wuPassport}</p>}
                {editableText.wuPhone && <p className="mb-1">Teléfono: {editableText.wuPhone}</p>}
              </>
            )}
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
