export function getCurrentMonthInvoiceNumber(): string {
  const date = new Date()
  const month = date.getMonth() + 1 // JavaScript months are 0-based
  const year = date.getFullYear()
  const x= 0;
  return `${month}-${year}`
}

export function getLastDayOfMonth(): string {
  const date = new Date()
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const day = lastDay.getDate()
  const month = lastDay.getMonth() + 1
  const year = lastDay.getFullYear()
  return `${day}/${month}/${year}`
}

