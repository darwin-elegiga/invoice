import { NextResponse } from "next/server"
import { deleteDraft, listDrafts, registerCatalogItems, saveDraft } from "@/lib/invoices"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(await listDrafts())
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null)
  const invoiceNumber = String(body?.invoiceNumber ?? "").trim()
  if (!invoiceNumber || !body?.data || typeof body.data !== "object") {
    return NextResponse.json({ error: "invoiceNumber and data are required" }, { status: 400 })
  }
  await saveDraft(invoiceNumber, body.data)
  await registerCatalogItems(body.data.items)
  return NextResponse.json(await listDrafts())
}

export async function DELETE(request: Request) {
  const invoiceNumber = new URL(request.url).searchParams.get("invoiceNumber")?.trim()
  if (!invoiceNumber) {
    return NextResponse.json({ error: "invoiceNumber is required" }, { status: 400 })
  }
  await deleteDraft(invoiceNumber)
  return NextResponse.json(await listDrafts())
}
