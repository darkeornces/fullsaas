import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QrCode, Sparkles, X } from 'lucide-react'
import { api } from '../api.ts'
import type { Fidelizacion } from '../tipos.ts'
import CodigoGenerado from '../components/CodigoGenerado.tsx'
import { useAccion, useCarga } from '../hooks.ts'
import Phone from '../components/Phone.tsx'
import { Aviso, Cargando, Fallo } from '../components/Estado.tsx'
import { useCaja } from './CajaGate.tsx'

export default function CajaSumar() {
  const { codigo = '' } = useParams()
  const { total, comercio } = useCaja()
  const { datos, error, recargar } = useCarga(() => api.cliente(codigo), [codigo], { cada: 5000 })
  const { error: errorAccion, ocupado, ejecutar } = useAccion()
  const [hecho, setHecho] = useState<string | null>(null)
  const [codigoGenerado, setCodigoGenerado] = useState<Fidelizacion | null>(null)
  if (error) return <Fallo error={error} to="/caja/sumar" enlace="Buscar otro" />
  if (!datos) return <Cargando />

  const completa = datos.sellos >= total
  const faltan = total - datos.sellos

  const accion = async (fn: () => Promise<unknown>, mensaje: string) => {
    if (await ejecutar(async () => { await fn(); return true })) { setHecho(mensaje); recargar() }
  }

  return (
    <div className="bg-[#0f1c16]">
      <Phone className="gap-5 px-5 pb-8 pt-[60px] text-white">
        <header className="flex items-start justify-between">
          <div><p className="text-xs text-white/60">Caja</p><h1 className="font-head text-2xl font-bold">Cliente</h1></div>
          <Link to="/caja" aria-label="Cerrar" className="flex size-10 items-center justify-center rounded-full bg-white/10"><X size={18} /></Link>
        </header>
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.07] p-4">
          <span className="flex size-11 items-center justify-center rounded-full bg-sun font-bold text-ink">{datos.codigo.slice(3, 5)}</span>
          <div><p className="font-semibold">{datos.whatsapp}</p><p className="text-xs text-white/60">{datos.codigo} · {datos.canjes} premios canjeados</p></div>
        </div>
        <div className="mt-6 text-center">
          <p className="font-head text-[120px] font-extrabold leading-none text-sun">{datos.sellos}<span className="text-4xl font-bold text-white/50">/{total}</span></p>
          <div className="mt-4 flex justify-center gap-1.5">
            {Array.from({ length: total }, (_, i) => <span key={i} className={`size-3 rounded-full ${i < datos.sellos ? 'bg-sun' : 'border-2 border-accent'}`} />)}
          </div>
          {hecho && <p role="status" className="mx-auto mt-5 w-fit rounded-full bg-white/10 px-4 py-2 text-[13px]">{hecho}</p>}
        </div>
        <div className="mt-auto flex flex-col gap-3">
          <Aviso>{errorAccion}</Aviso>
          {completa ? (
            <button disabled={ocupado} onClick={() => void accion(() => api.canjear(codigo), 'Premio canjeado ✓')} className="flex items-center justify-center gap-2 rounded-full bg-sun py-5 text-[17px] font-bold text-ink disabled:opacity-40">
              <Sparkles size={20} /> Canjear premio
            </button>
          ) : (
            <>
              <p className="text-center text-sm text-white/70">
                {faltan === 1 ? 'Le falta 1 sello' : `Le faltan ${faltan} sellos`}. El sello se suma cuando el cliente abre su código.
              </p>
              {codigoGenerado ? (
                <CodigoGenerado fid={codigoGenerado} comercio={comercio} total={total} />
              ) : (
                <button
                  disabled={ocupado}
                  onClick={async () => { const r = await ejecutar(() => api.fidelizar(datos.whatsapp)); if (r) setCodigoGenerado(r) }}
                  className="flex items-center justify-center gap-2 rounded-full bg-accent py-5 text-[17px] font-bold disabled:opacity-40"
                >
                  <QrCode size={20} /> {ocupado ? 'Generando…' : 'Generar código para este cliente'}
                </button>
              )}
            </>
          )}
        </div>
      </Phone>
    </div>
  )
}
