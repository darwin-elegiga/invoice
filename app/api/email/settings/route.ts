import { NextResponse } from "next/server"
import { cleanEmailSettings, withEmailDefaults, type EmailSettings } from "@/lib/email"
import { getSetting, setSetting } from "@/lib/invoices"
import { isMailConfigured, mailSender } from "@/lib/mailer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const KEY = "email"

export async function GET() {
  return NextResponse.json({
    ...withEmailDefaults(await getSetting<Partial<EmailSettings>>(KEY)),
    configured: isMailConfigured(),
    from: mailSender(),
  })
}

export async function PUT(request: Request) {
  const settings = cleanEmailSettings(await request.json().catch(() => null))
  if (!settings) return NextResponse.json({ error: "invalid settings" }, { status: 400 })
  await setSetting(KEY, settings)
  return NextResponse.json(settings)
}
