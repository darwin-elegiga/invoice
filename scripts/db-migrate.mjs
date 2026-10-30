import { readFile } from "node:fs/promises"
import { neon } from "@neondatabase/serverless"

const url = process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL is not set (run `vercel env pull` first)")
  process.exit(1)
}

const sql = neon(url)
const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8")

// The HTTP driver runs one statement per query, so split the file.
const statements = schema
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean)

for (const statement of statements) {
  await sql.query(statement)
}

console.log(`Applied ${statements.length} statements`)
