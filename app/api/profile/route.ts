import { NextResponse } from "next/server"
import { requireUnlocked } from "@/lib/auth"
import { getProfile, saveProfile } from "@/lib/invoices"
import { cleanProfile } from "@/lib/profile"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Reading is public: the invoice preview needs it
export async function GET() {
  return NextResponse.json(await getProfile())
}

export async function PUT(request: Request) {
  const denied = await requireUnlocked()
  if (denied) return denied
  const profile = cleanProfile(await request.json().catch(() => null))
  if (!profile) return NextResponse.json({ error: "every field is required" }, { status: 400 })
  await saveProfile(profile)
  return NextResponse.json(profile)
}
