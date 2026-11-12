export interface Config {
  nombre: string
  premio: string
  sellosRequeridos: number
  enlaceVigenciaHoras: number
  enlaceEsperaMinutos: number
  sesionHoras: number
  clienteSesionDias: number
  zonaHoraria: string
  pin: string
  sessionSecret: string
  baseUrl: string
  cookieSecure: boolean
  trustProxy: number | false
  mongoUrl: string
  dbName: string
  port: number
}

export interface Cliente {
  codigo: string
  whatsapp: string
  sellos: number
  canjes: number
  creadoEn: Date
}

export interface Enlace {
  codigo: string
  cliente: string
  usado: boolean
  creadoEn: Date
  expiraEn: Date
  usadoEn?: Date
  revocado?: boolean
}

export interface Movimiento {
  tipo: 'alta' | 'sello' | 'canje'
  fecha: Date
  codigo: string
  origen?: 'enlace'
  whatsapp: string | null
  sellos: number | null
}

export interface Resumen {
  sellosHoy: number
  clientesNuevos: number
  canjes: number
}
