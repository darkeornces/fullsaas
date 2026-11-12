import type { Movimiento } from './tipos.ts'

export function hace(fechaIso: string, ahora: Date = new Date()): string {
  const s = Math.max(0, (ahora.getTime() - new Date(fechaIso).getTime()) / 1000)
  if (s < 45) return 'ahora mismo'
  const min = Math.round(s / 60)
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(s / 3600)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(s / 86400)
  return d < 2 ? 'ayer' : `hace ${d} días`
}

export function etiquetaMovimiento(m: Partial<Movimiento> & Pick<Movimiento, 'tipo'>): { etiqueta: string; detalle: string } {
  if (m.tipo === 'alta') return { etiqueta: 'Alta', detalle: 'Cliente nuevo' }
  if (m.tipo === 'canje') return { etiqueta: 'Canje', detalle: 'Premio canjeado' }
  return { etiqueta: '+1 sello', detalle: m.origen === 'enlace' ? 'Con enlace de un solo uso' : 'En el local' }
}
