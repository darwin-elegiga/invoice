import { NextResponse } from "next/server"
import { redis, KV_KEYS } from "@/lib/storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const FIELDS = [
  "bankName",
  "swiftBic",
  "beneficiary",
  "bankAccount",
  "accountType",
  "currency",
] as const

type BankInfo = Record<(typeof FIELDS)[number], string>

const DEFAULTS: BankInfo = {
  bankName: "BBVA Colombia",
  swiftBic: "GEROCOBB",
  beneficiary: "DARWIN ALEJANDRO ELEGIGA LOPEZ",
  bankAccount: "00130390000200009106",
  accountType: "Cuenta de ahorros",
  currency: "COP",
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
