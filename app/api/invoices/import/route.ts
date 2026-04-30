import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const INDEX_FILE = path.join(DATA_DIR, "invoices.json")

type InvoiceRecord = {
  id: string
  invoiceNumber: string
  date: string
  year: number
  month: number
  total: string
  clientName: string
  notes: string
  fileName: string
  uploadedAt: string
}

const REQUIRED_KEYS: (keyof InvoiceRecord)[] = [
  "id", "invoiceNumber", "date", "year", "month", "fileName",
]

function isValidRecord(value: unknown): value is InvoiceRecord {
  if (!value || typeof value !== "object") return false
  const r = value as Record<string, unknown>
  for (const k of REQUIRED_KEYS) {
    if (!(k in r)) return false
  }
  return (
    typeof r.id === "string" &&
    typeof r.invoiceNumber === "string" &&
    typeof r.date === "string" &&
    typeof r.year === "number" &&
    typeof r.month === "number" &&
    typeof r.fileName === "string"
  )
}

function normalize(r: InvoiceRecord): InvoiceRecord {
  return {
    id: r.id,
    invoiceNumber: r.invoiceNumber,
    date: r.date,
    year: r.year,
    month: r.month,
    total: r.total ?? "",
    clientName: r.clientName ?? "",
    notes: r.notes ?? "",
    fileName: r.fileName,
    uploadedAt: r.uploadedAt ?? new Date().toISOString(),
  }
}

async function readIndex(): Promise<InvoiceRecord[]> {
  try {
    const raw = await fs.readFile(INDEX_FILE, "utf-8")
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Expected an array of records" }, { status: 400 })
  }

  const incoming: InvoiceRecord[] = []
  const skipped: unknown[] = []
  for (const item of body) {
    if (isValidRecord(item)) incoming.push(normalize(item))
    else skipped.push(item)
  }

  const current = await readIndex()
  const byId = new Map<string, InvoiceRecord>()
  for (const r of current) byId.set(r.id, r)
  let added = 0
  let updated = 0
  for (const r of incoming) {
    if (byId.has(r.id)) updated++
    else added++
    byId.set(r.id, r)
  }
  const merged = Array.from(byId.values())
  await fs.writeFile(INDEX_FILE, JSON.stringify(merged, null, 2) + "\n", "utf-8")

  return NextResponse.json({
    total: merged.length,
    added,
    updated,
    skipped: skipped.length,
  })
}
