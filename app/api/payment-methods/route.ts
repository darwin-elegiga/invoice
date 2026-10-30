import { NextResponse } from "next/server"
import { cleanPaymentMethod, createPaymentMethod, listPaymentMethods } from "@/lib/invoices"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(await listPaymentMethods())
}

export async function POST(request: Request) {
  const method = cleanPaymentMethod(await request.json().catch(() => null))
  if (!method) return NextResponse.json({ error: "name is required" }, { status: 400 })
  await createPaymentMethod(method)
  return NextResponse.json(await listPaymentMethods(), { status: 201 })
}
