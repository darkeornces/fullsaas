import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { api, ApiError } from '../api.ts'
import { useAccion } from '../hooks.ts'
import type { Tarjeta } from '../tipos.ts'
import Phone from '../components/Phone.tsx'
import { Aviso, Cargando, Fallo } from '../components/Estado.tsx'

export interface ClienteCtx { tarjeta: Tarjeta; recargar: () => Promise<void>; salir: () => Promise<void> }
export const useCliente = () => useOutletContext<ClienteCtx>()

type Estado = { tipo: 'cargando' } | { tipo: 'anonimo' } | { tipo: 'error'; error: ApiError } | { tipo: 'ok'; tarjeta: Tarjeta }

export default function ClienteGate() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' })
  const [numero, setNumero] = useState('')
  const { error, ocupado, ejecutar } = useAccion()
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso

  const recargar = useCallback(async () => {
    setEstado({ tipo: 'ok', tarjeta: await api.tarjeta() })
  }, [])
  const salir = useCallback(async () => {
    await api.salir()
    setEstado({ tipo: 'anonimo' })
  }, [])

  useEffect(() => {
    api.tarjeta().then(
      (tarjeta) => setEstado({ tipo: 'ok', tarjeta }),
      (e: unknown) => setEstado(e instanceof ApiError && e.status === 401 ? { tipo: 'anonimo' } : { tipo: 'error', error: e instanceof ApiError ? e : new ApiError('ERROR_INTERNO') }),
    )
  }, [])

  const logueado = estado.tipo === 'ok'
  useEffect(() => {
    if (!logueado) return
    const refrescar = () => {
      if (document.visibilityState === 'visible') api.tarjeta().then((tarjeta) => setEstado({ tipo: 'ok', tarjeta }), () => {})
    }
    const id = setInterval(refrescar, 10_000)
    document.addEventListener('visibilitychange', refrescar)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refrescar) }
  }, [logueado])

  if (estado.tipo === 'cargando') return <Cargando />
  if (estado.tipo === 'error') return <Fallo error={estado.error} />
  if (estado.tipo === 'ok') return <Outlet context={{ tarjeta: estado.tarjeta, recargar, salir } satisfies ClienteCtx} />

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault()
    const tarjeta = await ejecutar(() => api.entrar(numero))
    if (tarjeta) setEstado({ tipo: 'ok', tarjeta })
  }
  return (
    <Phone className="justify-center gap-6 px-8">
      <div>
        <h1 className="font-head text-4xl font-bold text-green">Tu tarjeta de sellos</h1>
        <p className="mt-2 text-muted">Escribe tu número de WhatsApp y guardamos tus sellos. Sin descargas ni contraseñas.</p>
      </div>
      <form onSubmit={entrar} className="flex flex-col gap-3">
        <label htmlFor="num" className="text-sm font-semibold">Tu número de WhatsApp</label>
        <input
          id="num" type="tel" inputMode="tel" autoComplete="tel" autoFocus placeholder="+34 612 345 187"
          value={numero} onChange={(e) => setNumero(e.target.value)}
          className="rounded-2xl border-2 border-line bg-surface px-4 py-3.5 text-xl focus:border-green focus:outline-none"
        />
        <Aviso>{error ?? aviso}</Aviso>
        <button disabled={!numero.trim() || ocupado} className="rounded-full bg-accent py-4 text-base font-bold text-white disabled:opacity-40">
          {ocupado ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </Phone>
  )
}
