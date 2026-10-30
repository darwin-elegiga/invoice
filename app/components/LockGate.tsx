"use client"

import { useCallback, useEffect, useState } from "react"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"

type Session = {
  configured: boolean
  unlocked: boolean
  lockedUntil: number
  canSetup: boolean
}

export const PIN_RULE = /^\d{4,12}$/

const inputClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-center text-lg tracking-[0.4em] text-zinc-900 placeholder:text-sm placeholder:tracking-normal placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"

export function PinInput({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  autoFocus?: boolean
}) {
  return (
    <input
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={12}
      autoFocus={autoFocus}
      placeholder={placeholder}
      className={inputClass}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
    />
  )
}

function formatWait(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  if (s >= 3600) return `${Math.ceil(s / 3600)} h`
  return s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`
}

// Re-check the session regularly so an expired one locks the screen again
const RECHECK_MS = 5 * 60 * 1000

/**
 * Covers the whole app with a blurred PIN screen until the session is
 * unlocked. The pages only mount once unlocked, so they never fetch data
 * without a session (the APIs would refuse anyway: see middleware.ts).
 */
export function LockGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [pin, setPin] = useState("")
  const [pinConfirm, setPinConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())

  const loadSession = useCallback(
    () =>
      fetch("/api/settings/session", { cache: "no-store" })
        .then((res) => res.json())
        .then((data: Session) => {
          setSession(data)
          setNow(Date.now())
        })
        .catch(() => setError("No se pudo comprobar el candado")),
    [],
  )

  useEffect(() => {
    loadSession()
    const timer = setInterval(loadSession, RECHECK_MS)
    window.addEventListener("focus", loadSession)
    return () => {
      clearInterval(timer)
      window.removeEventListener("focus", loadSession)
    }
  }, [loadSession])

  useEffect(() => {
    if (!session?.lockedUntil) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [session?.lockedUntil])

  if (session?.unlocked) return <>{children}</>

  const lockedFor = session?.lockedUntil ? session.lockedUntil - now : 0

  const submit = async (url: string) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json().catch(() => ({}))
      setPin("")
      setPinConfirm("")
      if (res.ok) return loadSession()
      if (data.lockedUntil) {
        setSession((s) => s && { ...s, lockedUntil: data.lockedUntil })
        setNow(Date.now())
      } else if (typeof data.attemptsLeft === "number") {
        setError(
          data.attemptsLeft > 0
            ? `PIN incorrecto. ${data.attemptsLeft} ${data.attemptsLeft === 1 ? "intento" : "intentos"} antes del bloqueo.`
            : "PIN incorrecto.",
        )
      } else {
        setError("No se pudo completar.")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-100">
      {/* Abstract, data-free backdrop that reads as the app behind frosted glass */}
      <div aria-hidden className="absolute inset-0 scale-110 blur-2xl">
        <div className="absolute left-[8%] top-[12%] h-72 w-96 rounded-3xl bg-white" />
        <div className="absolute left-[12%] top-[52%] h-56 w-80 rounded-3xl bg-white" />
        <div className="absolute right-[10%] top-[10%] h-[70%] w-[38%] rounded-3xl bg-white" />
        <div className="absolute right-[30%] top-[20%] h-40 w-40 rounded-full bg-sky-100" />
        <div className="absolute bottom-[10%] left-[40%] h-40 w-56 rounded-full bg-emerald-50" />
      </div>
      <div className="absolute inset-0 bg-zinc-50/40 backdrop-blur-xl" />

      <div className="relative flex min-h-screen items-center justify-center px-4">
        <section className="w-full max-w-xs rounded-3xl border border-white/60 bg-white/80 p-8 text-center shadow-xl backdrop-blur">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900">
            <Lock className="h-5 w-5 text-white" />
          </div>

          {!session ? (
            <p className="text-sm text-zinc-500">{error ?? "Comprobando…"}</p>
          ) : session.configured ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (pin && lockedFor <= 0) submit("/api/settings/unlock")
              }}
            >
              <div>
                <h1 className="font-semibold text-zinc-900">Facturas LYN</h1>
                <p className="mt-1 text-xs text-zinc-500">Introduce tu PIN para entrar</p>
              </div>
              <PinInput value={pin} onChange={setPin} placeholder="PIN" autoFocus />
              {lockedFor > 0 ? (
                <p className="text-sm text-amber-700">
                  Demasiados intentos. Prueba de nuevo en {formatWait(lockedFor)}.
                </p>
              ) : (
                error && <p className="text-sm text-red-600">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={busy || !pin || lockedFor > 0}>
                {busy ? "Comprobando…" : "Entrar"}
              </Button>
            </form>
          ) : session.canSetup ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (!PIN_RULE.test(pin)) return setError("El PIN debe tener de 4 a 12 dígitos.")
                if (pin !== pinConfirm) return setError("Los PIN no coinciden.")
                submit("/api/settings/setup")
              }}
            >
              <div>
                <h1 className="font-semibold text-zinc-900">Crea tu PIN</h1>
                <p className="mt-1 text-xs text-zinc-500">De 4 a 12 dígitos. Evita 1234 o fechas.</p>
              </div>
              <PinInput value={pin} onChange={setPin} placeholder="Nuevo PIN" autoFocus />
              <PinInput value={pinConfirm} onChange={setPinConfirm} placeholder="Repite el PIN" />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Guardando…" : "Crear PIN"}
              </Button>
            </form>
          ) : (
            <div className="space-y-2">
              <h1 className="font-semibold text-zinc-900">PIN sin configurar</h1>
              <p className="text-sm text-zinc-500">
                Por seguridad, el primer PIN solo se puede crear abriendo la app en local.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export async function lockNow() {
  await fetch("/api/settings/lock", { method: "POST" })
  window.location.reload()
}
