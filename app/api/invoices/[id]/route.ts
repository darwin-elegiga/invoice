import { NextResponse } from "next/server"
import { del } from "@vercel/blob"
import { redis, KV_KEYS } from "@/lib/storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type InvoiceRecord = {
  id: string
  fileName: string
  blobUrl: string
  blobPath: string
  [k: string]: unknown
}

async function readIndex(): Promise<InvoiceRecord[]> {
  const stored = await redis.get<InvoiceRecord[]>(KV_KEYS.invoices)
  return Array.isArray(stored) ? stored : []
}

async function writeIndex(records: InvoiceRecord[]) {
  await redis.set(KV_KEYS.invoices, records)
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const records = await readIndex()
  const record = records.find((r) => r.id === id)
  if (!record || !record.blobUrl) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  return NextResponse.redirect(record.blobUrl, 302)
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
  if (removed.blobUrl) {
    try {
      await del(removed.blobUrl)
    } catch {}
  }
  return NextResponse.json({ ok: true })
}
