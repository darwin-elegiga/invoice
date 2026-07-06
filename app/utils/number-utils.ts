// Utilidades para números en formato español: 1.056,00

/**
 * Convierte una cadena numérica a número aceptando tanto formato español
 * ("1.056,00", "10,5") como inglés ("1056.00", "10.5").
 */
export function parseFlexibleNumber(value: string): number {
  const raw = value.trim()
  if (!raw) return NaN

  const hasComma = raw.includes(",")
  const hasDot = raw.includes(".")

  let normalized = raw
  if (hasComma) {
    // La coma es el separador decimal; los puntos son separadores de miles
    normalized = raw.replace(/\./g, "").replace(",", ".")
  } else if (hasDot) {
    // Un solo punto seguido de exactamente 3 dígitos se interpreta como
    // separador de miles ("1.056" -> 1056); en otro caso, como decimal
    const parts = raw.split(".")
    if (parts.length === 2 && parts[1].length === 3) {
      normalized = parts.join("")
    } else if (parts.length > 2) {
      normalized = parts.join("")
    }
  }

  return parseFloat(normalized)
}

/**
 * Formatea un número como "1.056,00": punto de miles (también en 4 cifras,
 * donde es-ES por defecto no agrupa) y coma decimal, siempre 2 decimales.
 */
export function formatEsNumber(n: number): string {
  const [intPart, decPart] = Math.abs(n).toFixed(2).split(".")
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${n < 0 ? "-" : ""}${grouped},${decPart}`
}

/**
 * Formatea una cadena numérica al formato español si es parseable;
 * si no lo es, la devuelve tal cual.
 */
export function formatEsNumberString(value: string): string {
  const n = parseFlexibleNumber(value)
  return Number.isNaN(n) ? value : formatEsNumber(n)
}
