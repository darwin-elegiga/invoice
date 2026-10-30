import { timesheetLines, type TimesheetLine, type TimesheetMonth } from "@/lib/timesheets"

const filledLines = (m: TimesheetMonth) => timesheetLines(m).filter((l) => l.project || l.client)

/**
 * Project/client lines barely change, so a new month starts with the lines
 * of the closest previous month that has a sheet (looking back up to a year).
 * Client-side helper: it calls the timesheet API.
 */
export async function linesForNewMonth(year: number, month: number): Promise<TimesheetLine[]> {
  const fetchYear = async (y: number): Promise<TimesheetMonth[]> => {
    const res = await fetch(`/api/timesheets?year=${y}`)
    return res.ok ? res.json() : []
  }
  try {
    const sheets = [...(await fetchYear(year - 1)), ...(await fetchYear(year))]
    const target = year * 12 + month
    const previous = sheets
      .filter((m) => m.year * 12 + m.month < target)
      .sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month))
      .find((m) => filledLines(m).length > 0)
    return previous ? filledLines(previous) : []
  } catch {
    return []
  }
}
