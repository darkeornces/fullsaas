import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export function hashPin(pin: string): string {
  const sal = randomBytes(16)
  return `scrypt:${sal.toString('hex')}:${scryptSync(pin, sal, 32).toString('hex')}`
}

export function verificarPin(pin: unknown, hash: unknown): boolean {
  if (typeof pin !== 'string' || typeof hash !== 'string') return false
  const m = /^scrypt:([0-9a-f]{32}):([0-9a-f]{64})$/.exec(hash)
  if (!m) return false
  const calculado = scryptSync(pin, Buffer.from(m[1]!, 'hex'), 32)
  return timingSafeEqual(calculado, Buffer.from(m[2]!, 'hex'))
}
