import { useCallback, useEffect, useState } from 'react'
import { ApiError, mensajeError } from './api.ts'

export function useCarga<T>(fn: () => Promise<T>, deps: unknown[], { cada }: { cada?: number } = {}) {
  const [estado, setEstado] = useState<{ datos: T | null; error: ApiError | null; cargando: boolean }>({ datos: null, error: null, cargando: true })
  const cargar = useCallback((silencioso = false) => {
    let activo = true
    fn().then(
      (datos) => { if (activo) setEstado({ datos, error: null, cargando: false }) },
      (e: unknown) => {
        if (!activo) return
        const error = e instanceof ApiError ? e : new ApiError('ERROR_INTERNO')
        setEstado((previo) => (silencioso && previo.datos !== null ? previo : { datos: null, error, cargando: false }))
      },
    )
    return () => { activo = false }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => cargar(), [cargar])

  useEffect(() => {
    if (!cada) return
    const refrescar = () => { if (document.visibilityState === 'visible') cargar(true) }
    const id = setInterval(refrescar, cada)
    document.addEventListener('visibilitychange', refrescar)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', refrescar) }
  }, [cargar, cada])

  return { ...estado, recargar: () => { cargar() } }
}

export function useAccion() {
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const ejecutar = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setOcupado(true); setError(null)
    try {
      return await fn()
    } catch (e) {
      setError(e instanceof ApiError ? mensajeError(e.code, e.datos) : mensajeError(undefined))
      return undefined
    } finally {
      setOcupado(false)
    }
  }
  return { error, ocupado, ejecutar }
}
