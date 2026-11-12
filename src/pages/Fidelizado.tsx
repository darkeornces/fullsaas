import { useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, mensajeError } from '../api.ts'
import Phone from '../components/Phone.tsx'

export default function Fidelizado() {
  const { codigo = '' } = useParams()
  const navigate = useNavigate()
  const lanzado = useRef(false)

  useEffect(() => {
    if (lanzado.current) return
    lanzado.current = true
    api.usarEnlace(codigo).then(
      () => navigate('/app/sello', { replace: true }),
      (e: unknown) => navigate('/app', { replace: true, state: { aviso: mensajeError(e instanceof ApiError ? e.code : undefined) } }),
    )
  }, [codigo, navigate])

  return (
    <Phone className="items-center justify-center gap-3 text-muted">
      <p>Sumando tu sello…</p>
      <Link to="/app" className="text-xs underline">Ir a mi tarjeta</Link>
    </Phone>
  )
}
