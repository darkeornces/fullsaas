import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { mensajeError, type ApiError } from '../api.ts'
import Phone from './Phone.tsx'

export function Cargando() {
  return <Phone className="items-center justify-center text-muted">Cargando…</Phone>
}

export function Fallo({ error, to, enlace }: { error: ApiError | null; to?: string; enlace?: string }) {
  return (
    <Phone className="items-center justify-center gap-4 px-8 text-center">
      <p className="font-head text-xl font-bold">{mensajeError(error?.code)}</p>
      {to && <Link to={to} className="rounded-full bg-green px-6 py-3 font-semibold text-white">{enlace}</Link>}
    </Phone>
  )
}

export function Aviso({ children }: { children?: ReactNode }) {
  return children ? <p role="alert" className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-[#b23a17]">{children}</p> : null
}
