// Optional sending of the exported files by email. Shared by client and server.

export type EmailSettings = {
  // Pre-filled each time; every field can still be changed before sending
  defaultTo: string
  defaultCc: string
  // {mes} is replaced by e.g. "octubre 2026"
  body: string
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  defaultTo: "administracion@lynsoluciones.es",
  defaultCc: "",
  body: "Hola,\n\nAdjunto el parte de horas y la factura de {mes}.\n\nMuchas gracias,\nDarwin Alejandro",
}

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

/** Splits "a@x.com, b@y.com" into addresses; null if any is invalid. */
export function parseAddresses(value: string): string[] | null {
  const list = value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
  return list.every((a) => EMAIL_RE.test(a)) ? list : null
}

export function withEmailDefaults(stored: Partial<EmailSettings> | null | undefined): EmailSettings {
  return {
    defaultTo:
      typeof stored?.defaultTo === "string" && stored.defaultTo.trim()
        ? stored.defaultTo
        : DEFAULT_EMAIL_SETTINGS.defaultTo,
    defaultCc: typeof stored?.defaultCc === "string" ? stored.defaultCc : DEFAULT_EMAIL_SETTINGS.defaultCc,
    body: typeof stored?.body === "string" && stored.body.trim() ? stored.body : DEFAULT_EMAIL_SETTINGS.body,
  }
}

export function cleanEmailSettings(body: unknown): EmailSettings | null {
  const b = body as Partial<EmailSettings> | null
  const defaultTo = String(b?.defaultTo ?? "").trim()
  const defaultCc = String(b?.defaultCc ?? "").trim()
  const text = String(b?.body ?? "").trim()
  if (parseAddresses(defaultTo) === null || parseAddresses(defaultCc) === null) return null
  if (!text || text.length > 5000) return null
  return { defaultTo, defaultCc, body: text }
}
