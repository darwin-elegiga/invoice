"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import { AppHeader } from "@/app/components/AppHeader"
import { Button } from "@/components/ui/button"
import {
  DAY_TYPE_DOT,
  TimesheetEditor,
  formatHours,
  type CatalogEntry,
} from "@/app/components/TimesheetEditor"
import {
  buildDefaultMonth,
  daysInMonth,
  timesheetFileName,
  totalHours,
  workedDays,
  type TimesheetMonth,
} from "@/lib/timesheets"
import { useProfile } from "@/hooks/use-profile"
import { linesForNewMonth } from "@/lib/timesheet-lines"

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

export default function TimesheetPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [months, setMonths] = useState<TimesheetMonth[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<TimesheetMonth | null>(null)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const profile = useProfile()

  // ?year=2026&month=10 opens a given month
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const y = Number(params.get("year"))
    const m = Number(params.get("month"))
    if (Number.isInteger(y) && y > 2000) setYear(y)
    if (Number.isInteger(m) && m >= 1 && m <= 12) setMonth(m)
    fetch("/api/catalog")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCatalog(Array.isArray(data) ? data : []))
      .catch(() => {})
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

  const createFromCalendar = async () =>
    updateDraft(buildDefaultMonth(year, month, await linesForNewMonth(year, month)))

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

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <AppHeader title="Parte de horas" />

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
                proyectos del mes anterior.
              </p>
            </div>
          ) : (
            <>
              <TimesheetEditor value={draft} onChange={updateDraft} catalog={catalog} />
              <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-6">
                <button type="button" className="text-sm text-zinc-500 hover:text-zinc-900" onClick={resetToCalendar}>
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
              <p className="mt-2 text-right text-xs text-zinc-400">
                Incluye todo {year} · {timesheetFileName(year, month, profile.shortName)}
              </p>
            </>
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
