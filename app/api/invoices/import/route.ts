import { NextResponse } from "next/server"
import { FILE_TYPES, cleanItems, getProfile, listInvoices, saveInvoice, type FileType } from "@/lib/invoices"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ImportedRecord = {
  id: string
  invoiceNumber: string
  date: string
  fileName: string
  [k: string]: unknown
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidRecord(value: unknown): value is ImportedRecord {
  if (!value || typeof value !== "object") return false
  const r = value as Record<string, unknown>
  return (
    typeof r.id === "string" &&
    UUID_RE.test(r.id) &&
    typeof r.invoiceNumber === "string" &&
    typeof r.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
    typeof r.fileName === "string"
  )
}

const str = (v: unknown) => (typeof v === "string" ? v : "")

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

  const recipient = (await getProfile()).companyName
  const existingIds = new Set((await listInvoices()).map((r) => r.id))
  let added = 0
  let updated = 0
  let skipped = 0
  for (const item of body) {
    if (!isValidRecord(item)) {
      skipped++
      continue
    }
    const fileType: FileType = item.fileType === "xlsx" ? "xlsx" : "pdf"
    await saveInvoice(
      {
        id: item.id,
        invoiceNumber: item.invoiceNumber,
        date: item.date,
        total: str(item.total),
        clientName: str(item.clientName) || recipient,
        notes: str(item.notes),
        paymentMethod: str(item.paymentMethod),
        fileType: fileType in FILE_TYPES ? fileType : "pdf",
        fileName: item.fileName,
        blobUrl: str(item.blobUrl),
        blobPath: str(item.blobPath),
        uploadedAt: str(item.uploadedAt) || new Date().toISOString(),
        items: cleanItems(item.items),
      },
      // Re-importing a backup must not inflate the usage counters.
      { updateCatalog: !existingIds.has(item.id) },
    )
    if (existingIds.has(item.id)) updated++
    else added++
  }

  return NextResponse.json({
    total: existingIds.size + added,
    added,
    updated,
    skipped,
  })
}
