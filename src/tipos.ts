export interface Tarjeta {
  codigo: string
  comercio: string
  premio: string
  sellos: number
  total: number
  whatsapp: string | null
}

export interface ClienteCaja {
  codigo: string
  whatsapp: string
  sellos: number
  canjes: number
  creadoEn: string
}

export interface Resumen { sellosHoy: number; clientesNuevos: number; canjes: number }

export interface Movimiento {
  tipo: 'alta' | 'sello' | 'canje'
  fecha: string
  codigo: string
  origen?: 'enlace'
  whatsapp: string | null
  sellos: number | null
}

export interface Fidelizacion {
  cliente: ClienteCaja
  enlace: { codigo: string; url: string; expiraEn: string }
  waLink: string
  reutilizado: boolean
}

export interface SesionCaja { ok: true; comercio: string; premio: string; total: number }

export interface Ajustes { enlaceEsperaMinutos: number; nombre: string; correo?: string }
