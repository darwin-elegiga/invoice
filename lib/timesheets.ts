import { HOURS_PER_DAY, getDefaultDayTypes, type DayType } from "@/app/utils/workdays"

export type { DayType }

export const WORKER_NAME = "Darwin Alejandro Elégiga López"

// One row of the yearly hours sheet. Keys of hours/dayTypes are day numbers.
export type TimesheetMonth = {
  year: number
  month: number // 1-12
  clients: string // one per line, same order as projects
  projects: string
  hours: Record<string, number>
  dayTypes: Record<string, DayType>
  updatedAt?: string
}

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  weekend: "Fin de semana",
  holiday: "Día festivo",
  vacation: "Vacaciones",
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

export function totalHours(month: Pick<TimesheetMonth, "hours">) {
  return Object.values(month.hours).reduce((sum, h) => sum + (Number(h) || 0), 0)
}

export function workedDays(month: Pick<TimesheetMonth, "hours">) {
  return Object.values(month.hours).filter((h) => Number(h) > 0).length
}

export function timesheetFileName(year: number, month: number) {
  return `Parte de horas DARWIN ELÉGIGA ${month}-${year}.xlsx`
}

/** New month: calendar day types and a full day on every working day. */
export function buildDefaultMonth(
  year: number,
  month: number,
  lines: { project: string; client: string }[],
): TimesheetMonth {
  const dayTypes = getDefaultDayTypes(year, month - 1) as Record<string, DayType>
  const hours: Record<string, number> = {}
  for (let d = 1; d <= daysInMonth(year, month); d++) {
    if (!dayTypes[d]) hours[d] = HOURS_PER_DAY
  }
  const filled = lines.filter((l) => l.project || l.client)
  return {
    year,
    month,
    clients: filled.map((l) => l.client).join("\n"),
    projects: filled.map((l) => l.project).join("\n"),
    hours,
    dayTypes,
  }
}

export function cleanTimesheetMonth(body: unknown): TimesheetMonth | null {
  const b = body as Partial<TimesheetMonth> | null
  const year = Number(b?.year)
  const month = Number(b?.month)
  if (!Number.isInteger(year) || year < 2000 || !Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }
  const maxDay = daysInMonth(year, month)
  const hours: Record<string, number> = {}
  for (const [day, value] of Object.entries(b?.hours ?? {})) {
    const d = Number(day)
    const h = Number(value)
    if (Number.isInteger(d) && d >= 1 && d <= maxDay && h > 0 && h <= 24) hours[d] = h
  }
  const dayTypes: Record<string, DayType> = {}
  for (const [day, type] of Object.entries(b?.dayTypes ?? {})) {
    const d = Number(day)
    if (Number.isInteger(d) && d >= 1 && d <= maxDay && type in DAY_TYPE_LABELS) {
      dayTypes[d] = type as DayType
    }
  }
  return {
    year,
    month,
    clients: String(b?.clients ?? "").trim(),
    projects: String(b?.projects ?? "").trim(),
    hours,
    dayTypes,
  }
}
