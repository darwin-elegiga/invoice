import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const INDEX_FILE = path.join(DATA_DIR, "invoices.json")
const FILES_DIR = path.join(DATA_DIR, "invoices-files")

type InvoiceRecord = {
  id: string
  fileName: string
  [k: string]: unknown
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const records = await readIndex()
  const record = records.find((r) => r.id === id)
  if (!record) return NextResponse.json({ error: "not found" }, { status: 404 })
  const filePath = path.join(FILES_DIR, record.fileName)
  try {
    const buffer = await fs.readFile(filePath)
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer
    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${record.fileName.split("__").slice(1).join("__") || record.fileName}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: "file missing" }, { status: 404 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const records = await readIndex()
  const idx = records.findIndex((r) => r.id === id)
  if (idx === -1) return NextResponse.json({ error: "not found" }, { status: 404 })
  const [removed] = records.splice(idx, 1)
  await writeIndex(records)
  try {
    await fs.unlink(path.join(FILES_DIR, removed.fileName))
  } catch {}
  return NextResponse.json({ ok: true })
}
