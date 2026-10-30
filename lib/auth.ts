import crypto from "crypto"
import { promisify } from "util"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSetting, setSetting } from "@/lib/invoices"

// The whole app sits behind a PIN. The PIN is stored only as a salted scrypt
// hash; unlocking issues an HMAC-signed, httpOnly session cookie that
// middleware.ts checks on every API call.

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>

const PIN_KEY = "settings-pin"
const LOCKOUT_KEY = "settings-lockout"
export const SECRET_KEY = "session-secret"
export const SESSION_COOKIE = "invoice_session"
// The cookie ends with the browser session and is never valid past 12 h
const SESSION_TTL_MS = 12 * 60 * 60 * 1000
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const MAX_FREE_ATTEMPTS = 5
// Lockout after each further failure. A 4-digit PIN has only 10,000
// combinations, so waits grow up to a day per attempt.
const LOCKOUT_STEPS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
  24 * 60 * 60_000,
]

export const PIN_RULE = /^\d{4,12}$/

type StoredPin = { salt: string; hash: string }
type Lockout = { failed: number; lockedUntil: number }

async function hashPin(pin: string, salt: Buffer) {
  return scrypt(pin, salt, 32, SCRYPT)
}

export async function isPinConfigured() {
  return Boolean(await getSetting<StoredPin>(PIN_KEY))
}

export async function setPin(pin: string) {
  const salt = crypto.randomBytes(16)
  const hash = await hashPin(pin, salt)
  await setSetting(PIN_KEY, { salt: salt.toString("base64"), hash: hash.toString("base64") })
}

async function getLockout(): Promise<Lockout> {
  return (await getSetting<Lockout>(LOCKOUT_KEY)) ?? { failed: 0, lockedUntil: 0 }
}

export async function lockedUntil() {
  const { lockedUntil } = await getLockout()
  return lockedUntil > Date.now() ? lockedUntil : 0
}

export type PinCheck = { ok: true } | { ok: false; lockedUntil: number; attemptsLeft: number }

/** Verifies the PIN, counting failures and applying the lockout. */
export async function checkPin(pin: string): Promise<PinCheck> {
  const lockout = await getLockout()
  if (lockout.lockedUntil > Date.now()) {
    return { ok: false, lockedUntil: lockout.lockedUntil, attemptsLeft: 0 }
  }
  const stored = await getSetting<StoredPin>(PIN_KEY)
  if (!stored) return { ok: false, lockedUntil: 0, attemptsLeft: 0 }

  const expected = Buffer.from(stored.hash, "base64")
  const actual = await hashPin(pin, Buffer.from(stored.salt, "base64"))
  if (crypto.timingSafeEqual(expected, actual)) {
    await setSetting(LOCKOUT_KEY, { failed: 0, lockedUntil: 0 })
    return { ok: true }
  }

  const failed = lockout.failed + 1
  const extra = failed - MAX_FREE_ATTEMPTS
  const until =
    extra > 0 ? Date.now() + LOCKOUT_STEPS_MS[Math.min(extra - 1, LOCKOUT_STEPS_MS.length - 1)] : 0
  await setSetting(LOCKOUT_KEY, { failed, lockedUntil: until })
  return { ok: false, lockedUntil: until, attemptsLeft: Math.max(0, MAX_FREE_ATTEMPTS - failed) }
}

// The signing secret is generated once and kept in the database
async function getSecret() {
  const fresh = crypto.randomBytes(32).toString("base64")
  await sql`
    insert into settings (key, value) values (${SECRET_KEY}, ${JSON.stringify(fresh)}::jsonb)
    on conflict (key) do nothing
  `
  return Buffer.from((await getSetting<string>(SECRET_KEY)) ?? fresh, "base64")
}

function sign(payload: string, secret: Buffer) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url")
}

export async function createSessionCookie(response: NextResponse) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })).toString("base64url")
  const token = `${payload}.${sign(payload, await getSecret())}`
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  })
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 })
}

export async function isUnlocked() {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (!token) return false
  const [payload, signature] = token.split(".")
  if (!payload || !signature) return false
  const expected = Buffer.from(sign(payload, await getSecret()))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString())
    return typeof exp === "number" && exp > Date.now()
  } catch {
    return false
  }
}

/** Returns a 401 response unless the settings are unlocked. */
export async function requireUnlocked() {
  return (await isUnlocked())
    ? null
    : NextResponse.json({ error: "locked" }, { status: 401 })
}
