import { NextResponse } from "next/server"
import { checkPin, createSessionCookie } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const pin = String(body?.pin ?? "")
  if (!pin || pin.length > 12) {
    return NextResponse.json({ error: "invalid PIN" }, { status: 400 })
  }
  const result = await checkPin(pin)
  if (!result.ok) {
    return NextResponse.json(
      { error: "wrong PIN", lockedUntil: result.lockedUntil, attemptsLeft: result.attemptsLeft },
      { status: result.lockedUntil ? 429 : 401 },
    )
  }
  const response = NextResponse.json({ ok: true })
  await createSessionCookie(response)
  return response
}
