import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hace, etiquetaMovimiento } from './format.ts'

const ahora = new Date('2026-11-11T13:00:00Z')
const antes = (ms: number) => new Date(ahora.getTime() - ms).toISOString()

test('hace: segundos, minutos, horas y días', () => {
  assert.equal(hace(antes(20_000), ahora), 'ahora mismo')
  assert.equal(hace(antes(60_000), ahora), 'hace 1 min')
  assert.equal(hace(antes(45 * 60_000), ahora), 'hace 45 min')
  assert.equal(hace(antes(3 * 3_600_000), ahora), 'hace 3 h')
  assert.equal(hace(antes(30 * 3_600_000), ahora), 'ayer')
  assert.equal(hace(antes(4 * 86_400_000), ahora), 'hace 4 días')
})

test('hace: una fecha futura (reloj desajustado) no da valores negativos', () => {
  assert.equal(hace(new Date(ahora.getTime() + 5000).toISOString(), ahora), 'ahora mismo')
})

test('etiquetaMovimiento describe cada tipo de movimiento', () => {
  assert.deepEqual(etiquetaMovimiento({ tipo: 'alta', whatsapp: null, codigo: 'CL-7K4Q' }), { etiqueta: 'Alta', detalle: 'Cliente nuevo' })
  assert.deepEqual(etiquetaMovimiento({ tipo: 'sello', origen: 'enlace' }), { etiqueta: '+1 sello', detalle: 'Con enlace de un solo uso' })
  assert.deepEqual(etiquetaMovimiento({ tipo: 'sello' }), { etiqueta: '+1 sello', detalle: 'En el local' })
  assert.deepEqual(etiquetaMovimiento({ tipo: 'canje' }), { etiqueta: 'Canje', detalle: 'Premio canjeado' })
})
