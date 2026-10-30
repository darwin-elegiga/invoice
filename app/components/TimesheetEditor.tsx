"use client"

import { useEffect, useState } from "react"
import { Plus, X } from "lucide-react"
import {
  DAY_TYPE_LABELS,
  daysInMonth,
  timesheetLines,
  type DayType,
  type TimesheetLine,
  type TimesheetMonth,
} from "@/lib/timesheets"

// Saved project/client pair (from /api/catalog), offered for reuse
export type CatalogEntry = { id: number; project: string; client: string }

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"]

// Softer on screen than in the spreadsheet; the .xlsx keeps the original colours
export const DAY_TYPE_CELL: Record<DayType, string> = {
  weekend: "bg-zinc-100 text-zinc-400",
  holiday: "bg-amber-100 text-amber-800",
  vacation: "bg-emerald-100 text-emerald-800",
}
export const DAY_TYPE_DOT: Record<DayType, string> = {
  weekend: "bg-zinc-300",
  holiday: "bg-amber-400",
  vacation: "bg-emerald-500",
}

type Brush =
  | { kind: "hours"; hours: number }
  | { kind: "type"; type: DayType }
  | { kind: "clear" }

const sameBrush = (a: Brush, b: Brush) => JSON.stringify(a) === JSON.stringify(b)
export const formatHours = (h: number) => String(h).replace(".", ",")
const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

function withLines(month: TimesheetMonth, lines: TimesheetLine[]): TimesheetMonth {
  return {
    ...month,
    projects: lines.map((l) => l.project).join("\n"),
    clients: lines.map((l) => l.client).join("\n"),
  }
}

function applyBrush(month: TimesheetMonth, day: number, brush: Brush): TimesheetMonth {
  const hours = { ...month.hours }
  const dayTypes = { ...month.dayTypes }
  if (brush.kind === "hours") {
    hours[day] = brush.hours
    // Working a holiday or a vacation day turns it into a normal day;
    // weekends keep their colour like in the original sheet.
    if (dayTypes[day] !== "weekend") delete dayTypes[day]
  } else if (brush.kind === "type") {
    dayTypes[day] = brush.type
    delete hours[day]
  } else {
    delete hours[day]
    delete dayTypes[day]
  }
  return { ...month, hours, dayTypes }
}

const fieldClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"

export function TimesheetEditor({
  value,
  onChange,
  catalog = [],
}: {
  value: TimesheetMonth
  onChange: (next: TimesheetMonth) => void
  catalog?: CatalogEntry[]
}) {
  const [brush, setBrush] = useState<Brush>({ kind: "hours", hours: 8 })
  const [customHours, setCustomHours] = useState("6")
  const [painting, setPainting] = useState(false)

  useEffect(() => {
    const stop = () => setPainting(false)
    window.addEventListener("mouseup", stop)
    return () => window.removeEventListener("mouseup", stop)
  }, [])

  const { year, month } = value
  const lines = timesheetLines(value)
  const setLines = (next: TimesheetLine[]) => onChange(withLines(value, next))

  const updateLine = (index: number, field: keyof TimesheetLine, text: string) => {
    const next = lines.map((l, i) => (i === index ? { ...l, [field]: text } : l))
    // Picking a known project fills in its client when none was typed yet
    if (field === "project" && !next[index].client) {
      const match = catalog.find((e) => e.project === text)
      if (match) next[index].client = match.client
    }
    setLines(next)
  }

  const inLines = (e: CatalogEntry) =>
    lines.some((l) => sameText(l.project, e.project) && sameText(l.client, e.client))

  const reuse = (e: CatalogEntry) => {
    if (inLines(e)) return
    const emptyIndex = lines.findIndex((l) => !l.project && !l.client)
    const filled = { project: e.project, client: e.client }
    setLines(emptyIndex === -1 ? [...lines, filled] : lines.map((l, i) => (i === emptyIndex ? filled : l)))
  }

  const paint = (day: number) => onChange(applyBrush(value, day, brush))

  const dayCount = daysInMonth(year, month)
  // Monday-first offset of the 1st of the month
  const leadingBlanks = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const brushes: { label: string; brush: Brush; dot?: string }[] = [
    { label: "8 h", brush: { kind: "hours", hours: 8 } },
    { label: "4 h", brush: { kind: "hours", hours: 4 } },
    { label: "Festivo", brush: { kind: "type", type: "holiday" }, dot: DAY_TYPE_DOT.holiday },
    { label: "Vacaciones", brush: { kind: "type", type: "vacation" }, dot: DAY_TYPE_DOT.vacation },
    { label: "Fin de semana", brush: { kind: "type", type: "weekend" }, dot: DAY_TYPE_DOT.weekend },
    { label: "Borrar", brush: { kind: "clear" } },
  ]
  const customBrush: Brush = { kind: "hours", hours: Number(customHours.replace(",", ".")) || 0 }
  const suggestions = catalog.filter((e) => !inLines(e)).slice(0, 6)

  return (
    <div className="space-y-8 select-none">
      <div className="space-y-3">
        <span className="text-xs font-medium text-zinc-500">Proyectos y clientes del mes</span>
        <datalist id="ts-projects">
          {Array.from(new Set(catalog.map((e) => e.project))).map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <datalist id="ts-clients">
          {Array.from(new Set(catalog.map((e) => e.client))).map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                aria-label="Proyecto"
                placeholder="Proyecto"
                list="ts-projects"
                autoComplete="off"
                className={`${fieldClass} select-text`}
                value={line.project}
                onChange={(e) => updateLine(i, "project", e.target.value)}
              />
              <input
                aria-label="Cliente"
                placeholder="Cliente"
                list="ts-clients"
                autoComplete="off"
                className={`${fieldClass} select-text`}
                value={line.client}
                onChange={(e) => updateLine(i, "client", e.target.value)}
              />
              <button
                type="button"
                aria-label="Quitar línea"
                className="rounded-md p-2 text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
                onClick={() => setLines(lines.filter((_, j) => j !== i))}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            className="flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-3 py-1 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900"
            onClick={() => setLines([...lines, { project: "", client: "" }])}
          >
            <Plus className="h-3.5 w-3.5" /> Añadir
          </button>
          {suggestions.map((e) => (
            <button
              key={e.id}
              type="button"
              className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
              onClick={() => reuse(e)}
            >
              {e.project} · {e.client}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-zinc-100 p-1 text-sm">
          {brushes.map(({ label, brush: b, dot }) => (
            <button
              key={label}
              type="button"
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
                sameBrush(brush, b) ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
              }`}
              onClick={() => setBrush(b)}
            >
              {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
              {label}
            </button>
          ))}
          <span
            className={`flex items-center gap-1 rounded-md px-2 py-0.5 ${
              sameBrush(brush, customBrush) ? "bg-white shadow-sm" : ""
            }`}
          >
            <input
              aria-label="Horas personalizadas"
              className="w-10 bg-transparent text-right text-zinc-900 select-text focus:outline-none"
              value={customHours}
              onFocus={() => customBrush.hours > 0 && setBrush(customBrush)}
              onChange={(e) => {
                setCustomHours(e.target.value)
                const h = Number(e.target.value.replace(",", "."))
                if (h > 0) setBrush({ kind: "hours", hours: h })
              }}
            />
            <span className="text-zinc-500">h</span>
          </span>
        </div>
        <p className="text-xs text-zinc-400">Elige una opción y toca o arrastra sobre los días.</p>
      </div>

      <div>
        <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-zinc-400">
          {WEEKDAYS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => {
            const type = value.dayTypes[d]
            const hours = value.hours[d]
            return (
              <button
                key={d}
                type="button"
                title={type ? DAY_TYPE_LABELS[type] : undefined}
                className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-sm transition-all hover:ring-2 hover:ring-zinc-300 sm:aspect-[4/3] ${
                  type ? DAY_TYPE_CELL[type] : "border border-zinc-200 bg-white text-zinc-900"
                }`}
                onMouseDown={() => {
                  setPainting(true)
                  paint(d)
                }}
                onMouseEnter={() => painting && paint(d)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    paint(d)
                  }
                }}
              >
                {/* Day number above the hours so two-digit days never touch them */}
                <span className="text-[9px] leading-none text-zinc-400">{d}</span>
                <span className="min-h-5 font-semibold leading-5 tabular-nums">{hours ? formatHours(hours) : ""}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
          {(Object.keys(DAY_TYPE_LABELS) as DayType[]).map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${DAY_TYPE_DOT[t]}`} />
              {DAY_TYPE_LABELS[t]}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
