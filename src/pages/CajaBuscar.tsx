import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../api.ts'
import { useAccion } from '../hooks.ts'
import Phone from '../components/Phone.tsx'
import { Aviso } from '../components/Estado.tsx'

export default function CajaBuscar() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const { error, ocupado, ejecutar } = useAccion()

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault()
    const c = await ejecutar(() => api.buscar(q))
    if (c) navigate(`/caja/sumar/${c.codigo}`)
  }

  return (
    <Phone className="gap-5 px-5 pb-8 pt-[60px]">
      <header className="flex items-center gap-3">
        <Link to="/caja" aria-label="Volver" className="flex size-10 items-center justify-center rounded-full border border-line bg-surface"><ArrowLeft size={18} /></Link>
        <h1 className="font-head text-2xl font-bold">Sumar sello</h1>
      </header>
      <form onSubmit={buscar} className="flex flex-col gap-3">
        <label htmlFor="q" className="text-sm font-semibold">WhatsApp o código del cliente</label>
        <input
          id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="+34 612 345 187 o CL-7K4Q" autoComplete="off" autoFocus
          className="rounded-2xl border-2 border-line bg-surface px-4 py-3.5 text-center text-xl focus:border-green focus:outline-none"
        />
        <Aviso>{error}</Aviso>
        <button disabled={!q.trim() || ocupado} className="rounded-full bg-green py-4 font-bold text-white disabled:opacity-40">Buscar cliente</button>
      </form>
    </Phone>
  )
}
