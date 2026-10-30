"use client"

import { useEffect, useState } from "react"
import { ChevronRight, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { parseAddresses, type EmailSettings } from "@/lib/email"
import { PIN_RULE, PinInput } from "./LockGate"

type SettingsResponse = EmailSettings & { configured: boolean; from: string | null }

const inputClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"

/**
 * One-click send with the default recipient, subject and message; the
 * fold-out lets them be edited first. Files are produced on demand.
 */
export function EmailPanel({
  getFiles,
  subject: defaultSubject,
  monthLabel,
  invoiceNumber,
  attachmentNames,
  blockedReason,
}: {
  getFiles: () => Promise<File[] | null>
  subject: string
  monthLabel: string
  invoiceNumber: string
  attachmentNames: string[]
  // Why sending is not allowed yet (e.g. files not reviewed); null when allowed
  blockedReason: string | null
}) {
  const [settings, setSettings] = useState<SettingsResponse | null>(null)
  const [to, setTo] = useState("")
  const [cc, setCc] = useState("")
  // Once edited, the loaded defaults must not overwrite what was typed
  const [edited, setEdited] = useState({ to: false, cc: false })
  const [subject, setSubject] = useState(defaultSubject)
  const [text, setText] = useState("")
  // Two-step confirmation: 1 = review the details, 2 = final "send now"
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0)
  const [pin, setPin] = useState("")
  const [status, setStatus] = useState<
    { kind: "idle" | "sending" } | { kind: "sent"; to: string } | { kind: "error"; message: string }
  >({ kind: "idle" })

  useEffect(() => {
    fetch("/api/email/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SettingsResponse | null) => {
        if (!data) return
        setSettings(data)
        setEdited((e) => {
          if (!e.to) setTo(data.defaultTo)
          if (!e.cc) setCc(data.defaultCc)
          return e
        })
      })
      .catch(() => {})
  }, [])

  // Subject and message follow the invoiced month
  useEffect(() => setSubject(defaultSubject), [defaultSubject])
  useEffect(() => {
    if (settings) setText(settings.body.replaceAll("{mes}", monthLabel))
  }, [settings, monthLabel])

  const toList = parseAddresses(to) ?? []
  const ccList = parseAddresses(cc) ?? []

  const askToSend = () => {
    if (!parseAddresses(to)?.length) return setStatus({ kind: "error", message: "revisa el destinatario" })
    if (parseAddresses(cc) === null) return setStatus({ kind: "error", message: "revisa la copia (CC)" })
    setStatus({ kind: "idle" })
    setPin("")
    setConfirmStep(1)
  }

  const send = async () => {
    setConfirmStep(0)
    if (blockedReason || !toList.length) return
    setStatus({ kind: "sending" })
    try {
      const files = await getFiles()
      // Cancelled by the user (e.g. an empty sheet warning)
      if (!files) return setStatus({ kind: "idle" })
      const fd = new FormData()
      fd.append("to", to)
      fd.append("cc", cc)
      fd.append("subject", subject)
      fd.append("text", text)
      fd.append("invoiceNumber", invoiceNumber)
      fd.append("pin", pin)
      files.forEach((f) => fd.append("files", f))
      const res = await fetch("/api/email/send", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          err.error === "the mail server rejected the message"
            ? "el servidor de correo lo rechazó"
            : err.error === "wrong PIN"
              ? err.lockedUntil
                ? "demasiados intentos de PIN; espera antes de reintentar"
                : `PIN incorrecto${err.attemptsLeft ? ` (quedan ${err.attemptsLeft} intentos)` : ""}`
              : err.error || `HTTP ${res.status}`,
        )
      }
      setStatus({ kind: "sent", to: toList.join(", ") })
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : String(err) })
    } finally {
      setPin("")
    }
  }

  const configured = settings?.configured ?? false

  return (
    <div className="space-y-3">
      <Button
        className="w-full"
        onClick={askToSend}
        disabled={!configured || status.kind === "sending" || Boolean(blockedReason)}
        title={settings && !configured ? "Envío sin configurar (SMTP_USER / SMTP_PASSWORD)" : undefined}
      >
        <Mail className="mr-2 h-4 w-4" />
        {status.kind === "sending" ? "Enviando…" : `Enviar por correo${to ? ` a ${to}` : ""}`}
      </Button>

      {blockedReason && configured && <p className="text-xs text-zinc-500">{blockedReason}</p>}

      <AlertDialog open={confirmStep > 0} onOpenChange={(open) => !open && setConfirmStep(0)}>
        <AlertDialogContent>
          {confirmStep === 1 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Revisa el correo</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <dl className="space-y-2 text-sm text-zinc-700">
                    <div>
                      <dt className="text-xs text-zinc-500">Para</dt>
                      <dd className="font-medium">{toList.join(", ")}</dd>
                    </div>
                    {ccList.length > 0 && (
                      <div>
                        <dt className="text-xs text-zinc-500">CC</dt>
                        <dd>{ccList.join(", ")}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-xs text-zinc-500">Asunto</dt>
                      <dd>{subject}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500">Adjuntos</dt>
                      {attachmentNames.map((n) => (
                        <dd key={n}>{n}</dd>
                      ))}
                    </div>
                  </dl>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <Button onClick={() => setConfirmStep(2)}>Continuar</Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Enviar ahora?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se enviará a <strong>{toList.join(", ")}</strong> y no se puede deshacer. Escribe tu
                  PIN para confirmar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (PIN_RULE.test(pin)) send()
                }}
              >
                <PinInput value={pin} onChange={setPin} placeholder="PIN" autoFocus />
              </form>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={send} disabled={!PIN_RULE.test(pin)}>
                  Sí, enviar
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {status.kind === "sent" && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Enviado a {status.to}. Te llega una copia a {settings?.from}.
        </p>
      )}
      {status.kind === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">No se envió: {status.message}.</p>
      )}
      {settings && !configured && (
        <p className="text-xs text-amber-700">
          El envío no está configurado: faltan <code>SMTP_USER</code> y <code>SMTP_PASSWORD</code>.
        </p>
      )}

      <Collapsible>
        <CollapsibleTrigger className="group flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900">
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90" />
          Editar correo
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-3">
          {settings?.from && <p className="text-xs text-zinc-500">Desde {settings.from}</p>}
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">Para</span>
            <input
              className={inputClass}
              value={to}
              onChange={(e) => {
                setTo(e.target.value)
                setEdited((x) => ({ ...x, to: true }))
              }}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">CC (opcional)</span>
            <input
              className={inputClass}
              value={cc}
              onChange={(e) => {
                setCc(e.target.value)
                setEdited((x) => ({ ...x, cc: true }))
              }}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">Asunto</span>
            <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">Mensaje</span>
            <textarea rows={6} className={`${inputClass} resize-none`} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
