"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DAY_TYPE_LABELS,
  buildDefaultMonth,
  daysInMonth,
  timesheetFileName,
  totalHours,
  workedDays,
  type DayType,
  type TimesheetMonth,
} from "@/lib/timesheets"

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"]

// Softer on screen than in the spreadsheet; the .xlsx keeps the original colours
const DAY_TYPE_CELL: Record<DayType, string> = {
  weekend: "bg-zinc-100 text-zinc-400",
  holiday: "bg-amber-100 text-amber-800",
  vacation: "bg-emerald-100 text-emerald-800",
}
const DAY_TYPE_DOT: Record<DayType, string> = {
  weekend: "bg-zinc-300",
  holiday: "bg-amber-400",
  vacation: "bg-emerald-500",
}

type Brush =
  | { kind: "hours"; hours: number }
  | { kind: "type"; type: DayType }
  | { kind: "clear" }

const sameBrush = (a: Brush, b: Brush) => JSON.stringify(a) === JSON.stringify(b)
const formatHours = (h: number) => String(h).replace(".", ",")

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

export default function TimesheetPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [months, setMonths] = useState<TimesheetMonth[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<TimesheetMonth | null>(null)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [brush, setBrush] = useState<Brush>({ kind: "hours", hours: 8 })
  const [customHours, setCustomHours] = useState("6")
  const [painting, setPainting] = useState(false)

  // ?year=2026&month=10 opens a given month (linked from the invoice page)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const y = Number(params.get("year"))
    const m = Number(params.get("month"))
    if (Number.isInteger(y) && y > 2000) setYear(y)
    if (Number.isInteger(m) && m >= 1 && m <= 12) setMonth(m)
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/timesheets?year=${year}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setMonths(Array.isArray(data) ? data : []))
      .catch(() => setMonths([]))
      .finally(() => setLoading(false))
  }, [year])

  const saved = months.find((m) => m.month === month) ?? null

  // Switching month (or reloading) discards unsaved edits of the previous one
  useEffect(() => {
    setDraft(saved ? structuredClone(saved) : null)
    setDirty(false)
    setStatus("idle")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, months])

  useEffect(() => {
    const stop = () => setPainting(false)
    window.addEventListener("mouseup", stop)
    return () => window.removeEventListener("mouseup", stop)
  }, [])

  const shiftMonth = (delta: number) => {
    if (dirty && !window.confirm("Hay cambios sin guardar. ¿Cambiar de mes igualmente?")) return
    const index = year * 12 + (month - 1) + delta
    setYear(Math.floor(index / 12))
    setMonth((index % 12) + 1)
  }

  const updateDraft = (next: TimesheetMonth) => {
    setDraft(next)
    setDirty(true)
    setStatus("idle")
  }

  const paint = (day: number) => {
    if (draft) updateDraft(applyBrush(draft, day, brush))
  }

  const createFromCalendar = async () => {
    // Lines come from the invoice of that month, or else the latest invoice
    let lines: { project: string; client: string }[] = []
    try {
      const res = await fetch("/api/invoices")
      const records: { year: number; month: number; fileType: string; items: typeof lines }[] =
        res.ok ? await res.json() : []
      const withItems = records.filter((r) => r.fileType === "pdf" && r.items.length > 0)
      const match = withItems.find((r) => r.year === year && r.month === month) ?? withItems[0]
      lines = match?.items ?? []
    } catch {}
    updateDraft(buildDefaultMonth(year, month, lines))
  }

  const resetToCalendar = () => {
    if (!draft) return
    if (!window.confirm("¿Volver a rellenar el mes con el calendario? Se perderán las horas editadas.")) return
    const fresh = buildDefaultMonth(year, month, [])
    updateDraft({ ...draft, hours: fresh.hours, dayTypes: fresh.dayTypes })
  }

  const save = async () => {
    if (!draft) return false
    setStatus("saving")
    try {
      const res = await fetch("/api/timesheets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      if (!res.ok) throw new Error()
      setMonths(await res.json())
      setStatus("saved")
      return true
    } catch {
      setStatus("error")
      return false
    }
  }

  const download = async () => {
    if (dirty && !(await save())) return
    window.location.href = `/api/timesheets/xlsx?year=${year}&month=${month}`
  }

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
  const fieldClass =
    "w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <header className="mb-10 flex items-center justify-between text-sm">
          <h1 className="text-lg font-semibold tracking-tight">Parte de horas</h1>
          <nav className="flex gap-5 text-zinc-500">
            <Link href="/" className="hover:text-zinc-900">
              Facturas
            </Link>
            <Link href="/historial" className="hover:text-zinc-900">
              Historial
            </Link>
          </nav>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Mes anterior"
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                onClick={() => shiftMonth(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2 className="min-w-40 text-center text-xl font-semibold tracking-tight">
                {MONTHS[month - 1]} <span className="font-normal text-zinc-400">{year}</span>
              </h2>
              <button
                type="button"
                aria-label="Mes siguiente"
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                onClick={() => shiftMonth(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {draft && (
              <div className="text-right">
                <div className="text-2xl font-semibold tabular-nums">
                  {formatHours(totalHours(draft))} <span className="text-base font-normal text-zinc-400">h</span>
                </div>
                <div className="text-xs text-zinc-500">{workedDays(draft)} días</div>
              </div>
            )}
          </div>

          {loading && !draft ? (
            <p className="py-16 text-center text-sm text-zinc-400">Cargando…</p>
          ) : !draft ? (
            <div className="py-12 text-center">
              <p className="mb-4 text-sm text-zinc-500">Este mes todavía no tiene parte de horas.</p>
              <Button onClick={createFromCalendar}>Crear desde el calendario</Button>
              <p className="mx-auto mt-3 max-w-sm text-xs text-zinc-400">
                8 h en cada día laborable, con fines de semana, festivos y vacaciones marcados, y los
                proyectos de la factura.
              </p>
            </div>
          ) : (
            <div className="space-y-8 select-none">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-zinc-500">Clientes</span>
                  <textarea
                    rows={2}
                    placeholder="Uno por línea"
                    className={`${fieldClass} select-text`}
                    value={draft.clients}
                    onChange={(e) => updateDraft({ ...draft, clients: e.target.value })}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-zinc-500">Proyectos</span>
                  <textarea
                    rows={2}
                    placeholder="Uno por línea, en el mismo orden"
                    className={`${fieldClass} select-text`}
                    value={draft.projects}
                    onChange={(e) => updateDraft({ ...draft, projects: e.target.value })}
                  />
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-1 rounded-lg bg-zinc-100 p-1 text-sm">
                  {brushes.map(({ label, brush: b, dot }) => (
                    <button
                      key={label}
                      type="button"
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
                        sameBrush(brush, b)
                          ? "bg-white text-zinc-900 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-900"
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
                    const type = draft.dayTypes[d]
                    const hours = draft.hours[d]
                    return (
                      <button
                        key={d}
                        type="button"
                        title={type ? DAY_TYPE_LABELS[type] : undefined}
                        className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-all hover:ring-2 hover:ring-zinc-300 sm:aspect-[4/3] ${
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
                        <span className="absolute left-1.5 top-1 text-[10px] text-zinc-400">{d}</span>
                        <span className="font-semibold tabular-nums">{hours ? formatHours(hours) : ""}</span>
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

              <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-6">
                <button
                  type="button"
                  className="text-sm text-zinc-500 hover:text-zinc-900"
                  onClick={resetToCalendar}
                >
                  Rellenar con el calendario
                </button>
                <span className="ml-auto text-xs text-zinc-400">
                  {dirty && status !== "saving" && "Cambios sin guardar"}
                  {status === "saved" && !dirty && "Guardado"}
                  {status === "error" && <span className="text-red-600">No se pudo guardar</span>}
                </span>
                <Button variant="outline" onClick={download} disabled={status === "saving"}>
                  <Download className="mr-2 h-4 w-4" /> Excel
                </Button>
                <Button onClick={save} disabled={status === "saving" || !dirty}>
                  {status === "saving" ? "Guardando…" : "Guardar"}
                </Button>
              </div>
              <p className="-mt-4 text-right text-xs text-zinc-400">
                Incluye todo {year} · {timesheetFileName(year, month)}
              </p>
            </div>
          )}
        </section>

        <section className="mt-10">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">{year}</h3>
          <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
            {MONTHS.map((name, i) => {
              const m = months.find((x) => x.month === i + 1)
              const active = i + 1 === month
              return (
                <li key={name}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-4 px-5 py-3 text-left text-sm hover:bg-zinc-50 ${
                      active ? "bg-zinc-50" : ""
                    }`}
                    onClick={() => {
                      if (i + 1 !== month) shiftMonth(i + 1 - month)
                    }}
                  >
                    <span className={`w-24 ${active ? "font-semibold" : m ? "text-zinc-700" : "text-zinc-400"}`}>
                      {name}
                    </span>
                    <span className="hidden flex-1 gap-0.5 sm:flex">
                      {Array.from({ length: daysInMonth(year, i + 1) }, (_, j) => {
                        const type = m?.dayTypes[j + 1]
                        const worked = Number(m?.hours[j + 1]) > 0
                        return (
                          <span
                            key={j}
                            className={`h-1.5 flex-1 rounded-full ${
                              type ? DAY_TYPE_DOT[type] : worked ? "bg-zinc-800" : "bg-zinc-100"
                            }`}
                          />
                        )
                      })}
                    </span>
                    <span className="ml-auto w-16 text-right tabular-nums text-zinc-500 sm:ml-0">
                      {m ? `${formatHours(totalHours(m))} h` : "—"}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
