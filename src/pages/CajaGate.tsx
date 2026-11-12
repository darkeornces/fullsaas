import { useState } from 'react'
import { Outlet, useOutletContext } from 'react-router-dom'
import { api } from '../api.ts'
import { useAccion, useCarga } from '../hooks.ts'
import type { SesionCaja } from '../tipos.ts'
import Phone from '../components/Phone.tsx'
import { Aviso, Cargando } from '../components/Estado.tsx'

export const useCaja = () => useOutletContext<SesionCaja>()

export default function CajaGate() {
  const { datos, error, cargando, recargar } = useCarga(() => api.sesion(), [])
  const [pin, setPin] = useState('')
  const { error: errorLogin, ocupado, ejecutar } = useAccion()

  if (error) return <Phone className="items-center justify-center px-8 text-center"><Aviso>No se pudo comprobar la sesión.</Aviso></Phone>
  if (cargando) return <Cargando />
  if (datos) return <Outlet context={datos} />

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (await ejecutar(async () => { await api.login(pin); return true })) recargar()
  }
  return (
    <Phone className="justify-center gap-5 px-8">
      <h1 className="font-head text-3xl font-bold">Caja</h1>
      <form onSubmit={entrar} className="flex flex-col gap-3">
        <label className="text-sm font-semibold" htmlFor="pin">PIN de la caja</label>
        <input
          id="pin" type="password" inputMode="numeric" autoComplete="current-password" autoFocus
          value={pin} onChange={(e) => setPin(e.target.value)}
          className="rounded-2xl border-2 border-line bg-surface px-4 py-3.5 text-center text-2xl tracking-[0.5em] focus:border-green focus:outline-none"
        />
        <Aviso>{errorLogin}</Aviso>
        <button disabled={!pin || ocupado} className="rounded-full bg-green py-4 text-base font-bold text-white disabled:opacity-40">
          {ocupado ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </Phone>
  )
}
