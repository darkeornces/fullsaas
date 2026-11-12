import { Link } from 'react-router-dom'
import { Gift, Utensils, X } from 'lucide-react'
import Phone from '../components/Phone.tsx'
import { useCliente } from './ClienteGate.tsx'

export default function Sello() {
  const { tarjeta } = useCliente()
  const { sellos, total } = tarjeta
  const completa = sellos >= total
  const faltan = total - sellos

  return (
    <div className="bg-green">
      <Phone className="px-5 pb-8 pt-[60px]">
        <div className="flex justify-end">
          <Link to="/app" aria-label="Cerrar" className="flex size-10 items-center justify-center rounded-full bg-white/15 text-white"><X size={18} /></Link>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-5 pb-6 text-center">
          <div className="flex size-[140px] items-center justify-center rounded-full bg-white/10">
            <div className="flex size-[100px] items-center justify-center rounded-full bg-sun shadow-[0_12px_30px_#00000030]">
              <Utensils size={44} className="text-green" />
            </div>
          </div>
          <div>
            <h1 className="font-head text-4xl font-bold text-white">¡Sello sumado!</h1>
            <p className="mt-2 text-[15px] text-white/70">Gracias por tu compra en {tarjeta.comercio}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-3xl bg-bg p-5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-muted">{tarjeta.comercio}</p>
              <p className="font-head text-xl font-bold">
                {completa ? '¡Tarjeta completa!' : faltan === 1 ? 'Te falta 1 menú' : `Te faltan ${faltan} menús`}
              </p>
            </div>
            <p className="font-head text-3xl font-extrabold leading-none text-green">
              {sellos}<span className="text-lg font-bold text-muted">/{total}</span>
            </p>
          </div>

          <div className="grid grid-cols-5 gap-2.5">
            {Array.from({ length: total }, (_, i) => {
              const base = 'flex aspect-square items-center justify-center rounded-full text-sm font-semibold'
              if (i === total - 1) {
                return completa
                  ? <span key={i} className={`${base} bg-accent text-white`}><Gift size={18} /></span>
                  : <span key={i} className={`${base} border-2 border-accent bg-accent/10 text-accent`}><Gift size={18} /></span>
              }
              if (i < sellos) return <span key={i} className={`${base} bg-green text-sun`}><Utensils size={16} /></span>
              if (i === sellos) return <span key={i} className={`${base} border-2 border-dashed border-green text-green`}>{i + 1}</span>
              return <span key={i} className={`${base} border border-muted/40 text-muted/70`}>{i + 1}</span>
            })}
          </div>

          <p className="text-xs text-muted">{completa ? `Ganaste: ${tarjeta.premio}` : `A los ${total}: ${tarjeta.premio}`}</p>
        </div>

        <Link to="/app" className="mt-4 rounded-full bg-sun py-4 text-center text-base font-bold text-ink">{completa ? 'Ver mi premio' : 'Ver mi tarjeta'}</Link>
      </Phone>
    </div>
  )
}
