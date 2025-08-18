export function getCurrentMonthInvoiceNumber(): string {
  const date = new Date()
  const month = date.getMonth() + 1 // JavaScript months are 0-based
  const year = date.getFullYear()
  const x= 0;
  return `${month}-${year}`
}
export function getCurrentMonthInvoiceName(): string {
  const date = new Date()
  const monthIndex = date.getMonth() 
  const year = date.getFullYear()

  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ]

  const nombreMes = meses[monthIndex]
  return `${nombreMes.toUpperCase()} ${year}`
}

export function getLastDayOfMonth(): string {
  const date = new Date()
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const day = lastDay.getDate()
  const month = lastDay.getMonth() + 1
  const year = lastDay.getFullYear()
  return `${day}/${month}/${year}`
}

