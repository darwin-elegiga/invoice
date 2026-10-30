import { NextResponse } from "next/server"
import { isPinConfigured, isUnlocked, lockedUntil } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const configured = await isPinConfigured()
  return NextResponse.json({
    configured,
    unlocked: configured && (await isUnlocked()),
    lockedUntil: configured ? await lockedUntil() : 0,
    // The first PIN can only be created from the local dev server
    canSetup: !configured && process.env.NODE_ENV !== "production",
  })
}
