import { NextResponse } from "next/server"
import { checkPin } from "@/lib/auth"
import { parseAddresses } from "@/lib/email"
import { markInvoiceEmailed } from "@/lib/invoices"
import { isMailConfigured, sendMail } from "@/lib/mailer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024

// Multipart: pin, to, cc, subject, text, invoiceNumber and the exported files.
// Besides the unlocked session, sending asks for the PIN again (it counts
// towards the same lockout), since it acts in the owner's name.
export async function POST(request: Request) {
  if (!isMailConfigured()) {
    return NextResponse.json({ error: "email is not configured" }, { status: 503 })
  }
  const form = await request.formData()
  const pinCheck = await checkPin(String(form.get("pin") ?? ""))
  if (!pinCheck.ok) {
    return NextResponse.json(
      { error: "wrong PIN", lockedUntil: pinCheck.lockedUntil, attemptsLeft: pinCheck.attemptsLeft },
      { status: pinCheck.lockedUntil ? 429 : 403 },
    )
  }
  const to = parseAddresses(String(form.get("to") ?? ""))
  const cc = parseAddresses(String(form.get("cc") ?? ""))
  const subject = String(form.get("subject") ?? "").trim()
  const text = String(form.get("text") ?? "").trim()
  const invoiceNumber = String(form.get("invoiceNumber") ?? "").trim()
  if (!to?.length || cc === null) {
    return NextResponse.json({ error: "invalid recipients" }, { status: 400 })
  }
  if (!subject || subject.length > 300 || text.length > 10000) {
    return NextResponse.json({ error: "invalid subject or text" }, { status: 400 })
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File)
  if (files.length === 0 || files.reduce((n, f) => n + f.size, 0) > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "invalid attachments" }, { status: 400 })
  }
  const attachments = await Promise.all(
    files.map(async (f) => ({
      filename: f.name,
      content: Buffer.from(await f.arrayBuffer()),
      contentType: f.type || "application/octet-stream",
    })),
  )

  try {
    await sendMail({ to, cc, subject, text, attachments })
  } catch (err) {
    console.error("email send failed", err)
    return NextResponse.json({ error: "the mail server rejected the message" }, { status: 502 })
  }
  if (invoiceNumber) await markInvoiceEmailed(invoiceNumber, [...to, ...cc].join(", "))
  return NextResponse.json({ ok: true })
}
