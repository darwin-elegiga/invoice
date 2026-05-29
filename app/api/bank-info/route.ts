import { NextResponse } from "next/server"
import { redis, KV_KEYS } from "@/lib/storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const FIELDS = [
  "bankName",
  "swiftBic",
  "beneficiary",
  "bankAccount",
  "cci",
  "bankAddress",
  "cardHolder",
  "cardLast4",
  "cardBrand",
  "paymentLink",
  "paymentPlatform",
  "wuName",
  "wuAddress",
  "wuPostalCode",
  "wuPassport",
  "wuPhone",
] as const

type BankInfo = Record<(typeof FIELDS)[number], string>

const DEFAULTS: BankInfo = {
  bankName: "BBVA Perú",
  swiftBic: "BCONPEPL",
  beneficiary: "Grisel Rosabal Safonts",
  bankAccount: "0011-0814-0291745585",
  cci: "011-814-000291745585-15",
  bankAddress: "Calle 4 Nro 110, Dpto 4A, 15088, Lima, Perú",
  cardHolder: "",
  cardLast4: "",
  cardBrand: "",
  paymentLink: "",
  paymentPlatform: "",
  wuName: "",
  wuAddress: "",
  wuPostalCode: "",
  wuPassport: "",
  wuPhone: "",
}

function withDefaults(stored: Partial<BankInfo> | null): BankInfo {
  const result = {} as BankInfo
  for (const field of FIELDS) {
    result[field] = stored?.[field] ?? DEFAULTS[field]
  }
  return result
}

export async function GET() {
  const stored = await redis.get<Partial<BankInfo>>(KV_KEYS.bankInfo)
  return NextResponse.json(withDefaults(stored))
}

export async function PUT(request: Request) {
  const body = await request.json()
  const current = withDefaults(await redis.get<Partial<BankInfo>>(KV_KEYS.bankInfo))
  const next: BankInfo = { ...current }
  for (const field of FIELDS) {
    if (typeof body[field] === "string") {
      next[field] = body[field]
    }
  }
  await redis.set(KV_KEYS.bankInfo, next)
  return NextResponse.json(next)
}
