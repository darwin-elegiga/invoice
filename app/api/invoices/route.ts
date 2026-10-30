import { NextResponse } from "next/server"
import crypto from "crypto"
import { put } from "@vercel/blob"
import { FILE_TYPES, INVOICE_RECIPIENT, detectFileType, listInvoices, saveInvoice, getInvoice } from "@/lib/invoices"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(await listInvoices())
}

export async function POST(request: Request) {
  const form = await request.formData()
  const file = form.get("file")
  const date = String(form.get("date") ?? "").trim()
  const invoiceNumber = String(form.get("invoiceNumber") ?? "").trim()
  const total = String(form.get("total") ?? "").trim()
  const notes = String(form.get("notes") ?? "").trim()
  const paymentMethod = String(form.get("paymentMethod") ?? "").trim()

  let items: unknown = []
  try {
    items = JSON.parse(String(form.get("items") ?? "[]"))
  } catch {
    return NextResponse.json({ error: "items must be valid JSON" }, { status: 400 })
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 })
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 })
  }
  if (!invoiceNumber) {
    return NextResponse.json({ error: "invoiceNumber is required" }, { status: 400 })
  }
  const fileType = detectFileType(file)
  if (!fileType) {
    return NextResponse.json({ error: "file must be a PDF or an Excel spreadsheet" }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_")
  const blob = await put(`invoices/${fileType}/${id}__${safeName}`, file, {
    access: "public",
    contentType: FILE_TYPES[fileType].contentType,
  })

  await saveInvoice({
    id,
    invoiceNumber,
    date,
    total,
    clientName: INVOICE_RECIPIENT,
    notes,
    paymentMethod,
    fileType,
    fileName: file.name,
    blobUrl: blob.url,
    blobPath: blob.pathname,
    uploadedAt: new Date().toISOString(),
    items: items as never,
  })

  return NextResponse.json(await getInvoice(id), { status: 201 })
}
