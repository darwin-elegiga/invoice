// Data printed on every invoice: who issues it (me) and who receives it
// (the company). Editable from the PIN-protected settings page.
export type Profile = {
  fullName: string
  idLabel: string
  idNumber: string
  address: string
  // Used in file names and the email subject, e.g. "DARWIN ELÉGIGA"
  shortName: string
  companyName: string
  companyNif: string
  companyAddress: string
  // EUR per hour; the invoice total is hours × rate
  hourlyRate: number
}

export const DEFAULT_PROFILE: Profile = {
  fullName: "Darwin Alejandro Elégiga López",
  idLabel: "Pasaporte",
  idNumber: "L547719",
  address: "Carrera 12B 7B-17, Melgar, Tolima, Colombia",
  shortName: "DARWIN ELÉGIGA",
  companyName: "LYN Soluciones Tecnológicas S.L",
  companyNif: "B72652290",
  companyAddress:
    "c/ Marie Curie 9-15, Edificio B-Bioma, 4ª planta, oficina 409,\n28521, Rivas Vaciamadrid,\nMADRID\nESPAÑA",
  hourlyRate: 6,
}

type TextField = Exclude<keyof Profile, "hourlyRate">
export const PROFILE_TEXT_FIELDS = (Object.keys(DEFAULT_PROFILE) as (keyof Profile)[]).filter(
  (k): k is TextField => k !== "hourlyRate",
)

const isValidRate = (n: unknown): n is number => typeof n === "number" && n > 0 && n <= 1000

export function withProfileDefaults(stored: Partial<Profile> | null | undefined): Profile {
  const profile = { ...DEFAULT_PROFILE }
  for (const key of PROFILE_TEXT_FIELDS) {
    const value = stored?.[key]
    if (typeof value === "string" && value.trim()) profile[key] = value
  }
  const rate = stored?.hourlyRate
  if (isValidRate(rate)) profile.hourlyRate = rate
  return profile
}

export function cleanProfile(body: unknown): Profile | null {
  if (!body || typeof body !== "object") return null
  const b = body as Record<string, unknown>
  const profile = {} as Profile
  for (const key of PROFILE_TEXT_FIELDS) {
    const value = typeof b[key] === "string" ? (b[key] as string).trim() : ""
    if (!value || value.length > 500) return null
    profile[key] = value
  }
  const rate = Math.round(Number(b.hourlyRate) * 100) / 100
  if (!isValidRate(rate)) return null
  profile.hourlyRate = rate
  return profile
}
