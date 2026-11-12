import { randomBytes } from 'node:crypto'
import type { Config } from './tipos.ts'

export function construirConfig(env: Record<string, string | undefined>): Config {
  if (!env.CAJA_PIN) throw new Error('Falta CAJA_PIN: define el PIN de la caja (no hay valor por defecto).')

  const produccion = env.NODE_ENV === 'production'
  const baseUrl = (env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  if (produccion) {
    if (env.CAJA_PIN.length < 6) throw new Error('En producción CAJA_PIN debe tener al menos 6 caracteres.')
    if ((env.SESSION_SECRET ?? '').length < 32) {
      throw new Error('En producción define SESSION_SECRET (mínimo 32 caracteres); si no, cada reinicio cierra todas las sesiones.')
    }
    if (!/^https:\/\//.test(baseUrl) || /localhost|127\.0\.0\.1/.test(baseUrl)) {
      throw new Error('En producción BASE_URL debe ser la dirección pública con https (los QR y enlaces dependen de ella).')
    }
  }

  return {
    nombre: 'Casa Lola',
    premio: 'almuerzo gratis',
    sellosRequeridos: 10,
    enlaceVigenciaHoras: 48,
    enlaceEsperaMinutos: 60,
    sesionHoras: 12,
    clienteSesionDias: 180,
    zonaHoraria: env.TZ_COMERCIO ?? 'Europe/Madrid',
    pin: env.CAJA_PIN,
    sessionSecret: env.SESSION_SECRET ?? randomBytes(32).toString('hex'),
    baseUrl,
    cookieSecure: baseUrl.startsWith('https://'),
    trustProxy: env.TRUST_PROXY === '1' ? 1 : false,
    mongoUrl: env.MONGO_URL ?? 'mongodb://127.0.0.1:27017',
    dbName: env.DB_NAME ?? 'fidelhop',
    port: Number(env.PORT ?? 3000),
  }
}
