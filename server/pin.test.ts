import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashPin, verificarPin } from './pin.ts'

test('hashPin no guarda el PIN en claro y verificarPin lo reconoce', () => {
  const h = hashPin('482913')
  assert.match(h, /^scrypt:[0-9a-f]{32}:[0-9a-f]{64}$/)
  assert.ok(!h.includes('482913'))
  assert.equal(verificarPin('482913', h), true)
})

test('verificarPin rechaza un PIN distinto, vacío o que no es texto', () => {
  const h = hashPin('482913')
  for (const malo of ['482914', '', ' 482913', '48291', 482913, null, undefined]) assert.equal(verificarPin(malo, h), false)
})

test('cada hash lleva su propia sal: el mismo PIN da hashes distintos que igual verifican', () => {
  const a = hashPin('482913'), b = hashPin('482913')
  assert.notEqual(a, b)
  assert.equal(verificarPin('482913', a), true)
  assert.equal(verificarPin('482913', b), true)
})

test('verificarPin con un hash ausente o corrupto devuelve false sin lanzar', () => {
  for (const mal of [undefined, null, '', 'abc', 'scrypt:xx:yy', 'scrypt:' + 'a'.repeat(32) + ':zz', 5]) assert.equal(verificarPin('482913', mal), false)
})
