interface Partes { year: number; month: number; day: number; hour: number; minute: number; second: number }

const partes = (instante: Date, tz: string): Partes => {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const valor = (tipo: string) => Number(f.formatToParts(instante).find((p) => p.type === tipo)?.value)
  return {
    year: valor('year'), month: valor('month'), day: valor('day'),
    hour: valor('hour'), minute: valor('minute'), second: valor('second'),
  }
}

const desfaseMs = (instante: Date, tz: string): number => {
  const p = partes(instante, tz)
  const local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return local - Math.floor(instante.getTime() / 1000) * 1000
}

export function inicioDelDia(fecha: Date, tz: string): Date {
  const p = partes(fecha, tz)
  const medianocheLocal = Date.UTC(p.year, p.month - 1, p.day)
  const primera = medianocheLocal - desfaseMs(new Date(medianocheLocal), tz)
  return new Date(medianocheLocal - desfaseMs(new Date(primera), tz))
}
