// Imports an existing "Parte de horas" workbook into the app through its API.
// Usage: node scripts/import-timesheet.mjs <file.xlsx> <year> [baseUrl]
import ExcelJS from "exceljs"

const [file, yearArg, baseUrl = "http://localhost:3000"] = process.argv.slice(2)
const year = Number(yearArg)
if (!file || !Number.isInteger(year)) {
  console.error("Usage: node scripts/import-timesheet.mjs <file.xlsx> <year> [baseUrl]")
  process.exit(1)
}

const FIRST_DAY_COL = 6
const FILL_TYPES = { FFA5A5A5: "weekend", FFFFFF00: "holiday", FF00B050: "vacation" }

const workbook = new ExcelJS.Workbook()
await workbook.xlsx.readFile(file)
const sheet = workbook.worksheets[0]

const text = (cell) => {
  const v = cell.value
  if (v && typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("")
  return v == null ? "" : String(v).trim()
}

for (let r = 2; r <= 13; r++) {
  const row = sheet.getRow(r)
  const month = Number(row.getCell(4).value)
  if (!Number.isInteger(month) || month < 1 || month > 12) continue
  const lastDay = new Date(year, month, 0).getDate()
  const hours = {}
  const dayTypes = {}
  for (let d = 1; d <= lastDay; d++) {
    const cell = row.getCell(FIRST_DAY_COL + d - 1)
    const value = Number(typeof cell.value === "object" && cell.value ? cell.value.result : cell.value)
    if (value > 0) hours[d] = value
    const type = FILL_TYPES[cell.fill?.fgColor?.argb]
    if (type) dayTypes[d] = type
  }
  if (Object.keys(hours).length === 0) continue

  const body = {
    year,
    month,
    clients: text(row.getCell(2)),
    projects: text(row.getCell(3)),
    hours,
    dayTypes,
  }
  const res = await fetch(`${baseUrl}/api/timesheets`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const total = Object.values(hours).reduce((a, b) => a + b, 0)
  console.log(`${year}-${String(month).padStart(2, "0")}: ${total} h, ${Object.keys(hours).length} días -> ${res.status}`)
}
