import type { Metadata } from 'next'
import './globals.css'
import { LockGate } from './components/LockGate'

export const metadata: Metadata = {
  title: 'Facturas LYN',
  description: 'Facturas, parte de horas e historial',
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body>
        <LockGate>{children}</LockGate>
      </body>
    </html>
  )
}
