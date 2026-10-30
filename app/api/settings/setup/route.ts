import { NextResponse } from "next/server"
import { PIN_RULE, createSessionCookie, isPinConfigured, setPin } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Creates the first PIN. Disabled in production so nobody can claim the
// settings on the public site before the owner does.
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "setup is only available locally" }, { status: 403 })
  }
  if (await isPinConfigured()) {
    return NextResponse.json({ error: "PIN already configured" }, { status: 409 })
  }
  const body = await request.json().catch(() => null)
  const pin = String(body?.pin ?? "")
  if (!PIN_RULE.test(pin)) {
    return NextResponse.json({ error: "PIN must be 4-12 digits" }, { status: 400 })
  }
  await setPin(pin)
  const response = NextResponse.json({ ok: true })
  await createSessionCookie(response)
  return response
}
