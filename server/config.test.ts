import { test } from 'node:test'
import assert from 'node:assert/strict'
import { construirConfig } from './config.ts'

const base = { CAJA_PIN: '4321' }

test('sin CAJA_PIN no arranca (no hay PIN por defecto)', () => {
  assert.throws(() => construirConfig({}), /CAJA_PIN/)
  assert.throws(() => construirConfig({ CAJA_PIN: '' }), /CAJA_PIN/)
})

test('en desarrollo acepta un PIN corto y genera un secreto aleatorio distinto cada vez', () => {
  const a = construirConfig(base)
  const b = construirConfig(base)
  assert.equal(a.pin, '4321')
  assert.equal(a.sessionSecret.length >= 32, true)
  assert.notEqual(a.sessionSecret, b.sessionSecret)
})

test('en producción exige un PIN de al menos 6 caracteres', () => {
  assert.throws(() => construirConfig({ NODE_ENV: 'production', CAJA_PIN: '4321', SESSION_SECRET: 'x'.repeat(32), BASE_URL: 'https://a.onrender.com' }), /6/)
})

test('en producción exige SESSION_SECRET (si no, cada reinicio cierra todas las sesiones)', () => {
  assert.throws(() => construirConfig({ NODE_ENV: 'production', CAJA_PIN: '482913', BASE_URL: 'https://a.onrender.com' }), /SESSION_SECRET/)
  assert.throws(() => construirConfig({ NODE_ENV: 'production', CAJA_PIN: '482913', SESSION_SECRET: 'corto', BASE_URL: 'https://a.onrender.com' }), /SESSION_SECRET/)
})

test('en producción exige una BASE_URL https pública (los QR y enlaces dependen de ella)', () => {
  const prod = { NODE_ENV: 'production', CAJA_PIN: '482913', SESSION_SECRET: 'x'.repeat(32) }
  assert.throws(() => construirConfig(prod), /BASE_URL/)
  assert.throws(() => construirConfig({ ...prod, BASE_URL: 'http://localhost:3000' }), /BASE_URL/)
  assert.throws(() => construirConfig({ ...prod, BASE_URL: 'http://a.onrender.com' }), /BASE_URL/)
  const ok = construirConfig({ ...prod, BASE_URL: 'https://fidelhop.onrender.com/' })
  assert.equal(ok.baseUrl, 'https://fidelhop.onrender.com')
  assert.equal(ok.cookieSecure, true)
})

test('lee el resto de variables: puerto, Mongo, base, proxy y zona horaria', () => {
  const c = construirConfig({ ...base, PORT: '10000', MONGO_URL: 'mongodb+srv://u:p@x.mongodb.net', DB_NAME: 'prod', TRUST_PROXY: '1', TZ_COMERCIO: 'America/Santiago' })
  assert.equal(c.port, 10000)
  assert.equal(c.mongoUrl, 'mongodb+srv://u:p@x.mongodb.net')
  assert.equal(c.dbName, 'prod')
  assert.equal(c.trustProxy, 1)
  assert.equal(c.zonaHoraria, 'America/Santiago')
  assert.equal(c.cookieSecure, false)
})

test('la zona horaria por defecto es la de la tienda: America/Santiago', () => {
  assert.equal(construirConfig(base).zonaHoraria, 'America/Santiago')
})
