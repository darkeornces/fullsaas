import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { MongoClient, type Db } from 'mongodb'
import { createRepo, type Repo } from './repo.ts'

const URL = process.env.TEST_MONGO_URL ?? 'mongodb://127.0.0.1:27017'
const config = { sellosRequeridos: 3, nombre: 'Casa Lola', correo: null, enlaceVigenciaHoras: 48, enlaceEsperaMinutos: 60, zonaHoraria: 'Europe/Madrid' }
let client: MongoClient, db: Db, repo: Repo, ahora: Date

before(async () => {
  client = await MongoClient.connect(URL)
  db = client.db(`fidelhop_test_${process.pid}`)
})
after(async () => {
  await db.dropDatabase()
  await client.close()
})
beforeEach(async () => {
  await db.dropDatabase()
  ahora = new Date('2026-11-11T13:00:00Z')
  repo = createRepo(db, config, () => ahora)
  await repo.init()
})

const falla = (promesa: Promise<unknown>, code: string) =>
  assert.rejects(promesa, (e: { code?: string }) => e.code === code, `se esperaba el error ${code}`)

test('entrar crea el cliente con código CL-XXXX, el número normalizado y 0 sellos', async () => {
  const c = await repo.entrar('+34 612 345 187')
  assert.match(c.codigo, /^CL-[A-Z0-9]{4}$/)
  assert.equal(c.whatsapp, '+34612345187')
  assert.equal(c.sellos, 0)
  assert.equal('token' in c, false)
})

test('entrar con el mismo número (aunque venga con otro formato) devuelve el mismo cliente', async () => {
  const a = await repo.entrar('+34612345187')
  await repo.sumarSello(a.codigo)
  const b = await repo.entrar('0034 612-345-187')
  assert.equal(b.codigo, a.codigo)
  assert.equal(b.sellos, 1)
})

test('entrar en paralelo con el mismo número crea un solo cliente y una sola alta', async () => {
  const cs = await Promise.all(Array.from({ length: 10 }, () => repo.entrar('+34612345187')))
  assert.equal(new Set(cs.map((c) => c.codigo)).size, 1)
  assert.equal((await repo.movimientos(50)).filter((m) => m.tipo === 'alta').length, 1)
})

test('entrar rechaza números inválidos', async () => {
  await falla(repo.entrar('hola'), 'WHATSAPP_INVALIDO')
  await falla(repo.entrar('123'), 'WHATSAPP_INVALIDO')
  await falla(repo.entrar({ $ne: 1 }), 'WHATSAPP_INVALIDO')
})

test('números distintos dan clientes y códigos distintos', async () => {
  const cs = []
  for (let i = 0; i < 30; i++) cs.push(await repo.entrar(`+346000000${String(i).padStart(2, '0')}`))
  assert.equal(new Set(cs.map((c) => c.codigo)).size, 30)
})

test('buscar encuentra por número o por código, y da NO_ENCONTRADO si no existe', async () => {
  const c = await repo.entrar('+34612345187')
  assert.equal((await repo.buscar('+34 612 345 187')).codigo, c.codigo)
  assert.equal((await repo.buscar(c.codigo.toLowerCase())).codigo, c.codigo)
  await falla(repo.buscar('+34699999999'), 'NO_ENCONTRADO')
  await falla(repo.buscar('CL-ZZZZ'), 'NO_ENCONTRADO')
  await falla(repo.buscar('cualquier cosa'), 'NO_ENCONTRADO')
})

test('sumarSello incrementa de uno en uno', async () => {
  const c = await repo.entrar('+34600000001')
  assert.equal((await repo.sumarSello(c.codigo)).sellos, 1)
  assert.equal((await repo.sumarSello(c.codigo)).sellos, 2)
})

test('sumarSello no pasa del máximo (TARJETA_COMPLETA)', async () => {
  const c = await repo.entrar('+34600000002')
  for (let i = 0; i < 3; i++) await repo.sumarSello(c.codigo)
  await falla(repo.sumarSello(c.codigo), 'TARJETA_COMPLETA')
  assert.equal((await repo.obtenerPorCodigo(c.codigo))?.sellos, 3)
})

test('sumarSello concurrente nunca supera el máximo', async () => {
  const c = await repo.entrar('+34600000003')
  const r = await Promise.allSettled(Array.from({ length: 10 }, () => repo.sumarSello(c.codigo)))
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 3)
  assert.equal((await repo.obtenerPorCodigo(c.codigo))?.sellos, 3)
})

test('canjear exige tarjeta completa y la reinicia', async () => {
  const c = await repo.entrar('+34600000004')
  await falla(repo.canjear(c.codigo), 'SIN_PREMIO')
  for (let i = 0; i < 3; i++) await repo.sumarSello(c.codigo)
  const r = await repo.canjear(c.codigo)
  assert.equal(r.sellos, 0)
  assert.equal(r.canjes, 1)
})

test('crearEnlace asocia el número al cliente y da un código de un solo uso con vigencia', async () => {
  const { enlace, cliente } = await repo.crearEnlace('+34 612 345 187')
  assert.equal(cliente.whatsapp, '+34612345187')
  assert.match(enlace.codigo, /^[A-Za-z0-9_-]{16,}$/)
  assert.equal(enlace.cliente, cliente.codigo)
  assert.equal(enlace.usado, false)
  assert.equal(enlace.expiraEn.toISOString(), '2026-11-13T13:00:00.000Z')
  assert.equal(cliente.sellos, 0)
})

test('crearEnlace para un número que ya existe reutiliza su tarjeta (no crea otra)', async () => {
  const a = await repo.crearEnlace('+34612345187')
  const b = await repo.crearEnlace('0034 612 345 187')
  assert.equal(b.cliente.codigo, a.cliente.codigo)
})

test('crearEnlace rechaza números inválidos', async () => {
  await falla(repo.crearEnlace('hola'), 'WHATSAPP_INVALIDO')
  await falla(repo.crearEnlace(undefined), 'WHATSAPP_INVALIDO')
})

test('usarEnlace suma un sello al cliente asociado y consume el enlace', async () => {
  const { enlace, cliente } = await repo.crearEnlace('+34612345187')
  const r = await repo.usarEnlace(enlace.codigo)
  assert.equal(r.codigo, cliente.codigo)
  assert.equal(r.sellos, 1)
  await falla(repo.usarEnlace(enlace.codigo), 'ENLACE_USADO')
  assert.equal((await repo.obtenerPorCodigo(cliente.codigo))?.sellos, 1)
})

test('usar el mismo enlace en paralelo suma exactamente un sello', async () => {
  const { enlace, cliente } = await repo.crearEnlace('+34612345187')
  const r = await Promise.allSettled(Array.from({ length: 10 }, () => repo.usarEnlace(enlace.codigo)))
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1)
  assert.equal((await repo.obtenerPorCodigo(cliente.codigo))?.sellos, 1)
})

test('usarEnlace distingue enlace inexistente y enlace vencido', async () => {
  const { enlace } = await repo.crearEnlace('+34612345187')
  await falla(repo.usarEnlace('no-existe-no-existe'), 'ENLACE_NO_EXISTE')
  ahora = new Date('2026-11-14T00:00:00Z')
  await falla(repo.usarEnlace(enlace.codigo), 'ENLACE_EXPIRADO')
})

test('con tarjeta completa el enlace NO se consume', async () => {
  const { enlace, cliente } = await repo.crearEnlace('+34612345187')
  for (let i = 0; i < 3; i++) await repo.sumarSello(cliente.codigo)
  await falla(repo.usarEnlace(enlace.codigo), 'TARJETA_COMPLETA')
  await repo.canjear(cliente.codigo)
  assert.equal((await repo.usarEnlace(enlace.codigo)).sellos, 1)
})

test('movimientos registra alta, sellos y canjes, el más reciente primero', async () => {
  const c = await repo.entrar('+34600000009')
  await repo.sumarSello(c.codigo)
  const m = await repo.movimientos(10)
  assert.deepEqual(m.map((x) => x.tipo), ['sello', 'alta'])
})

test('movimientos incluye el WhatsApp y los sellos actuales del cliente', async () => {
  const c = await repo.entrar('+34600000011')
  await repo.sumarSello(c.codigo)
  const m = (await repo.movimientos(1))[0]!
  assert.equal(m.whatsapp, c.whatsapp)
  assert.equal(m.sellos, 1)
  assert.equal(m.codigo, c.codigo)
})

test('resumen cuenta sellos, altas y canjes del día en la zona horaria del comercio', async () => {
  ahora = new Date('2026-11-10T10:00:00Z')
  const viejo = await repo.entrar('+34600000012')
  await repo.sumarSello(viejo.codigo)
  ahora = new Date('2026-11-11T11:00:00Z')
  const c = await repo.entrar('+34600000013')
  for (let i = 0; i < 3; i++) await repo.sumarSello(c.codigo)
  await repo.canjear(c.codigo)
  assert.deepEqual(await repo.resumen(), { sellosHoy: 3, clientesNuevos: 1, canjes: 1 })
})

test('el día empieza a medianoche de Santiago de Chile (UTC-3 en verano, UTC-4 en invierno)', async () => {
  const { inicioDelDia } = await import('./tiempo.ts')
  const tz = 'America/Santiago'
  assert.equal(inicioDelDia(new Date('2026-11-12T01:00:00Z'), tz).toISOString(), '2026-11-11T03:00:00.000Z')
  assert.equal(inicioDelDia(new Date('2026-11-12T03:30:00Z'), tz).toISOString(), '2026-11-12T03:00:00.000Z')
  assert.equal(inicioDelDia(new Date('2026-07-15T12:00:00Z'), tz).toISOString(), '2026-07-15T04:00:00.000Z')
})

test('el día empieza a medianoche de Madrid (UTC+1 en invierno, UTC+2 en verano)', async () => {
  const { inicioDelDia } = await import('./tiempo.ts')
  const tz = 'Europe/Madrid'
  assert.equal(inicioDelDia(new Date('2026-11-11T23:30:00Z'), tz).toISOString(), '2026-11-11T23:00:00.000Z')
  assert.equal(inicioDelDia(new Date('2026-11-11T12:00:00Z'), tz).toISOString(), '2026-11-10T23:00:00.000Z')
  assert.equal(inicioDelDia(new Date('2026-07-15T12:00:00Z'), tz).toISOString(), '2026-07-14T22:00:00.000Z')
})

test('usarEnlace registra el movimiento como sello con origen enlace', async () => {
  const { enlace } = await repo.crearEnlace('+34612345187')
  await repo.usarEnlace(enlace.codigo)
  const m = (await repo.movimientos(1))[0]!
  assert.equal(m.tipo, 'sello')
  assert.equal(m.origen, 'enlace')
})

const esperaMin = (e: unknown) => (e as { datos?: { minutos?: number } }).datos?.minutos
const INICIO = new Date('2026-11-11T13:00:00Z').getTime()
const minutosDespues = (n: number) => new Date(INICIO + n * 60_000)

test('dentro de la hora, si el enlace sigue sin usar se devuelve el mismo (no se crea otro)', async () => {
  const a = await repo.crearEnlace('+34612345187')
  ahora = minutosDespues(20)
  const b = await repo.crearEnlace('+34612345187')
  assert.equal(b.enlace.codigo, a.enlace.codigo)
  assert.equal(b.reutilizado, true)
  assert.equal(a.reutilizado, false)
  assert.equal(await db.collection('enlaces').countDocuments(), 1)
})

test('si el enlace ya se usó, no se genera otro hasta pasada 1 hora desde que se creó', async () => {
  const { enlace, cliente } = await repo.crearEnlace('+34612345187')
  ahora = minutosDespues(5)
  await repo.usarEnlace(enlace.codigo)
  ahora = minutosDespues(25)
  await assert.rejects(repo.crearEnlace('+34612345187'), (e: { code?: string }) => e.code === 'ESPERA_REQUERIDA' && esperaMin(e) === 35)
  ahora = minutosDespues(59)
  await assert.rejects(repo.crearEnlace('+34612345187'), (e: unknown) => esperaMin(e) === 1)
  ahora = minutosDespues(60)
  const nuevo = await repo.crearEnlace('+34612345187')
  assert.notEqual(nuevo.enlace.codigo, enlace.codigo)
  assert.equal(nuevo.cliente.codigo, cliente.codigo)
})

test('pasada la hora se genera uno nuevo y el anterior sin usar queda anulado', async () => {
  const viejo = await repo.crearEnlace('+34612345187')
  ahora = minutosDespues(61)
  const nuevo = await repo.crearEnlace('+34612345187')
  assert.notEqual(nuevo.enlace.codigo, viejo.enlace.codigo)
  assert.equal(nuevo.reutilizado, false)
  await falla(repo.usarEnlace(viejo.enlace.codigo), 'ENLACE_EXPIRADO')
  assert.equal((await repo.usarEnlace(nuevo.enlace.codigo)).sellos, 1)
})

test('la espera es por número: otro número no se ve afectado', async () => {
  const a = await repo.crearEnlace('+34612345187')
  await repo.usarEnlace(a.enlace.codigo)
  const otro = await repo.crearEnlace('+34699000111')
  assert.notEqual(otro.enlace.codigo, a.enlace.codigo)
})

test('pedir el enlace varias veces a la vez deja un solo enlace', async () => {
  const r = await Promise.all(Array.from({ length: 8 }, () => repo.crearEnlace('+34612345187')))
  assert.equal(new Set(r.map((x) => x.enlace.codigo)).size, 1)
  assert.equal(await db.collection('enlaces').countDocuments(), 1)
})

test('el cliente que devuelve el repositorio no expone datos internos del enlace', async () => {
  const { cliente } = await repo.crearEnlace('+34612345187')
  assert.equal('ultimoEnlace' in cliente, false)
  assert.equal('ultimoEnlace' in ((await repo.buscar('+34612345187')) as object), false)
})

// ---------- parámetro de espera guardado en Mongo ----------
const ajustes = () => db.collection<{ _id: string; enlaceEsperaMinutos?: unknown; nombre?: unknown }>('ajustes')
const fijarEspera = (valor: unknown) => ajustes().updateOne({ _id: 'general' }, { $set: { enlaceEsperaMinutos: valor } }, { upsert: true })

test('init crea el parámetro de espera con el valor por defecto de la configuración', async () => {
  assert.equal((await ajustes().findOne({ _id: 'general' }))?.enlaceEsperaMinutos, 60)
})

test('init no pisa un valor que ya se cambió en Mongo', async () => {
  await fijarEspera(5)
  await repo.init()
  assert.equal((await ajustes().findOne({ _id: 'general' }))?.enlaceEsperaMinutos, 5)
})

test('cambiar la espera en Mongo se aplica al instante, sin reiniciar', async () => {
  await fijarEspera(10)
  const { enlace } = await repo.crearEnlace('+34612345187')
  await repo.usarEnlace(enlace.codigo)
  ahora = minutosDespues(4)
  await assert.rejects(repo.crearEnlace('+34612345187'), (e: unknown) => esperaMin(e) === 6)
  ahora = minutosDespues(10)
  assert.notEqual((await repo.crearEnlace('+34612345187')).enlace.codigo, enlace.codigo)
  await fijarEspera(120)
  const { enlace: otro } = await repo.crearEnlace('+34699000111')
  await repo.usarEnlace(otro.codigo)
  ahora = minutosDespues(10 + 90)
  await assert.rejects(repo.crearEnlace('+34699000111'), (e: unknown) => esperaMin(e) === 30)
})

test('con espera 0 se puede generar de nuevo en cualquier momento', async () => {
  await fijarEspera(0)
  const a = await repo.crearEnlace('+34612345187')
  await repo.usarEnlace(a.enlace.codigo)
  const b = await repo.crearEnlace('+34612345187')
  assert.notEqual(b.enlace.codigo, a.enlace.codigo)
})

test('un valor inválido en Mongo (texto, negativo, nulo) usa el de la configuración', async () => {
  for (const malo of ['abc', -5, null, NaN]) {
    await fijarEspera(malo)
    const num = `+3461234${Math.floor(1000 + Math.random() * 8999)}`
    const { enlace } = await repo.crearEnlace(num)
    await repo.usarEnlace(enlace.codigo)
    ahora = minutosDespues(20)
    await assert.rejects(repo.crearEnlace(num), (e: unknown) => esperaMin(e) === 40)
    ahora = new Date(INICIO)
  }
})

// ---------- ajustes editables desde la caja ----------
test('obtenerAjustes devuelve la espera actual (por defecto la de la configuración)', async () => {
  assert.deepEqual(await repo.obtenerAjustes(), { enlaceEsperaMinutos: 60, nombre: 'Casa Lola' })
  await fijarEspera(15)
  assert.deepEqual(await repo.obtenerAjustes(), { enlaceEsperaMinutos: 15, nombre: 'Casa Lola' })
  await fijarEspera('basura')
  assert.deepEqual(await repo.obtenerAjustes(), { enlaceEsperaMinutos: 60, nombre: 'Casa Lola' })
})

test('guardarAjustes persiste la espera y se aplica de inmediato', async () => {
  const { enlace } = await repo.crearEnlace('+34612345187')
  await repo.usarEnlace(enlace.codigo)
  await assert.rejects(repo.crearEnlace('+34612345187'), (e: { code?: string }) => e.code === 'ESPERA_REQUERIDA')
  assert.deepEqual(await repo.guardarAjustes({ enlaceEsperaMinutos: 0 }), { enlaceEsperaMinutos: 0, nombre: 'Casa Lola' })
  assert.equal((await ajustes().findOne({ _id: 'general' }))?.enlaceEsperaMinutos, 0)
  assert.notEqual((await repo.crearEnlace('+34612345187')).enlace.codigo, enlace.codigo)
})

test('guardarAjustes acepta enteros de 0 a 1440 minutos y rechaza el resto', async () => {
  for (const ok of [0, 1, 30, 1440]) assert.deepEqual(await repo.guardarAjustes({ enlaceEsperaMinutos: ok }), { enlaceEsperaMinutos: ok, nombre: 'Casa Lola' })
  for (const malo of [-1, 1.5, 1441, NaN, Infinity, '30', null, undefined]) {
    await falla(repo.guardarAjustes({ enlaceEsperaMinutos: malo }), 'DATOS_INVALIDOS')
  }
  await falla(repo.guardarAjustes(undefined), 'DATOS_INVALIDOS')
  assert.equal((await repo.obtenerAjustes()).enlaceEsperaMinutos, 1440)
})

// ---------- nombre de la tienda ----------
const fijarNombre = (valor: unknown) => ajustes().updateOne({ _id: 'general' }, { $set: { nombre: valor } }, { upsert: true })

test('init guarda el nombre por defecto de la configuración sin pisar uno ya cambiado', async () => {
  assert.equal((await ajustes().findOne({ _id: 'general' }))?.nombre, 'Casa Lola')
  await fijarNombre('Café Sol')
  await repo.init()
  assert.equal((await ajustes().findOne({ _id: 'general' }))?.nombre, 'Café Sol')
})

test('init añade el nombre a un documento de ajustes antiguo que no lo tenía', async () => {
  await ajustes().replaceOne({ _id: 'general' }, { enlaceEsperaMinutos: 15 })
  await repo.init()
  assert.deepEqual(await repo.obtenerAjustes(), { enlaceEsperaMinutos: 15, nombre: 'Casa Lola' })
})

test('guardarAjustes cambia el nombre (recortado y sin espacios dobles) sin tocar la espera', async () => {
  await fijarEspera(15)
  const r = await repo.guardarAjustes({ nombre: '   Café   Sol  ' })
  assert.deepEqual(r, { enlaceEsperaMinutos: 15, nombre: 'Café Sol' })
  assert.deepEqual(await repo.obtenerAjustes(), { enlaceEsperaMinutos: 15, nombre: 'Café Sol' })
})

test('guardarAjustes puede cambiar nombre y espera a la vez', async () => {
  assert.deepEqual(await repo.guardarAjustes({ nombre: 'Panadería Ñuñoa', enlaceEsperaMinutos: 0 }), { enlaceEsperaMinutos: 0, nombre: 'Panadería Ñuñoa' })
})

test('guardarAjustes rechaza nombres vacíos, solo espacios, demasiado largos o que no son texto', async () => {
  for (const malo of ['', '    ', 'x'.repeat(41), 123, null, {}, ['a'], 'con\nsalto', 'tab\taqui']) {
    await falla(repo.guardarAjustes({ nombre: malo }), 'DATOS_INVALIDOS')
  }
  assert.equal((await repo.obtenerAjustes()).nombre, 'Casa Lola')
  assert.equal((await repo.guardarAjustes({ nombre: 'x'.repeat(40) })).nombre, 'x'.repeat(40))
})

test('un nombre inválido en Mongo usa el de la configuración', async () => {
  for (const malo of ['', '   ', 5, null]) {
    await fijarNombre(malo)
    assert.equal((await repo.obtenerAjustes()).nombre, 'Casa Lola')
  }
})

// ---------- correo de acceso de la tienda ----------
test('sin correo configurado, los ajustes no incluyen el campo correo', async () => {
  assert.equal('correo' in (await repo.obtenerAjustes()), false)
})

test('guardarAjustes guarda el correo normalizado sin tocar nombre ni espera', async () => {
  await fijarEspera(15)
  const r = await repo.guardarAjustes({ correo: '  Dueno@Tienda.CL ' })
  assert.deepEqual(r, { enlaceEsperaMinutos: 15, nombre: 'Casa Lola', correo: 'dueno@tienda.cl' })
  assert.deepEqual(await repo.obtenerAjustes(), { enlaceEsperaMinutos: 15, nombre: 'Casa Lola', correo: 'dueno@tienda.cl' })
})

test('guardarAjustes rechaza correos inválidos', async () => {
  for (const malo of ['', 'abc', 'a@b', 5, null, {}]) await falla(repo.guardarAjustes({ correo: malo }), 'DATOS_INVALIDOS')
  assert.equal('correo' in (await repo.obtenerAjustes()), false)
})

test('init siembra el correo de la configuración (CAJA_EMAIL) sin pisar uno ya cambiado', async () => {
  const conCorreo = createRepo(db, { ...config, correo: 'Inicial@Tienda.cl' }, () => ahora)
  await conCorreo.init()
  assert.equal((await conCorreo.obtenerAjustes()).correo, 'inicial@tienda.cl')
  await repo.guardarAjustes({ correo: 'nuevo@tienda.cl' })
  await conCorreo.init()
  assert.equal((await conCorreo.obtenerAjustes()).correo, 'nuevo@tienda.cl')
})

test('un correo inválido guardado en Mongo se ignora', async () => {
  await ajustes().updateOne({ _id: 'general' }, { $set: { correo: 'basura' } })
  assert.equal('correo' in (await repo.obtenerAjustes()), false)
})
