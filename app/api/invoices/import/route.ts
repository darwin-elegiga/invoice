import { NextResponse } from "next/server"
import { redis, KV_KEYS } from "@/lib/storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
  blobUrl: string
  blobPath: string
  uploadedAt: string
}

const REQUIRED_KEYS: (keyof InvoiceRecord)[] = [
  "id", "invoiceNumber", "date", "year", "month", "fileName",
]

function isValidRecord(value: unknown): value is Partial<InvoiceRecord> & {
  id: string
  invoiceNumber: string
  date: string
  year: number
  month: number
  fileName: string
} {
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

function normalize(r: Partial<InvoiceRecord> & {
  id: string
  invoiceNumber: string
  date: string
  year: number
  month: number
  fileName: string
}): InvoiceRecord {
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
    blobUrl: r.blobUrl ?? "",
    blobPath: r.blobPath ?? "",
    uploadedAt: r.uploadedAt ?? new Date().toISOString(),
  }
}

async function readIndex(): Promise<InvoiceRecord[]> {
  const stored = await redis.get<InvoiceRecord[]>(KV_KEYS.invoices)
  return Array.isArray(stored) ? stored : []
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
  await redis.set(KV_KEYS.invoices, merged)

  return NextResponse.json({
    total: merged.length,
    added,
    updated,
    skipped: skipped.length,
  })
}
