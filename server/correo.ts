export function correoValido(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const c = valor.trim().toLowerCase()
  if (c.length > 254 || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(c)) return null
  return c.slice(c.lastIndexOf('.') + 1).length >= 2 ? c : null
}
