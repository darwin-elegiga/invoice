import { NextResponse } from "next/server"
import { PIN_RULE, checkPin, requireUnlocked, setPin } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Changing the PIN needs an unlocked session and the current PIN again
export async function PUT(request: Request) {
  const denied = await requireUnlocked()
  if (denied) return denied
  const body = await request.json().catch(() => null)
  const currentPin = String(body?.currentPin ?? "")
  const newPin = String(body?.newPin ?? "")
  if (!PIN_RULE.test(newPin)) {
    return NextResponse.json({ error: "PIN must be 4-12 digits" }, { status: 400 })
  }
  const result = await checkPin(currentPin)
  if (!result.ok) {
    return NextResponse.json(
      { error: "wrong PIN", lockedUntil: result.lockedUntil, attemptsLeft: result.attemptsLeft },
      { status: result.lockedUntil ? 429 : 401 },
    )
  }
  await setPin(newPin)
  return NextResponse.json({ ok: true })
}
