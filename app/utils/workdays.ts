// Sugerencia de días/horas trabajadas por mes.
// Datos copiados del Excel de la empresa (CALENDARIO_VACACIONAL_2026_LYN_
// SOLUCIONES_TECNOLOGICAS, bloque "Darwin Elégiga", sección CALENDARIO MADRID).
// Si se marcan más vacaciones en el Excel hay que añadirlas aquí a mano.

export const HOURS_PER_DAY = 8

export interface CalendarHoliday {
  date: string // YYYY-MM-DD
  name: string
  tentative?: boolean
}

interface YearCalendar {
  holidays: CalendarHoliday[]
  vacations: { date: string; name: string }[]
}

const CALENDARS: Record<number, YearCalendar> = {
  2026: {
    holidays: [
      { date: "2026-01-01", name: "Año Nuevo" },
      { date: "2026-01-06", name: "Epifanía" },
      { date: "2026-04-02", name: "Jueves Santo" },
      { date: "2026-04-03", name: "Viernes Santo" },
      { date: "2026-05-01", name: "Fiesta del Trabajo" },
      { date: "2026-05-02", name: "Com. de Madrid" },
      { date: "2026-05-15", name: "San Isidro" },
      { date: "2026-08-15", name: "Asunción" },
      { date: "2026-10-12", name: "Fiesta Nacional" },
      { date: "2026-11-02", name: "Todos los Santos" },
      // Nota del Excel: por confirmar si se coge en Madrid; en Rivas se trabaja
      { date: "2026-11-09", name: "La Almudena", tentative: true },
      { date: "2026-12-07", name: "Constitución" },
      { date: "2026-12-08", name: "Inmaculada" },
      { date: "2026-12-25", name: "Navidad" },
    ],
    vacations: [
      { date: "2026-02-24", name: "Vacaciones" },
      { date: "2026-02-25", name: "Vacaciones" },
    ],
  },
}

export interface WorkdaySuggestion {
  weekdays: number
  holidays: CalendarHoliday[]
  tentativeHolidays: CalendarHoliday[]
  vacationDays: { date: string; name: string }[]
  workdaysMin: number
  workdaysMax: number
  hoursMin: number
  hoursMax: number
  hasData: boolean
}

function isWeekday(date: Date): boolean {
  const dow = date.getDay()
  return dow !== 0 && dow !== 6
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10))
  return new Date(y, m - 1, d)
}

/** Sugerencia de días laborables y horas para un mes (month0 = 0-11). */
export function getWorkdaySuggestion(year: number, month0: number): WorkdaySuggestion {
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  let weekdays = 0
  for (let d = 1; d <= daysInMonth; d++) {
    if (isWeekday(new Date(year, month0, d))) weekdays++
  }

  const calendar = CALENDARS[year]
  const inMonth = (iso: string) => {
    const date = parseIso(iso)
    return date.getFullYear() === year && date.getMonth() === month0 && isWeekday(date)
  }

  const holidays = calendar
    ? calendar.holidays.filter((h) => !h.tentative && inMonth(h.date))
    : []
  const tentativeHolidays = calendar
    ? calendar.holidays.filter((h) => h.tentative && inMonth(h.date))
    : []
  const vacationDays = calendar ? calendar.vacations.filter((v) => inMonth(v.date)) : []

  const workdaysMax = weekdays - holidays.length - vacationDays.length
  const workdaysMin = workdaysMax - tentativeHolidays.length

  return {
    weekdays,
    holidays,
    tentativeHolidays,
    vacationDays,
    workdaysMin,
    workdaysMax,
    hoursMin: workdaysMin * HOURS_PER_DAY,
    hoursMax: workdaysMax * HOURS_PER_DAY,
    hasData: Boolean(calendar),
  }
}
