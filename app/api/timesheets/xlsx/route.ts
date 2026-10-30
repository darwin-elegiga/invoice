import { timesheetFileName } from "@/lib/timesheets"
import { listTimesheetMonths } from "@/lib/timesheets-db"
import { buildTimesheetXlsx } from "@/lib/timesheet-xlsx"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// The whole year goes in one file; `month` only sets the file name, which
// follows the month being sent ("Parte de horas DARWIN ELÉGIGA 10-2026").
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const year = Number(params.get("year"))
  const month = Number(params.get("month"))
  if (!Number.isInteger(year) || year < 2000 || !Number.isInteger(month) || month < 1 || month > 12) {
    return Response.json({ error: "year and month are required" }, { status: 400 })
  }
  const buffer = await buildTimesheetXlsx(year, await listTimesheetMonths(year))
  const fileName = timesheetFileName(year, month)
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName.normalize("NFD").replace(/[^\x20-\x7e]/g, "")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}
