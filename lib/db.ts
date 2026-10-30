import { neon } from "@neondatabase/serverless"

const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is not set")

// The HTTP driver uses fetch; opt out of Next.js' data cache so a repeated
// query never returns a stale result.
export const sql = neon(url, { fetchOptions: { cache: "no-store" } })
