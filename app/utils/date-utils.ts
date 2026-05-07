export function getInvoiceNumberForDate(date: Date = new Date()): string {
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  return `${month}-${year}`
}

export function getCurrentMonthInvoiceNumber(): string {
  return getInvoiceNumberForDate(new Date())
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]

export function getInvoiceNameForDate(date: Date = new Date()): string {
  return `${MESES[date.getMonth()].toUpperCase()} ${date.getFullYear()}`
}

export function getCurrentMonthInvoiceName(): string {
  return getInvoiceNameForDate(new Date())
}

export function getLastDayOfMonthForDate(date: Date = new Date()): string {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return `${lastDay.getDate()}/${lastDay.getMonth() + 1}/${lastDay.getFullYear()}`
}

export function getLastDayOfMonth(): string {
  return getLastDayOfMonthForDate(new Date())
}

export function getLastDayIsoForDate(date: Date = new Date()): string {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const y = lastDay.getFullYear()
  const m = String(lastDay.getMonth() + 1).padStart(2, "0")
  const d = String(lastDay.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function toIsoDate(input: string): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`
}

export function fromIsoDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  const [, y, mo, d] = m
  return `${parseInt(d, 10)}/${parseInt(mo, 10)}/${y}`
}

export function isoToDate(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const [, y, mo, d] = m
  return new Date(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10))
}

