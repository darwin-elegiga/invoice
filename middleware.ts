import { NextResponse, type NextRequest } from "next/server"
import { neon } from "@neondatabase/serverless"

// Every API call needs an unlocked session (see lib/auth.ts) except the
// endpoints that create, check or end it. Pages are only shells: their data
// comes from these APIs and the LockGate covers them until unlocked.

const PUBLIC_API = new Set([
  "/api/settings/session",
  "/api/settings/unlock",
  "/api/settings/setup",
  "/api/settings/lock",
])

// Keep in sync with lib/auth.ts (middleware can't import its Node-only code)
const SESSION_COOKIE = "invoice_session"
const SECRET_KEY = "session-secret"

let cachedKey: CryptoKey | null = null

async function getKey() {
  if (cachedKey) return cachedKey
  const sql = neon(process.env.DATABASE_URL!, { fetchOptions: { cache: "no-store" } })
  const rows = await sql`select value from settings where key = ${SECRET_KEY}`
  const secret = rows[0]?.value as string | undefined
  // No secret yet means nobody has ever unlocked: nothing can be valid
  if (!secret) return null
  const raw = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0))
  cachedKey = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["verify"])
  return cachedKey
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

async function hasValidSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const [payload, signature] = token?.split(".") ?? []
  if (!payload || !signature) return false
  try {
    const key = await getKey()
    if (!key) return false
    // subtle.verify compares in constant time
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signature),
      new TextEncoder().encode(payload),
    )
    if (!valid) return false
    const { exp } = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)))
    return typeof exp === "number" && exp > Date.now()
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  if (PUBLIC_API.has(request.nextUrl.pathname)) return NextResponse.next()
  if (await hasValidSession(request)) return NextResponse.next()
  return NextResponse.json({ error: "locked" }, { status: 401 })
}

export const config = {
  matcher: "/api/:path*",
}
