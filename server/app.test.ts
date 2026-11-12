import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { MongoClient, type Db } from 'mongodb'
import { createRepo } from './repo.ts'
import { createApp } from './app.ts'
import type { Config } from './tipos.ts'

const URL = process.env.TEST_MONGO_URL ?? 'mongodb://127.0.0.1:27017'
const config: Config = {
  nombre: 'Casa Lola', premio: 'almuerzo gratis', sellosRequeridos: 3, enlaceVigenciaHoras: 48, enlaceEsperaMinutos: 60,
  pin: '4321', sessionSecret: 'secreto-de-prueba', sesionHoras: 12, clienteSesionDias: 180, cookieSecure: false,
  baseUrl: 'https://fidelhop.test', trustProxy: false, zonaHoraria: 'Europe/Madrid',
  mongoUrl: '', dbName: '', port: 0,
}
let client: MongoClient, db: Db, server: Server | undefined, base: string, ahora: Date

before(async () => {
  client = await MongoClient.connect(URL)
  db = client.db(`fidelhop_http_${process.pid}`)
})
after(async () => {
  server?.closeAllConnections()
  server?.close()
  await db.dropDatabase()
  await client.close()
})
beforeEach(async () => {
  server?.closeAllConnections()
  server?.close()
  await db.dropDatabase()
  ahora = new Date('2026-11-11T13:00:00Z')
  const repo = createRepo(db, config, () => ahora)
  await repo.init()
  server = createApp({ repo, config, now: () => ahora }).listen(0)
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

interface Opciones { metodo?: string; cuerpo?: unknown; cookie?: string; crudo?: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Resp = { status: number; headers: Headers; json: any; texto: string }

const api = async (ruta: string, { metodo = 'GET', cuerpo, cookie, crudo }: Opciones = {}): Promise<Resp> => {
  const res = await fetch(base + ruta, {
    method: metodo,
    headers: { ...(cuerpo || crudo ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: crudo ?? (cuerpo ? JSON.stringify(cuerpo) : undefined),
  })
  const texto = await res.text()
  return { status: res.status, headers: res.headers, json: texto ? JSON.parse(texto) : null, texto }
}
const cookieDe = (r: Resp) => r.headers.get('set-cookie')?.split(';')[0] ?? ''
const login = async (pin = config.pin) => {
  const r = await api('/api/caja/login', { metodo: 'POST', cuerpo: { pin } })
  return { r, cookie: cookieDe(r) }
}
const conSesion = async () => (await login()).cookie
const entrar = async (whatsapp = '+34 612 345 187') => {
  const r = await api('/api/entrar', { metodo: 'POST', cuerpo: { whatsapp } })
  return { r, cookie: cookieDe(r) }
}

const sumarPorEnlace = async (cookie: string, whatsapp: string) => {
  await db.collection<{ _id: string; enlaceEsperaMinutos: number }>('ajustes').updateOne({ _id: 'general' }, { $set: { enlaceEsperaMinutos: 0 } }, { upsert: true })
  const f = (await api('/api/caja/fidelizar', { metodo: 'POST', cookie, cuerpo: { whatsapp } })).json
  const r = await api(`/api/enlaces/${f.enlace.codigo}/usar`, { metodo: 'POST' })
  return { f, r }
}

// ---------- caja: sesión ----------
test('login con PIN correcto da cookie httpOnly SameSite=Strict y no devuelve el PIN', async () => {
  const { r } = await login()
  assert.equal(r.status, 200)
  const c = r.headers.get('set-cookie')
  assert.match(c ?? '', /HttpOnly/i)
  assert.match(c ?? '', /SameSite=Strict/i)
  assert.ok(!r.texto.includes(config.pin))
})

test('login con PIN incorrecto da 401 y sin cookie', async () => {
  const { r } = await login('0000')
  assert.equal(r.status, 401)
  assert.equal(r.headers.get('set-cookie'), null)
})

test('endpoints de caja sin sesión o con cookie manipulada dan 401', async () => {
  assert.equal((await api('/api/caja/movimientos')).status, 401)
  assert.equal((await api('/api/caja/movimientos', { cookie: 'caja=1.falsa' })).status, 401)
  const cookie = await conSesion()
  assert.equal((await api('/api/caja/movimientos', { cookie })).status, 200)
  assert.equal((await api('/api/caja/movimientos', { cookie: cookie.slice(0, -2) + 'xx' })).status, 401)
})

test('la cookie de un cliente no sirve como sesión de caja', async () => {
  const { cookie } = await entrar()
  assert.equal((await api('/api/caja/movimientos', { cookie })).status, 401)
})

test('la sesión de caja caduca', async () => {
  const cookie = await conSesion()
  ahora = new Date(ahora.getTime() + 13 * 3_600_000)
  assert.equal((await api('/api/caja/movimientos', { cookie })).status, 401)
})

test('logout de caja invalida la cookie en el navegador', async () => {
  const r = await api('/api/caja/logout', { metodo: 'POST', cookie: await conSesion() })
  assert.equal(r.status, 200)
  assert.match(r.headers.get('set-cookie') ?? '', /Max-Age=0/i)
})

test('tras 5 PIN erróneos se bloquea el login (429) incluso con el PIN correcto', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await login('0000')).r.status, 401)
  assert.equal((await login()).r.status, 429)
  ahora = new Date(ahora.getTime() + 16 * 60_000)
  assert.equal((await login()).r.status, 200)
})

test('GET /api/caja/sesion: 401 sin sesión, 200 con sesión', async () => {
  assert.equal((await api('/api/caja/sesion')).status, 401)
  const r = await api('/api/caja/sesion', { cookie: await conSesion() })
  assert.equal(r.status, 200)
  assert.deepEqual(r.json, { ok: true, comercio: 'Casa Lola', premio: 'almuerzo gratis', total: 3 })
})

// ---------- cliente: entrar con su número ----------
test('entrar con el número crea la tarjeta y da una cookie de cliente httpOnly', async () => {
  const { r } = await entrar()
  assert.equal(r.status, 200)
  assert.match(r.json.codigo, /^CL-[A-Z0-9]{4}$/)
  assert.equal(r.json.sellos, 0)
  assert.equal(r.json.total, 3)
  const c = r.headers.get('set-cookie') ?? ''
  assert.match(c, /^cliente=/)
  assert.match(c, /HttpOnly/i)
  assert.match(c, /SameSite=Strict/i)
})

test('entrar otra vez con el mismo número devuelve la misma tarjeta con sus sellos', async () => {
  const a = await entrar('+34 612 345 187')
  await sumarPorEnlace(await conSesion(), '+34 612 345 187')
  const b = await entrar('0034612345187')
  assert.equal(b.r.json.codigo, a.r.json.codigo)
  assert.equal(b.r.json.sellos, 1)
})

test('entrar con un número inválido da 400 y no crea cookie', async () => {
  const { r } = await entrar('hola')
  assert.equal(r.status, 400)
  assert.equal(r.json.error, 'WHATSAPP_INVALIDO')
  assert.equal(r.headers.get('set-cookie'), null)
  assert.equal((await api('/api/entrar', { metodo: 'POST', cuerpo: { whatsapp: { $ne: 1 } } })).status, 400)
  assert.equal((await api('/api/entrar', { metodo: 'POST', cuerpo: {} })).status, 400)
})

test('entrar tiene límite por IP para evitar altas masivas (429)', async () => {
  for (let i = 0; i < 20; i++) assert.equal((await entrar(`+3460000${String(i).padStart(4, '0')}`)).r.status, 200)
  assert.equal((await entrar('+34699999999')).r.status, 429)
  ahora = new Date(ahora.getTime() + 16 * 60_000)
  assert.equal((await entrar('+34699999999')).r.status, 200)
})

test('tarjeta: sin cookie 401; con cookie datos propios con WhatsApp enmascarado', async () => {
  assert.equal((await api('/api/tarjeta')).status, 401)
  assert.equal((await api('/api/tarjeta', { cookie: 'cliente=CL-AAAA.99999999999.falsa' })).status, 401)
  const { cookie } = await entrar()
  const r = await api('/api/tarjeta', { cookie })
  assert.equal(r.status, 200)
  assert.deepEqual(Object.keys(r.json).sort(), ['codigo', 'comercio', 'premio', 'sellos', 'total', 'whatsapp'])
  assert.equal(r.json.whatsapp, '+34 ••• ••• 187')
  assert.equal(r.json.comercio, 'Casa Lola')
})

test('una cookie de cliente firmada pero de un cliente que ya no existe da 401', async () => {
  const { cookie } = await entrar()
  await db.collection('clientes').deleteMany({})
  assert.equal((await api('/api/tarjeta', { cookie })).status, 401)
})

test('la sesión de cliente caduca a los 180 días', async () => {
  const { cookie } = await entrar()
  ahora = new Date(ahora.getTime() + 181 * 86_400_000)
  assert.equal((await api('/api/tarjeta', { cookie })).status, 401)
})

test('salir borra la cookie del cliente', async () => {
  const { cookie } = await entrar()
  const r = await api('/api/salir', { metodo: 'POST', cookie })
  assert.equal(r.status, 200)
  assert.match(r.headers.get('set-cookie') ?? '', /^cliente=;.*Max-Age=0/i)
})

// ---------- fidelizar: enlace de un solo uso ----------
test('fidelizar exige sesión de caja y un número válido', async () => {
  assert.equal((await api('/api/caja/fidelizar', { metodo: 'POST', cuerpo: { whatsapp: '+34612345187' } })).status, 401)
  const cookie = await conSesion()
  const mal = await api('/api/caja/fidelizar', { metodo: 'POST', cookie, cuerpo: { whatsapp: 'hola' } })
  assert.equal(mal.status, 400)
  assert.equal(mal.json.error, 'WHATSAPP_INVALIDO')
})

test('fidelizar devuelve cliente, enlace de un solo uso y mensaje de WhatsApp; aún no suma', async () => {
  const cookie = await conSesion()
  const r = await api('/api/caja/fidelizar', { metodo: 'POST', cookie, cuerpo: { whatsapp: '+34 612 345 187' } })
  assert.equal(r.status, 201)
  assert.equal(r.json.cliente.whatsapp, '+34612345187')
  assert.equal(r.json.cliente.sellos, 0)
  assert.equal(r.json.enlace.url, `https://fidelhop.test/f/${r.json.enlace.codigo}`)
  assert.equal(r.json.enlace.expiraEn, '2026-11-13T13:00:00.000Z')
  assert.equal(r.json.waLink.startsWith('https://wa.me/34612345187?text='), true)
  assert.ok(decodeURIComponent(r.json.waLink).includes(r.json.enlace.url))
})

test('abrir el enlace (POST) suma el sello, inicia la sesión del cliente y se gasta', async () => {
  const cookie = await conSesion()
  const { enlace } = (await api('/api/caja/fidelizar', { metodo: 'POST', cookie, cuerpo: { whatsapp: '+34612345187' } })).json
  const a = await api(`/api/enlaces/${enlace.codigo}/usar`, { metodo: 'POST' })
  assert.equal(a.status, 200)
  assert.equal(a.json.sellos, 1)
  assert.match(a.headers.get('set-cookie') ?? '', /^cliente=.*HttpOnly/i)
  const tarjeta = await api('/api/tarjeta', { cookie: cookieDe(a) })
  assert.equal(tarjeta.json.sellos, 1)
  const b = await api(`/api/enlaces/${enlace.codigo}/usar`, { metodo: 'POST' })
  assert.equal(b.status, 409)
  assert.equal(b.json.error, 'ENLACE_USADO')
  assert.equal(b.headers.get('set-cookie'), null)
})

test('un GET al enlace NO lo gasta (las vistas previas de WhatsApp no deben consumirlo)', async () => {
  const cookie = await conSesion()
  const { enlace } = (await api('/api/caja/fidelizar', { metodo: 'POST', cookie, cuerpo: { whatsapp: '+34612345187' } })).json
  assert.equal((await api(`/api/enlaces/${enlace.codigo}/usar`)).status, 404)
  assert.equal((await api(`/api/enlaces/${enlace.codigo}`)).status, 404)
  assert.equal((await api(`/api/enlaces/${enlace.codigo}/usar`, { metodo: 'POST' })).status, 200)
})

test('enlace inexistente da 404 y no inicia sesión', async () => {
  const r = await api('/api/enlaces/no-existe-no-existe/usar', { metodo: 'POST' })
  assert.equal(r.status, 404)
  assert.equal(r.json.error, 'ENLACE_NO_EXISTE')
  assert.equal(r.headers.get('set-cookie'), null)
})

test('con la tarjeta completa el enlace no se gasta', async () => {
  const cookie = await conSesion()
  for (let i = 0; i < 3; i++) await sumarPorEnlace(cookie, '+34612345187')
  const { f, r } = await sumarPorEnlace(cookie, '+34612345187')
  assert.equal(r.status, 409)
  assert.equal(r.json.error, 'TARJETA_COMPLETA')
  await api(`/api/caja/clientes/${f.cliente.codigo}/canjear`, { metodo: 'POST', cookie })
  assert.equal((await api(`/api/enlaces/${f.enlace.codigo}/usar`, { metodo: 'POST' })).status, 200)
})

test('fidelizar el mismo número dentro de la hora devuelve el mismo enlace (200, reutilizado)', async () => {
  const cookie = await conSesion()
  const pedir = () => api('/api/caja/fidelizar', { metodo: 'POST', cookie, cuerpo: { whatsapp: '+34 612 345 187' } })
  const a = await pedir()
  assert.equal(a.status, 201)
  assert.equal(a.json.reutilizado, false)
  ahora = new Date(ahora.getTime() + 20 * 60_000)
  const b = await pedir()
  assert.equal(b.status, 200)
  assert.equal(b.json.reutilizado, true)
  assert.equal(b.json.enlace.codigo, a.json.enlace.codigo)
  assert.equal(b.json.enlace.url, a.json.enlace.url)
})

test('si el enlace ya se usó, fidelizar de nuevo da 429 con los minutos que faltan; pasada la hora, uno nuevo', async () => {
  const cookie = await conSesion()
  const pedir = () => api('/api/caja/fidelizar', { metodo: 'POST', cookie, cuerpo: { whatsapp: '+34612345187' } })
  const a = await pedir()
  await api(`/api/enlaces/${a.json.enlace.codigo}/usar`, { metodo: 'POST' })
  ahora = new Date(ahora.getTime() + 15 * 60_000)
  const espera = await pedir()
  assert.equal(espera.status, 429)
  assert.equal(espera.json.error, 'ESPERA_REQUERIDA')
  assert.equal(espera.json.minutos, 45)
  ahora = new Date(ahora.getTime() + 46 * 60_000)
  const nuevo = await pedir()
  assert.equal(nuevo.status, 201)
  assert.notEqual(nuevo.json.enlace.codigo, a.json.enlace.codigo)
})

test('pasada la hora, el enlace anterior sin usar deja de valer', async () => {
  const cookie = await conSesion()
  const pedir = () => api('/api/caja/fidelizar', { metodo: 'POST', cookie, cuerpo: { whatsapp: '+34612345187' } })
  const viejo = await pedir()
  ahora = new Date(ahora.getTime() + 61 * 60_000)
  const nuevo = await pedir()
  const r = await api(`/api/enlaces/${viejo.json.enlace.codigo}/usar`, { metodo: 'POST' })
  assert.equal(r.status, 410)
  assert.equal(r.json.error, 'ENLACE_EXPIRADO')
  assert.equal((await api(`/api/enlaces/${nuevo.json.enlace.codigo}/usar`, { metodo: 'POST' })).status, 200)
})

// ---------- caja: clientes ----------
test('caja busca por número o por código; 404 si no existe', async () => {
  const cookie = await conSesion()
  const c = (await api('/api/caja/fidelizar', { metodo: 'POST', cookie, cuerpo: { whatsapp: '+34612345187' } })).json.cliente
  const porNumero = await api('/api/caja/buscar?q=' + encodeURIComponent('+34 612 345 187'), { cookie })
  assert.equal(porNumero.json.codigo, c.codigo)
  const porCodigo = await api('/api/caja/buscar?q=' + c.codigo.toLowerCase(), { cookie })
  assert.equal(porCodigo.json.codigo, c.codigo)
  assert.equal((await api('/api/caja/buscar?q=%2B34699999999', { cookie })).status, 404)
  assert.equal((await api('/api/caja/buscar', { cookie })).status, 404)
})

test('canjear exige la tarjeta completa y la reinicia', async () => {
  const cookie = await conSesion()
  const { f } = await sumarPorEnlace(cookie, '+34612345187')
  const codigo = f.cliente.codigo
  const canjear = () => api(`/api/caja/clientes/${codigo}/canjear`, { metodo: 'POST', cookie })
  assert.equal((await canjear()).status, 409)
  await sumarPorEnlace(cookie, '+34612345187')
  await sumarPorEnlace(cookie, '+34612345187')
  const canje = await canjear()
  assert.equal(canje.status, 200)
  assert.equal(canje.json.sellos, 0)
  assert.equal((await canjear()).status, 409)
})

test('no existe forma de sumar un sello sin token: la ruta manual ya no existe', async () => {
  const cookie = await conSesion()
  const { f } = await sumarPorEnlace(cookie, '+34612345187')
  const r = await api(`/api/caja/clientes/${f.cliente.codigo}/sellos`, { metodo: 'POST', cookie })
  assert.equal(r.status, 404)
  assert.equal((await api(`/api/caja/clientes/${f.cliente.codigo}`, { cookie })).json.sellos, 1)
})

test('cliente inexistente da 404', async () => {
  const cookie = await conSesion()
  assert.equal((await api('/api/caja/clientes/CL-ZZZZ/canjear', { metodo: 'POST', cookie })).status, 404)
  assert.equal((await api('/api/caja/clientes/CL-ZZZZ', { cookie })).status, 404)
})

test('resumen del día y movimientos (WhatsApp enmascarado) solo para la caja', async () => {
  assert.equal((await api('/api/caja/resumen')).status, 401)
  const cookie = await conSesion()
  await sumarPorEnlace(cookie, '+34612345187')
  assert.deepEqual((await api('/api/caja/resumen', { cookie })).json, { sellosHoy: 1, clientesNuevos: 1, canjes: 0 })
  const m = await api('/api/caja/movimientos', { cookie })
  assert.equal(m.json[0].whatsapp, '+34 ••• ••• 187')
  assert.ok(!m.texto.includes('612345187'))
})

// ---------- general ----------
test('JSON mal formado da 400; ruta desconocida da 404 con JSON', async () => {
  const cookie = await conSesion()
  assert.equal((await api('/api/caja/fidelizar', { metodo: 'POST', cookie, crudo: '{no es json' })).status, 400)
  const nf = await api('/api/no-existe')
  assert.equal(nf.status, 404)
  assert.equal(nf.json.error, 'NO_ENCONTRADO')
})

test('cabeceras de seguridad básicas', async () => {
  const r = await api('/api/no-existe')
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(r.headers.get('x-powered-by'), null)
  assert.equal(r.headers.get('cache-control'), 'no-store')
})

test('healthz responde 200 sin sesión (para el chequeo de Render) y no expone datos', async () => {
  const r = await api('/healthz')
  assert.equal(r.status, 200)
  assert.deepEqual(r.json, { ok: true })
})

test('ajustes: solo la caja los ve y los cambia; los valores inválidos dan 400', async () => {
  assert.equal((await api('/api/caja/ajustes')).status, 401)
  assert.equal((await api('/api/caja/ajustes', { metodo: 'PUT', cuerpo: { enlaceEsperaMinutos: 0 } })).status, 401)
  const cookie = await conSesion()
  assert.deepEqual((await api('/api/caja/ajustes', { cookie })).json, { enlaceEsperaMinutos: 60 })
  const mal = await api('/api/caja/ajustes', { metodo: 'PUT', cookie, cuerpo: { enlaceEsperaMinutos: -5 } })
  assert.equal(mal.status, 400)
  assert.equal(mal.json.error, 'DATOS_INVALIDOS')
  assert.equal((await api('/api/caja/ajustes', { metodo: 'PUT', cookie, cuerpo: {} })).status, 400)
  assert.deepEqual((await api('/api/caja/ajustes', { cookie })).json, { enlaceEsperaMinutos: 60 })
})

test('quitar la espera desde ajustes permite generar un código nuevo al momento', async () => {
  const cookie = await conSesion()
  const pedir = () => api('/api/caja/fidelizar', { metodo: 'POST', cookie, cuerpo: { whatsapp: '+34612345187' } })
  const a = await pedir()
  await api(`/api/enlaces/${a.json.enlace.codigo}/usar`, { metodo: 'POST' })
  assert.equal((await pedir()).status, 429)
  const guardado = await api('/api/caja/ajustes', { metodo: 'PUT', cookie, cuerpo: { enlaceEsperaMinutos: 0 } })
  assert.equal(guardado.status, 200)
  assert.deepEqual(guardado.json, { enlaceEsperaMinutos: 0 })
  const b = await pedir()
  assert.equal(b.status, 201)
  assert.notEqual(b.json.enlace.codigo, a.json.enlace.codigo)
  await api('/api/caja/ajustes', { metodo: 'PUT', cookie, cuerpo: { enlaceEsperaMinutos: 60 } })
  await api(`/api/enlaces/${b.json.enlace.codigo}/usar`, { metodo: 'POST' })
  assert.equal((await pedir()).status, 429)
})
