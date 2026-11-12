import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Flashlight, X } from 'lucide-react'
import { api, codigoDeEnlace } from '../api.ts'
import { useAccion } from '../hooks.ts'
import Phone from '../components/Phone.tsx'
import { Aviso } from '../components/Estado.tsx'
import { useCliente } from './ClienteGate.tsx'

const esquina = 'absolute size-11 border-sun'

export default function Escanear() {
  const { recargar } = useCliente()
  const navigate = useNavigate()
  const [texto, setTexto] = useState('')
  const { error, ocupado, ejecutar } = useAccion()

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await ejecutar(async () => { await api.usarEnlace(codigoDeEnlace(texto)); await recargar(); return true })
    if (ok) navigate('/app/sello', { replace: true })
  }

  return (
    <div className="bg-[#0d1712]">
      <Phone className="px-5 pb-8 pt-[60px] text-white">
        <header className="flex items-center justify-between">
          <Link to="/app" aria-label="Cerrar" className="flex size-11 items-center justify-center rounded-full bg-white/10"><X size={20} /></Link>
          <span className="font-semibold">Sumar mi compra</span>
          <span className="flex size-11 items-center justify-center rounded-full bg-white/10"><Flashlight size={18} /></span>
        </header>
        <div className="relative mx-auto mt-16 size-[240px]">
          <span className={`${esquina} left-0 top-0 rounded-tl-md border-l-[5px] border-t-[5px]`} />
          <span className={`${esquina} right-0 top-0 rounded-tr-md border-r-[5px] border-t-[5px]`} />
          <span className={`${esquina} bottom-0 left-0 rounded-bl-md border-b-[5px] border-l-[5px]`} />
          <span className={`${esquina} bottom-0 right-0 rounded-br-md border-b-[5px] border-r-[5px]`} />
          <span className="absolute inset-x-4 top-1/2 h-[3px] bg-sun" />
        </div>
        <div className="mt-12 text-center">
          <h1 className="font-head text-xl font-bold">Apunta al <u>QR</u> de tu compra</h1>
          <p className="mx-auto mt-2 max-w-[300px] text-[13px] text-white/60">También puedes pegar el enlace o código que te enviaron. Vale una sola vez.</p>
        </div>
        <form onSubmit={enviar} className="mt-auto flex flex-col gap-3">
          <Aviso>{error}</Aviso>
          <input
            value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Pega aquí tu enlace o código"
            aria-label="Enlace o código" autoComplete="off" autoCapitalize="off"
            className="rounded-full bg-white/10 px-5 py-4 text-center text-sm placeholder:text-white/50"
          />
          <button disabled={!texto.trim() || ocupado} className="rounded-full bg-accent py-4 font-semibold disabled:opacity-40">
            {ocupado ? 'Sumando…' : 'Sumar sello'}
          </button>
        </form>
      </Phone>
    </div>
  )
}
