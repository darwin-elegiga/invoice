"use client"

import { daysInMonth, totalHours, workedDays, type DayType, type TimesheetMonth } from "@/lib/timesheets"

// On-screen replica of the downloaded workbook (lib/timesheet-xlsx.ts):
// same layout and original colours. The invoiced month is highlighted only
// on screen; the file itself never carries that mark.

const DAY_FILL: Record<DayType, string> = {
  weekend: "bg-[#A5A5A5] text-white",
  holiday: "bg-[#FFFF00] text-[#FA7D00]",
  vacation: "bg-[#00B050] text-[#FA7D00]",
}

const LEGEND: [string, string][] = [
  ["Fin de Semana", "bg-[#A5A5A5]"],
  ["Día Festivo", "bg-[#FFFF00]"],
  ["Vacaciones", "bg-[#00B050]"],
]

const fmt = (n: number) => String(n).replace(".", ",")

export function TimesheetPreview({
  year,
  months,
  highlightMonth,
  workerName,
}: {
  year: number
  months: TimesheetMonth[]
  highlightMonth: number
  workerName: string
}) {
  const byMonth = new Map(months.map((m) => [m.month, m]))
  const head = "border border-[#BDBDBD] bg-[#172B4D] px-1 py-1 font-bold text-white"
  const text = "border border-[#BDBDBD] bg-white px-1 py-0.5 text-center text-[7px] leading-tight text-[#333333]"

  return (
    <div className="bg-white p-6 font-[Calibri,Arial,sans-serif]">
      <table className="border-collapse text-[9px]">
        <thead>
          <tr>
            <th className={`${head} w-28 text-[9px]`}>Trabajador</th>
            <th className={`${head} w-28 text-[8px]`}>Cliente</th>
            <th className={`${head} w-32 text-[8px]`}>Proyecto</th>
            <th className={`${head} w-8`}>Mes</th>
            <th className={`${head} w-8`}>Total</th>
            {Array.from({ length: 31 }, (_, i) => (
              <th key={i} className={`${head} w-5`}>
                {i + 1}
              </th>
            ))}
            <th className="bg-[#172B4D] px-1 py-1 font-bold text-white">Total Días</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
            const data = byMonth.get(month)
            const lastDay = daysInMonth(year, month)
            const highlighted = month === highlightMonth
            return (
              <tr key={month} className={highlighted ? "outline outline-2 -outline-offset-1 outline-sky-500" : ""}>
                <td className={text}>{data ? workerName : ""}</td>
                <td className={`${text} whitespace-pre-line`}>{data?.clients}</td>
                <td className={`${text} whitespace-pre-line`}>{data?.projects}</td>
                <td className={text}>{month}</td>
                <td className={`${text} font-bold`}>{data ? fmt(totalHours(data)) : ""}</td>
                {Array.from({ length: 31 }, (_, j) => {
                  const d = j + 1
                  const isWeekend = [0, 6].includes(new Date(year, month - 1, d).getDay())
                  const type: DayType | undefined =
                    d > lastDay || (!data && isWeekend) ? "weekend" : data?.dayTypes[d]
                  const hours = d <= lastDay ? data?.hours[d] : undefined
                  return (
                    <td
                      key={d}
                      className={`h-5 border border-[#7F7F7F] text-center font-bold ${
                        type ? DAY_FILL[type] : "bg-white text-[#FA7D00]"
                      }`}
                    >
                      {hours ? fmt(hours) : ""}
                    </td>
                  )
                })}
                <td className="border border-black bg-[#FFEB9C] px-1 text-center text-[#9C5700]">
                  {data ? workedDays(data) : ""}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="mt-8 w-56 text-[11px]">
        <div className="border-b-2 border-[#4472C4] bg-[#FFEB9C] py-1 text-center text-sm font-bold text-[#44546A]">
          Observaciones
        </div>
        {LEGEND.map(([label, fill]) => (
          <div key={label} className="flex border-b border-double border-[#4472C4]">
            <span className="flex-1 py-0.5 text-center font-bold">{label}</span>
            <span className={`w-20 ${fill}`} />
          </div>
        ))}
      </div>
    </div>
  )
}
