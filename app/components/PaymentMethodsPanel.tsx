"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, PlusCircle, Trash2 } from "lucide-react"

export interface PaymentMethodLine {
  label: string
  value: string
}

export interface PaymentMethod {
  id: number
  name: string
  lines: PaymentMethodLine[]
  isDefault: boolean
}

type Draft = { id: number | null; name: string; lines: PaymentMethodLine[] }

const EMPTY_LINE: PaymentMethodLine = { label: "", value: "" }

export function PaymentMethodsPanel({
  methods,
  selectedId,
  onSelect,
  onMethodsChange,
}: {
  methods: PaymentMethod[]
  selectedId: number | null
  onSelect: (id: number) => void
  onMethodsChange: (methods: PaymentMethod[]) => void
}) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle")

  const request = async (url: string, init: RequestInit) => {
    setStatus("saving")
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json" },
      })
      if (!res.ok) throw new Error()
      const updated: PaymentMethod[] = await res.json()
      onMethodsChange(updated)
      setStatus("idle")
      return updated
    } catch {
      setStatus("error")
      return null
    }
  }

  const startEdit = (method: PaymentMethod) =>
    setDraft({ id: method.id, name: method.name, lines: method.lines.map((l) => ({ ...l })) })

  const startNew = () => setDraft({ id: null, name: "", lines: [{ ...EMPTY_LINE }] })

  const updateLine = (index: number, field: keyof PaymentMethodLine, value: string) =>
    setDraft((d) =>
      d && { ...d, lines: d.lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)) },
    )

  const saveDraft = async () => {
    if (!draft || !draft.name.trim()) return
    const body = JSON.stringify({ name: draft.name, lines: draft.lines })
    const updated = draft.id
      ? await request(`/api/payment-methods/${draft.id}`, { method: "PUT", body })
      : await request("/api/payment-methods", { method: "POST", body })
    if (!updated) return
    // Select a newly created method so it shows up on the invoice right away
    if (!draft.id) {
      const created = updated.reduce((a, b) => (b.id > a.id ? b : a), updated[0])
      if (created) onSelect(created.id)
    }
    setDraft(null)
  }

  const remove = async (method: PaymentMethod) => {
    if (!window.confirm(`¿Eliminar el método de pago «${method.name}»?`)) return
    const updated = await request(`/api/payment-methods/${method.id}`, { method: "DELETE" })
    if (updated && method.id === selectedId) {
      const fallback = updated.find((m) => m.isDefault) ?? updated[0]
      if (fallback) onSelect(fallback.id)
    }
  }

  const makeDefault = (method: PaymentMethod) =>
    request(`/api/payment-methods/${method.id}`, {
      method: "PUT",
      body: JSON.stringify({ isDefault: true }),
    })

  return (
    <Collapsible className="mt-6 border rounded bg-gray-50">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-4 text-left group">
        <span className="min-w-0">
          <span className="block font-semibold">Método de pago</span>
          <span className="block truncate text-sm text-gray-600">
            {methods.find((m) => m.id === selectedId)?.name ?? "Ninguno seleccionado"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-normal text-gray-500">
          {status === "saving" && "Guardando…"}
          {status === "error" && "No se pudo guardar"}
          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-3">
        {methods.length === 0 && (
          <p className="text-sm text-gray-500">No hay métodos de pago guardados.</p>
        )}
        {methods.map((method) => (
          <div
            key={method.id}
            className={`rounded border p-3 text-sm ${method.id === selectedId ? "border-black bg-white" : "bg-gray-50"}`}
          >
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="payment-method"
                className="mt-1"
                checked={method.id === selectedId}
                onChange={() => onSelect(method.id)}
              />
              <span className="flex-1">
                <span className="font-medium">{method.name}</span>
                {method.isDefault && (
                  <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">
                    Predeterminado
                  </span>
                )}
                {method.lines.map((line, i) => (
                  <span key={i} className="block text-xs text-gray-600">
                    {line.label}: {line.value}
                  </span>
                ))}
              </span>
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => startEdit(method)}>
                Editar
              </Button>
              {!method.isDefault && (
                <Button size="sm" variant="outline" onClick={() => makeDefault(method)}>
                  Hacer predeterminado
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600"
                onClick={() => remove(method)}
              >
                Eliminar
              </Button>
            </div>
          </div>
        ))}

        {draft ? (
          <div className="space-y-2 rounded border bg-white p-3">
            <h4 className="text-sm font-semibold">
              {draft.id ? "Editar método de pago" : "Nuevo método de pago"}
            </h4>
            <div>
              <Label htmlFor="payment-method-name">Título (aparece en la factura)</Label>
              <Input
                id="payment-method-name"
                placeholder="Transferencia bancaria"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            {draft.lines.map((line, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  aria-label="Etiqueta"
                  placeholder="Banco"
                  className="w-2/5"
                  value={line.label}
                  onChange={(e) => updateLine(i, "label", e.target.value)}
                />
                <Input
                  aria-label="Valor"
                  placeholder="BBVA Colombia"
                  value={line.value}
                  onChange={(e) => updateLine(i, "value", e.target.value)}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Quitar línea"
                  onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDraft({ ...draft, lines: [...draft.lines, { ...EMPTY_LINE }] })}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Añadir línea
            </Button>
            <div className="flex gap-2 pt-2">
              <Button onClick={saveDraft} disabled={!draft.name.trim() || status === "saving"}>
                {status === "saving" ? "Guardando…" : "Guardar"}
              </Button>
              <Button variant="outline" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={startNew}>
            <PlusCircle className="mr-2 h-4 w-4" /> Nuevo método de pago
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
