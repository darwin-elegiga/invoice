import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import crypto from "crypto"

const DATA_DIR = path.join(process.cwd(), "data")
const INDEX_FILE = path.join(DATA_DIR, "invoices.json")
const FILES_DIR = path.join(DATA_DIR, "invoices-files")

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
  uploadedAt: string
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

async function writeIndex(records: InvoiceRecord[]) {
  await fs.writeFile(INDEX_FILE, JSON.stringify(records, null, 2) + "\n", "utf-8")
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

  await fs.mkdir(FILES_DIR, { recursive: true })

  const id = crypto.randomUUID()
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_")
  const storedName = `${id}__${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(path.join(FILES_DIR, storedName), buffer)

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
    fileName: storedName,
    uploadedAt: new Date().toISOString(),
  }

  const records = await readIndex()
  records.push(record)
  await writeIndex(records)

  return NextResponse.json(record, { status: 201 })
}
