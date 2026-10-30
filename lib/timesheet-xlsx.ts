import ExcelJS from "exceljs"
import {
  daysInMonth,
  totalHours,
  workedDays,
  type DayType,
  type TimesheetMonth,
} from "@/lib/timesheets"

// Layout and colours copied from the "Parte de horas" sheet used in 2026:
// one row per month, days 1-31 in columns F..AJ, totals in E and AK.
const FIRST_DAY_COL = 6
const TOTAL_DAYS_COL = FIRST_DAY_COL + 31
const MONTH_ROW_OFFSET = 1 // month 1 lives in row 2
const LEGEND_ROW = 17

const COLORS = {
  header: "FF172B4D",
  white: "FFFFFFFF",
  text: "FF333333",
  hours: "FFFA7D00",
  weekend: "FFA5A5A5",
  holiday: "FFFFFF00",
  vacation: "FF00B050",
  totalDaysFill: "FFFFEB9C",
  totalDaysText: "FF9C5700",
  legendTitle: "FF44546A",
}

const DAY_FILLS: Record<DayType, string> = {
  weekend: COLORS.weekend,
  holiday: COLORS.holiday,
  vacation: COLORS.vacation,
}

const COLUMN_WIDTHS = [
  23.71, 22, 26.14, 6.43, 6.43, 4, 4.29, 4.43, 4, 4.14, 4.14, 3.86, 3.86, 3.86, 4.43, 4.29, 4.43,
  3.71, 4, 4.43, 5.14, 4.43, 4.29, 5.43, 4.71, 4.29, 4.71, 4.71, 4.43, 4.86, 4.71, 4.71, 5.14,
  4.29, 4.43, 5, 11, 12.43,
]

const solid = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } })
const line = (style: ExcelJS.BorderStyle, argb: string) => ({ style, color: { argb } })
const thinGrey = line("thin", "FF7F7F7F")
const mediumLight = line("medium", "FFBDBDBD")
const thinBlack = line("thin", "FF000000")
const center: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true }

export async function buildTimesheetXlsx(year: number, months: TimesheetMonth[], workerName: string) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Hoja1", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  COLUMN_WIDTHS.forEach((width, i) => (sheet.getColumn(i + 1).width = width))

  const header = sheet.getRow(1)
  header.height = 14.25
  const headerLabels = ["Trabajador", "Cliente", "Proyecto", "Mes", "Total"]
  for (let d = 1; d <= 31; d++) headerLabels.push(String(d))
  headerLabels.push("Total Días")
  headerLabels.forEach((label, i) => {
    const cell = header.getCell(i + 1)
    cell.value = /^\d+$/.test(label) ? Number(label) : label
    cell.fill = solid(COLORS.header)
    cell.font = { name: "Arial", bold: true, size: i === 1 || i === 2 ? 10 : 11, color: { argb: COLORS.white } }
    cell.alignment = center
    if (i + 1 !== TOTAL_DAYS_COL) cell.border = { left: mediumLight, right: mediumLight, top: mediumLight }
  })

  const byMonth = new Map(months.map((m) => [m.month, m]))
  for (let month = 1; month <= 12; month++) {
    const r = month + MONTH_ROW_OFFSET
    const row = sheet.getRow(r)
    const data = byMonth.get(month)
    const lineCount = Math.max(1, ...[data?.clients, data?.projects].map((t) => (t ? t.split("\n").length : 1)))
    row.height = lineCount > 1 ? 12 * lineCount + 4 : 14.25

    const textFont = { name: "Arial", size: 7, color: { argb: COLORS.text } }
    const textBorder = { left: mediumLight, right: mediumLight, top: thinBlack, bottom: mediumLight }
    const textCells: [number, ExcelJS.CellValue][] = [
      [1, data ? workerName : null],
      [2, data?.clients || null],
      [3, data?.projects || null],
      [4, month],
    ]
    for (const [col, value] of textCells) {
      const cell = row.getCell(col)
      cell.value = value
      cell.fill = solid(COLORS.white)
      cell.font = textFont
      cell.alignment = center
      cell.border = col === 1 ? { ...textBorder, left: thinBlack } : textBorder
    }

    const firstDay = row.getCell(FIRST_DAY_COL).address
    const lastDay = row.getCell(FIRST_DAY_COL + 30).address
    const total = row.getCell(5)
    total.value = data ? { formula: `SUM(${firstDay}:${lastDay})`, result: totalHours(data) } : null
    total.fill = solid(COLORS.white)
    total.font = { ...textFont, bold: true }
    total.alignment = center
    total.border = textBorder

    const lastValidDay = daysInMonth(year, month)
    for (let d = 1; d <= 31; d++) {
      const cell = row.getCell(FIRST_DAY_COL + d - 1)
      // Days past the end of the month are greyed out like weekends,
      // and empty months still show their weekends.
      const isWeekend = [0, 6].includes(new Date(year, month - 1, d).getDay())
      const type: DayType | undefined =
        d > lastValidDay || (!data && isWeekend) ? "weekend" : data?.dayTypes[d]
      const hours = data?.hours[d]
      cell.value = hours ? hours : null
      cell.alignment = { horizontal: "center" }
      if (type === "weekend") {
        cell.fill = solid(COLORS.weekend)
        cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.white } }
        cell.border = { left: line("double", "FF3F3F3F"), right: line("double", "FF3F3F3F"), top: line("double", "FF3F3F3F"), bottom: line("double", "FF3F3F3F") }
      } else {
        cell.fill = solid(type ? DAY_FILLS[type] : COLORS.white)
        cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.hours } }
        cell.border = { left: thinGrey, right: thinGrey, top: thinGrey, bottom: thinGrey }
      }
    }

    const totalDays = row.getCell(TOTAL_DAYS_COL)
    totalDays.value = data ? { formula: `COUNT(${firstDay}:${lastDay})`, result: workedDays(data) } : null
    totalDays.fill = solid(COLORS.totalDaysFill)
    totalDays.font = { name: "Calibri", size: 11, color: { argb: COLORS.totalDaysText } }
    totalDays.alignment = center
    totalDays.border = { left: thinBlack, right: thinBlack, top: thinBlack, bottom: thinBlack }
  }

  const title = sheet.getCell(LEGEND_ROW, 1)
  title.value = "Observaciones"
  title.fill = solid(COLORS.totalDaysFill)
  title.font = { name: "Calibri", size: 15, bold: true, color: { argb: COLORS.legendTitle } }
  title.alignment = { horizontal: "center" }
  title.border = { bottom: line("thick", "FF4472C4") }
  sheet.getRow(LEGEND_ROW).height = 20.25

  const legend: [string, string][] = [
    ["Fin de Semana", COLORS.weekend],
    ["Día Festivo", COLORS.holiday],
    ["Vacaciones", COLORS.vacation],
  ]
  legend.forEach(([label, color], i) => {
    const r = LEGEND_ROW + 1 + i
    const border = { top: line("thin", "FF4472C4"), bottom: line("double", "FF4472C4") }
    const labelCell = sheet.getCell(r, 1)
    labelCell.value = label
    labelCell.font = { name: "Calibri", size: 11, bold: true }
    labelCell.alignment = { horizontal: "center" }
    labelCell.border = border
    const swatch = sheet.getCell(r, 2)
    swatch.fill = solid(color)
    swatch.border = border
  })

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
