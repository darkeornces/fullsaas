const STATUS: Record<string, number> = {
  NO_AUTORIZADO: 401,
  NO_ENCONTRADO: 404,
  ENLACE_NO_EXISTE: 404,
  WHATSAPP_INVALIDO: 400,
  DATOS_INVALIDOS: 400,
  TARJETA_COMPLETA: 409,
  SIN_PREMIO: 409,
  ENLACE_USADO: 409,
  ENLACE_EXPIRADO: 410,
  DEMASIADOS_INTENTOS: 429,
  ESPERA_REQUERIDA: 429,
}

export class AppError extends Error {
  code: string
  status: number
  datos: Record<string, unknown> | undefined

  constructor(code: string, datos?: Record<string, unknown>) {
    super(code)
    this.code = code
    this.status = STATUS[code] ?? 500
    this.datos = datos
  }
}
