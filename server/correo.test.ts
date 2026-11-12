import { test } from 'node:test'
import assert from 'node:assert/strict'
import { correoValido } from './correo.ts'

test('correoValido normaliza a minúsculas y recorta', () => {
  assert.equal(correoValido('a@b.co'), 'a@b.co')
  assert.equal(correoValido('  Dueno@Tienda.CL '), 'dueno@tienda.cl')
  assert.equal(correoValido('nombre.apellido+caja@mi-tienda.com.ar'), 'nombre.apellido+caja@mi-tienda.com.ar')
})

test('correoValido rechaza lo que no es un correo', () => {
  for (const malo of ['', '   ', 'abc', 'a@b', '@b.co', 'a@.co', 'a b@c.co', 'a@b..co', 'a@@b.co', 'a@b.c', 'a@b.co.', 'x'.repeat(250) + '@b.co', 123, null, undefined, {}, ['a@b.co']]) {
    assert.equal(correoValido(malo), null, `debería rechazar ${JSON.stringify(malo)}`)
  }
})
