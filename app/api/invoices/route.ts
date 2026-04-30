import { NextResponse } from "next/server"
import crypto from "crypto"
import { put } from "@vercel/blob"
import { redis, KV_KEYS } from "@/lib/storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export type InvoiceRecord = {
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

async function readIndex(): Promise<InvoiceRecord[]> {
  const stored = await redis.get<InvoiceRecord[]>(KV_KEYS.invoices)
  return Array.isArray(stored) ? stored : []
}

async function writeIndex(records: InvoiceRecord[]) {
  await redis.set(KV_KEYS.invoices, records)
}

export async function GET() {
  const records = await readIndex()
  records.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return NextResponse.json(records)
}

export async function POST(request: Request) {
  const form = await request.formData()
  const file = form.get("file")
  const date = String(form.get("date") ?? "").trim()
  const invoiceNumber = String(form.get("invoiceNumber") ?? "").trim()
  const total = String(form.get("total") ?? "").trim()
  const clientName = String(form.get("clientName") ?? "").trim()
  const notes = String(form.get("notes") ?? "").trim()

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PDF file is required" }, { status: 400 })
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 })
  }
  if (!invoiceNumber) {
    return NextResponse.json({ error: "invoiceNumber is required" }, { status: 400 })
  }
  if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "file must be a PDF" }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_")
  const blobPath = `invoices/${id}__${safeName}`
  const blob = await put(blobPath, file, {
    access: "public",
    contentType: "application/pdf",
  })

  const [yearStr, monthStr] = date.split("-")
  const record: InvoiceRecord = {
    id,
    invoiceNumber,
    date,
    year: Number(yearStr),
    month: Number(monthStr),
    total,
    clientName,
    notes,
    fileName: file.name,
    blobUrl: blob.url,
    blobPath: blob.pathname,
    uploadedAt: new Date().toISOString(),
  }

  const records = await readIndex()
  records.push(record)
  await writeIndex(records)

  return NextResponse.json(record, { status: 201 })
}
