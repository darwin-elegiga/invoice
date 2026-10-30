"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { AppHeader } from "../components/AppHeader"
import { PIN_RULE, PinInput } from "../components/LockGate"
import { PaymentMethodsPanel, type PaymentMethod } from "../components/PaymentMethodsPanel"
import { DEFAULT_PROFILE, withProfileDefaults, type Profile } from "@/lib/profile"

const inputClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"

// An expired session locks the app again; reloading shows the PIN screen
const onExpired = () => window.location.reload()

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <AppHeader title="Ajustes" />
        <UnlockedSettings />
      </div>
    </div>
  )
}

function UnlockedSettings() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [rateText, setRateText] = useState(String(DEFAULT_PROFILE.hourlyRate))
  const [profileStatus, setProfileStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [selectedMethod, setSelectedMethod] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        const loaded = withProfileDefaults(data)
        setProfile(loaded)
        setRateText(String(loaded.hourlyRate))
      })
      .catch(() => {})
    fetch("/api/payment-methods")
      .then((res) => res.json())
      .then((data: PaymentMethod[]) => {
        setMethods(data)
        setSelectedMethod((data.find((m) => m.isDefault) ?? data[0])?.id ?? null)
      })
      .catch(() => {})
  }, [])

  const set = (key: Exclude<keyof Profile, "hourlyRate">) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProfile({ ...profile, [key]: e.target.value })
    setProfileStatus("idle")
  }

  const saveProfile = async () => {
    setProfileStatus("saving")
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    }).catch(() => null)
    if (res?.status === 401) return onExpired()
    setProfileStatus(res?.ok ? "saved" : "error")
  }

  const field = (label: string, key: Exclude<keyof Profile, "hourlyRate">, multiline = false) => (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      {multiline ? (
        <textarea rows={4} className={`${inputClass} resize-none`} value={profile[key]} onChange={set(key)} />
      ) : (
        <input className={inputClass} value={profile[key]} onChange={set(key)} />
      )}
    </label>
  )

  return (
    <div className="space-y-8">
      <section className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
        <div>
          <h2 className="text-sm font-semibold">Datos de la factura</h2>
          <p className="mt-1 text-xs text-zinc-500">Lo que aparece en la plantilla del PDF y en el Excel.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400">Mis datos</h3>
            {field("Nombre completo", "fullName")}
            <div className="grid grid-cols-[7rem_1fr] gap-2">
              {field("Documento", "idLabel")}
              {field("Número", "idNumber")}
            </div>
            {field("Dirección", "address", true)}
            {field("Nombre corto (archivos y asunto)", "shortName")}
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400">Empresa</h3>
            {field("Razón social", "companyName")}
            {field("NIF", "companyNif")}
            {field("Dirección", "companyAddress", true)}
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-500">Precio por hora (EUR)</span>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                className={inputClass}
                value={rateText}
                onChange={(e) => {
                  setRateText(e.target.value)
                  setProfile({ ...profile, hourlyRate: Number(e.target.value) })
                  setProfileStatus("idle")
                }}
              />
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-zinc-100 pt-5">
          <span className="text-xs text-zinc-400">
            {profileStatus === "saved" && "Guardado"}
            {profileStatus === "error" && <span className="text-red-600">Revisa que ningún campo esté vacío y que el precio sea mayor que 0</span>}
          </span>
          <Button onClick={saveProfile} disabled={profileStatus === "saving"}>
            {profileStatus === "saving" ? "Guardando…" : "Guardar datos"}
          </Button>
        </div>
      </section>

      <PaymentMethodsPanel
        methods={methods}
        selectedId={selectedMethod}
        onSelect={setSelectedMethod}
        onMethodsChange={setMethods}
        editable
        defaultOpen
      />

      <ChangePin />
    </div>
  )
}

function ChangePin() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!PIN_RULE.test(next)) return setMessage({ ok: false, text: "El nuevo PIN debe tener de 4 a 12 dígitos." })
    if (next !== confirm) return setMessage({ ok: false, text: "Los PIN nuevos no coinciden." })
    setBusy(true)
    const res = await fetch("/api/settings/pin", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPin: current, newPin: next }),
    }).catch(() => null)
    setBusy(false)
    const data = await res?.json().catch(() => ({}))
    if (res?.ok) {
      setCurrent("")
      setNext("")
      setConfirm("")
      return setMessage({ ok: true, text: "PIN cambiado." })
    }
    if (res?.status === 401 && data?.error === "locked") return onExpired()
    setMessage({
      ok: false,
      text: data?.lockedUntil ? "Demasiados intentos. Espera unos minutos." : "El PIN actual no es correcto.",
    })
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
      <h2 className="text-sm font-semibold">Cambiar PIN</h2>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-3">
        <PinInput value={current} onChange={setCurrent} placeholder="PIN actual" />
        <PinInput value={next} onChange={setNext} placeholder="Nuevo PIN" />
        <PinInput value={confirm} onChange={setConfirm} placeholder="Repite el nuevo" />
        <div className="flex items-center justify-end gap-3 sm:col-span-3">
          {message && (
            <span className={`text-xs ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</span>
          )}
          <Button type="submit" variant="outline" disabled={busy || !current}>
            {busy ? "Cambiando…" : "Cambiar PIN"}
          </Button>
        </div>
      </form>
    </section>
  )
}
