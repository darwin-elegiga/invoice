import { NextResponse } from "next/server"
import { cleanTimesheetMonth } from "@/lib/timesheets"
import { listTimesheetMonths, saveTimesheetMonth } from "@/lib/timesheets-db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const year = Number(new URL(request.url).searchParams.get("year"))
  if (!Number.isInteger(year) || year < 2000) {
    return NextResponse.json({ error: "year is required" }, { status: 400 })
  }
  return NextResponse.json(await listTimesheetMonths(year))
}

export async function PUT(request: Request) {
  const month = cleanTimesheetMonth(await request.json().catch(() => null))
  if (!month) return NextResponse.json({ error: "invalid month" }, { status: 400 })
  await saveTimesheetMonth(month)
  return NextResponse.json(await listTimesheetMonths(month.year))
}
