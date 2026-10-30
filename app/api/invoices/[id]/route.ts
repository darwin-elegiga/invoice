import { NextResponse } from "next/server"
import { del } from "@vercel/blob"
import { deleteInvoice, getInvoice } from "@/lib/invoices"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const record = await getInvoice(id)
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
  const removed = await deleteInvoice(id)
  if (!removed) return NextResponse.json({ error: "not found" }, { status: 404 })
  if (removed.blobUrl) {
    try {
      await del(removed.blobUrl)
    } catch {}
  }
  return NextResponse.json({ ok: true })
}
