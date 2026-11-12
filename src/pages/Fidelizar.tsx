import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { api } from '../api.ts'
import { useAccion } from '../hooks.ts'
import type { Fidelizacion } from '../tipos.ts'
import Phone from '../components/Phone.tsx'
import CodigoGenerado from '../components/CodigoGenerado.tsx'
import { Aviso } from '../components/Estado.tsx'
import { useCaja } from './CajaGate.tsx'

export default function Fidelizar() {
  const { total, comercio } = useCaja()
  const [whatsapp, setWhatsapp] = useState((useLocation().state as { whatsapp?: string } | null)?.whatsapp ?? '')
  const [fid, setFid] = useState<Fidelizacion | null>(null)
  const { error, ocupado, ejecutar } = useAccion()

  const generar = async (e: React.FormEvent) => {
    e.preventDefault()
    const r = await ejecutar(() => api.fidelizar(whatsapp))
    if (r) setFid(r)
  }
  const otro = () => { setFid(null); setWhatsapp('') }

  return (
    <Phone className="gap-4 px-5 pb-8 pt-[60px] print:p-0">
      <header className="flex items-center gap-3 print:hidden">
        <Link to="/caja" aria-label="Volver" className="flex size-10 items-center justify-center rounded-full border border-line bg-surface"><ArrowLeft size={18} /></Link>
        <h1 className="font-head text-2xl font-bold">Fidelizar</h1>
      </header>

      {!fid ? (
        <form onSubmit={generar} className="flex flex-col gap-4">
          <div>
            <label htmlFor="wa" className="mb-1.5 block text-xs font-semibold">WhatsApp del cliente</label>
            <input
              id="wa" type="tel" inputMode="tel" autoComplete="off" autoFocus placeholder="+34 612 345 187"
              value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full rounded-2xl border-2 border-line bg-surface px-4 py-3.5 text-lg focus:border-green focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-muted">Generamos un QR y un enlace de un solo uso. Al abrirlo, el cliente suma su sello sin escribir nada.</p>
          </div>
          <Aviso>{error}</Aviso>
          <button disabled={!whatsapp.trim() || ocupado} className="rounded-full bg-accent py-4 text-base font-bold text-white disabled:opacity-40">
            {ocupado ? 'Generando…' : 'Generar QR y enlace'}
          </button>
        </form>
      ) : (
        <>
          <CodigoGenerado fid={fid} comercio={comercio} total={total} />
          <button onClick={otro} className="flex items-center justify-center gap-2 rounded-full border border-line bg-surface py-3 text-sm font-semibold print:hidden"><RefreshCw size={16} /> Otro cliente</button>
        </>
      )}
    </Phone>
  )
}
