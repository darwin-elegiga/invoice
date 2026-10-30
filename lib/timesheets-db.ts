import { sql } from "@/lib/db"
import type { TimesheetMonth } from "@/lib/timesheets"

export async function listTimesheetMonths(year: number): Promise<TimesheetMonth[]> {
  const rows = await sql`
    select year, month, clients, projects, hours, day_types as "dayTypes",
           to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "updatedAt"
    from timesheet_months where year = ${year} order by month
  `
  return rows as TimesheetMonth[]
}

export async function saveTimesheetMonth(month: TimesheetMonth) {
  await sql`
    insert into timesheet_months (year, month, clients, projects, hours, day_types, updated_at)
    values (${month.year}, ${month.month}, ${month.clients}, ${month.projects},
            ${JSON.stringify(month.hours)}::jsonb, ${JSON.stringify(month.dayTypes)}::jsonb, now())
    on conflict (year, month) do update set
      clients = excluded.clients, projects = excluded.projects,
      hours = excluded.hours, day_types = excluded.day_types, updated_at = now()
  `
}
