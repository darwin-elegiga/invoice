import { NextResponse } from "next/server"
import { requireUnlocked } from "@/lib/auth"
import {
  cleanPaymentMethod,
  deletePaymentMethod,
  listPaymentMethods,
  setDefaultPaymentMethod,
  updatePaymentMethod,
} from "@/lib/invoices"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

async function parseId(params: Params["params"]) {
  const id = Number((await params).id)
  return Number.isInteger(id) && id > 0 ? id : null
}

// Body: { name, lines } to edit, or { isDefault: true } to make it the default
export async function PUT(request: Request, { params }: Params) {
  const denied = await requireUnlocked()
  if (denied) return denied
  const id = await parseId(params)
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 })
  const body = await request.json().catch(() => null)
  if (body?.isDefault === true) {
    await setDefaultPaymentMethod(id)
  } else {
    const method = cleanPaymentMethod(body)
    if (!method) return NextResponse.json({ error: "name is required" }, { status: 400 })
    await updatePaymentMethod(id, method)
  }
  return NextResponse.json(await listPaymentMethods())
}

export async function DELETE(_req: Request, { params }: Params) {
  const denied = await requireUnlocked()
  if (denied) return denied
  const id = await parseId(params)
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 })
  await deletePaymentMethod(id)
  return NextResponse.json(await listPaymentMethods())
}
