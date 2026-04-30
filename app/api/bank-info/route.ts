import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

const FILE_PATH = path.join(process.cwd(), "data", "bank-info.json")

const FIELDS = [
  "bankName",
  "swiftBic",
  "beneficiary",
  "bankAccount",
  "cci",
  "bankAddress",
] as const

type BankInfo = Record<(typeof FIELDS)[number], string>

async function readBankInfo(): Promise<BankInfo> {
  const raw = await fs.readFile(FILE_PATH, "utf-8")
  return JSON.parse(raw)
}

export async function GET() {
  const data = await readBankInfo()
  return NextResponse.json(data)
}

export async function PUT(request: Request) {
  const body = await request.json()
  const current = await readBankInfo()
  const next: BankInfo = { ...current }
  for (const field of FIELDS) {
    if (typeof body[field] === "string") {
      next[field] = body[field]
    }
  }
  await fs.writeFile(FILE_PATH, JSON.stringify(next, null, 2) + "\n", "utf-8")
  return NextResponse.json(next)
}
