import { Link } from 'react-router-dom'
import { Camera, ChevronRight, Settings, Gift, QrCode, Search, Store, UserPlus, type LucideIcon } from 'lucide-react'
import { api } from '../api.ts'
import { useCarga } from '../hooks.ts'
import { etiquetaMovimiento, hace } from '../format.ts'
import Phone from '../components/Phone.tsx'
import { Fallo } from '../components/Estado.tsx'
import { useCaja } from './CajaGate.tsx'

const fechaHoy = () => new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date())

export default function CajaInicio() {
  const { comercio } = useCaja()
  const { datos: resumen, error: e1 } = useCarga(() => api.resumen(), [], { cada: 5000 })
  const { datos: movs, error: e2 } = useCarga(() => api.movimientos(), [], { cada: 5000 })
  if (e1 || e2) return <Fallo error={e1 ?? e2} to="/caja" enlace="Reintentar" />

  return (
    <Phone className="gap-5 px-5 pb-8 pt-[60px]">
      <header className="flex items-center justify-between px-1">
        <div>
          <p className="text-[13px] capitalize text-muted">{fechaHoy()}</p>
          <h1 className="font-head text-[28px] font-bold tracking-tight">{comercio}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/caja/opciones" aria-label="Opciones" className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface"><Settings size={20} className="text-green" /></Link>
          <div className="flex size-11 items-center justify-center rounded-xl bg-green"><Store size={20} className="text-sun" /></div>
        </div>
      </header>
      <div className="grid grid-cols-3 gap-2 text-center">
        {([[resumen?.sellosHoy, 'sellos hoy'], [resumen?.clientesNuevos, 'clientes nuevos'], [resumen?.canjes, 'premios canjeados']] as const).map(([n, l]) => (
          <div key={l}><p className="font-head text-[28px] font-bold">{n ?? '–'}</p><p className="text-xs text-muted">{l}</p></div>
        ))}
      </div>
      <Link to="/caja/fidelizar" className="flex items-center gap-4 rounded-3xl bg-accent p-5 text-white">
        <QrCode size={28} />
        <div className="flex-1"><p className="font-head text-2xl font-bold">Fidelizar</p><p className="text-[13px] text-white/85">Número del cliente → QR y enlace de un solo uso</p></div>
        <ChevronRight />
      </Link>
      <Link to="/caja/escanear" className="flex items-center gap-4 rounded-3xl bg-ink p-5 text-white">
        <Camera size={26} className="text-sun" />
        <div className="flex-1"><p className="font-head text-xl font-bold">Escanear cliente</p><p className="text-[13px] text-white/70">Con la cámara, desde su tarjeta</p></div>
        <ChevronRight />
      </Link>
      <Link to="/caja/sumar" className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
        <Search size={22} className="text-green" />
        <div className="flex-1"><p className="font-semibold">Buscar cliente</p><p className="text-xs text-muted">Sumar un sello a mano o canjear un premio</p></div>
        <ChevronRight className="text-muted" />
      </Link>
      <div>
        <p className="mb-2 text-sm font-semibold text-muted">Últimos movimientos</p>
        {movs?.length === 0 && <p className="text-sm text-muted">Aún no hay movimientos.</p>}
        <ul className="flex flex-col gap-2">
          {movs?.map((m, i) => {
            const Icon: LucideIcon = m.tipo === 'alta' ? UserPlus : m.tipo === 'canje' ? Gift : m.origen === 'enlace' ? QrCode : Store
            const { etiqueta, detalle } = etiquetaMovimiento(m)
            return (
              <li key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-bg"><Icon size={16} className="text-green" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{m.whatsapp ?? 'Sin WhatsApp'} · {m.codigo}</p>
                  <p className="truncate text-xs text-muted">{hace(m.fecha)} · {detalle}</p>
                </div>
                <span className="rounded-full bg-mint px-2.5 py-1 text-[11px] font-semibold text-green">{etiqueta}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </Phone>
  )
}
