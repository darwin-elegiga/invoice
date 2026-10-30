import { NextResponse } from "next/server"
import { addCatalogEntry, deleteCatalogEntry, listCatalog } from "@/lib/invoices"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(await listCatalog())
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const project = String(body?.project ?? "").trim()
  const client = String(body?.client ?? "").trim()
  if (!project || !client) {
    return NextResponse.json({ error: "project and client are required" }, { status: 400 })
  }
  await addCatalogEntry({ project, client })
  return NextResponse.json(await listCatalog(), { status: 201 })
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"))
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }
  await deleteCatalogEntry(id)
  return NextResponse.json(await listCatalog())
}
