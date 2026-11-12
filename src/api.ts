import type { Ajustes, ClienteCaja, Fidelizacion, Movimiento, Resumen, SesionCaja, Tarjeta } from './tipos.ts'

export class ApiError extends Error {
  code: string
  status: number
  datos: { minutos?: number } | undefined

  constructor(code: string, status = 0, datos?: { minutos?: number }) {
    super(code)
    this.code = code
    this.status = status
    this.datos = datos
  }
}

const MENSAJES: Record<string, string> = {
  CREDENCIALES_INCORRECTAS: 'Correo o PIN incorrectos.',
  DEMASIADOS_INTENTOS: 'Demasiados intentos. Espera unos minutos.',
  NO_AUTORIZADO: 'Tu sesión caducó. Vuelve a entrar.',
  NO_ENCONTRADO: 'No encontramos ese cliente.',
  ENLACE_NO_EXISTE: 'Ese enlace o código no existe.',
  ENLACE_USADO: 'Ese enlace ya se usó: cada código vale una sola vez.',
  ENLACE_EXPIRADO: 'Ese enlace ya caducó. Pide uno nuevo en caja.',
  TARJETA_COMPLETA: 'La tarjeta está completa: toca canjear el premio antes de seguir sumando.',
  SIN_PREMIO: 'Todavía no tiene sellos suficientes para canjear.',
  WHATSAPP_INVALIDO: 'Escribe el WhatsApp con prefijo internacional, por ejemplo +34 612 345 187.',
  DATOS_INVALIDOS: 'Revisa los datos e inténtalo de nuevo.',
  ESPERA_REQUERIDA: 'Este número ya se fidelizó hace poco.',
  SIN_CONEXION: 'Sin conexión con el servidor. Revisa tu conexión a internet.',
}

export function codigoDeEnlace(texto: string): string {
  const limpio = texto.trim()
  const m = /\/f\/([\w-]+)/.exec(limpio)
  return m?.[1] ?? limpio
}

export function codigoDeCliente(texto: string): string | null {
  if (/\/f\//.test(texto)) return null
  const m = /(?<![A-Za-z0-9])CL-([A-Za-z0-9]{4})(?![A-Za-z0-9])/i.exec(texto.trim())
  return m ? `CL-${m[1]}`.toUpperCase() : null
}

export function mensajeError(code: string | undefined, datos?: { minutos?: number }): string {
  if (code === 'ESPERA_REQUERIDA' && datos?.minutos) {
    const m = datos.minutos
    return `Este número ya se fidelizó hace poco. Podrás generar otro código en ${m} ${m === 1 ? 'minuto' : 'minutos'}.`
  }
  return (code && MENSAJES[code]) || 'Algo salió mal. Inténtalo de nuevo.'
}

type Pedir = <T>(ruta: string, opciones?: { metodo?: string; cuerpo?: unknown }) => Promise<T>

export function createApi(fetchImpl: typeof fetch = (...a) => globalThis.fetch(...a)) {
  const pedir: Pedir = async (ruta, { metodo = 'GET', cuerpo } = {}) => {
    let res: Response
    try {
      res = await fetchImpl('/api' + ruta, {
        method: metodo,
        headers: cuerpo === undefined ? {} : { 'content-type': 'application/json' },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      })
    } catch {
      throw new ApiError('SIN_CONEXION')
    }
    let datos: unknown
    try {
      datos = await res.json()
    } catch {
      if (res.ok) return null as never
      throw new ApiError('ERROR_INTERNO', res.status)
    }
    if (!res.ok) {
      const cuerpoError = datos as { error?: string; minutos?: number } | null
      throw new ApiError(cuerpoError?.error ?? 'ERROR_INTERNO', res.status, cuerpoError?.minutos ? { minutos: cuerpoError.minutos } : undefined)
    }
    return datos as never
  }

  const enc = encodeURIComponent
  const post = <T>(ruta: string, cuerpo?: unknown) => pedir<T>(ruta, { metodo: 'POST', cuerpo })
  const put = <T>(ruta: string, cuerpo?: unknown) => pedir<T>(ruta, { metodo: 'PUT', cuerpo })

  return {
    entrar: (whatsapp: string) => post<Tarjeta>('/entrar', { whatsapp }),
    salir: () => post<{ ok: true }>('/salir'),
    tarjeta: () => pedir<Tarjeta>('/tarjeta'),
    usarEnlace: (codigo: string) => post<Tarjeta>(`/enlaces/${encodeURIComponent(codigo)}/usar`),

    login: (pin: string, correo: string) => post<{ ok: true }>('/caja/login', { pin, correo }),
    logout: () => post<{ ok: true }>('/caja/logout'),
    cambiarPin: (datos: { pinActual: string; pinNuevo: string }) => put<{ ok: true }>('/caja/pin', datos),
    sesion: () => pedir<SesionCaja>('/caja/sesion').catch((e: unknown) => (e instanceof ApiError && e.status === 401 ? null : Promise.reject(e))),
    resumen: () => pedir<Resumen>('/caja/resumen'),
    ajustes: () => pedir<Ajustes>('/caja/ajustes'),
    guardarAjustes: (ajustes: Partial<Ajustes>) => put<Ajustes>('/caja/ajustes', ajustes),
    movimientos: () => pedir<Movimiento[]>('/caja/movimientos'),
    fidelizar: (whatsapp: string) => post<Fidelizacion>('/caja/fidelizar', { whatsapp }),
    buscar: (q: string) => pedir<ClienteCaja>(`/caja/buscar?q=${enc(q)}`),
    cliente: (codigo: string) => pedir<ClienteCaja>(`/caja/clientes/${enc(codigo)}`),
    canjear: (codigo: string) => post<ClienteCaja>(`/caja/clientes/${enc(codigo)}/canjear`),
  }
}

export const api = createApi()
