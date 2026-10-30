"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Lock, Settings } from "lucide-react"
import { lockNow } from "./LockGate"

const LINKS = [
  { href: "/", label: "Facturas" },
  { href: "/horas", label: "Parte de horas" },
  { href: "/historial", label: "Historial" },
]

export function AppHeader({ title, href }: { title: string; href?: string }) {
  const pathname = usePathname()
  return (
    <header className="mb-10 flex shrink-0 items-center justify-between gap-4 text-sm">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <nav className="flex items-center gap-5 text-zinc-500">
        {LINKS.filter((l) => l.href !== pathname).map((l) => (
          <Link key={l.href} href={l.href === "/horas" && href ? href : l.href} className="hover:text-zinc-900">
            {l.label}
          </Link>
        ))}
        <Link
          href="/ajustes"
          aria-label="Ajustes"
          title="Ajustes"
          className={pathname === "/ajustes" ? "text-zinc-900" : "hover:text-zinc-900"}
        >
          <Settings className="h-4 w-4" />
        </Link>
        <button type="button" aria-label="Bloquear" title="Bloquear" className="hover:text-zinc-900" onClick={lockNow}>
          <Lock className="h-4 w-4" />
        </button>
      </nav>
    </header>
  )
}
