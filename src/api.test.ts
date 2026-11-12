import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApi, ApiError, mensajeError, codigoDeEnlace, codigoDeCliente } from './api.ts'

type Falso = { ok: boolean; status: number; json: () => Promise<unknown> }
const respuesta = (status: number, cuerpo: unknown): Falso => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo })

interface Llamada { url: string; method?: string; headers?: Record<string, string>; body?: string }

const falso = (...respuestas: Array<Falso | Error>) => {
  const llamadas: Llamada[] = []
  const fetchFalso = async (url: string, opts?: RequestInit) => {
    llamadas.push({ url, ...(opts as Omit<Llamada, 'url'>) })
    const r = respuestas.shift()
    if (r instanceof Error) throw r
    return r as unknown as Response
  }
  return { api: createApi(fetchFalso as typeof fetch), llamadas }
}
const primera = (l: Llamada[]) => l[0] as Llamada

test('entrar envía el número por POST como JSON', async () => {
  const { api, llamadas } = falso(respuesta(200, { codigo: 'CL-7K4Q' }))
  await api.entrar('+34 612 345 187')
  assert.equal(primera(llamadas).url, '/api/entrar')
  assert.equal(primera(llamadas).method, 'POST')
  assert.equal(primera(llamadas).headers?.['content-type'], 'application/json')
  assert.deepEqual(JSON.parse(primera(llamadas).body ?? ''), { whatsapp: '+34 612 345 187' })
})

test('la tarjeta y salir usan la sesión (sin token en la URL)', async () => {
  const { api, llamadas } = falso(respuesta(200, {}), respuesta(200, {}))
  await api.tarjeta()
  await api.salir()
  assert.equal(primera(llamadas).url, '/api/tarjeta')
  assert.equal(llamadas[1]?.url, '/api/salir')
  assert.equal(llamadas[1]?.method, 'POST')
})

test('caja busca con la consulta codificada en la URL', async () => {
  const { api, llamadas } = falso(respuesta(200, {}))
  await api.buscar('+34 612 345 187')
  assert.equal(primera(llamadas).url, '/api/caja/buscar?q=%2B34%20612%20345%20187')
})

test('las rutas con código de cliente se codifican en la URL', async () => {
  const { api, llamadas } = falso(respuesta(200, {}), respuesta(200, {}))
  await api.cliente('CL-7K4Q')
  await api.canjear('a/b')
  assert.equal(primera(llamadas).url, '/api/caja/clientes/CL-7K4Q')
  assert.equal(llamadas[1]?.url, '/api/caja/clientes/a%2Fb/canjear')
  assert.equal('sumarSello' in api, false)
})

test('fidelizar envía el número; usarEnlace hace POST con el código codificado', async () => {
  const { api, llamadas } = falso(respuesta(201, {}), respuesta(200, { sellos: 1 }))
  await api.fidelizar('+34 612 345 187')
  await api.usarEnlace('a/b')
  assert.equal(primera(llamadas).url, '/api/caja/fidelizar')
  assert.deepEqual(JSON.parse(primera(llamadas).body ?? ''), { whatsapp: '+34 612 345 187' })
  assert.equal(llamadas[1]?.url, '/api/enlaces/a%2Fb/usar')
  assert.equal(llamadas[1]?.method, 'POST')
  assert.equal(llamadas[1]?.body, undefined)
})

test('ajustes se lee con GET y guardarAjustes envía la espera por PUT', async () => {
  const { api, llamadas } = falso(respuesta(200, { enlaceEsperaMinutos: 60 }), respuesta(200, { enlaceEsperaMinutos: 0 }))
  assert.deepEqual(await api.ajustes(), { enlaceEsperaMinutos: 60 })
  await api.guardarAjustes({ enlaceEsperaMinutos: 0 })
  assert.equal(primera(llamadas).url, '/api/caja/ajustes')
  assert.equal(primera(llamadas).method, 'GET')
  assert.equal(llamadas[1]?.url, '/api/caja/ajustes')
  assert.equal(llamadas[1]?.method, 'PUT')
  assert.deepEqual(JSON.parse(llamadas[1]?.body ?? ''), { enlaceEsperaMinutos: 0 })
})

test('guardarAjustes puede enviar solo el nombre', async () => {
  const { api, llamadas } = falso(respuesta(200, { enlaceEsperaMinutos: 60, nombre: 'Café Sol' }))
  const r = await api.guardarAjustes({ nombre: 'Café Sol' })
  assert.deepEqual(JSON.parse(primera(llamadas).body ?? ''), { nombre: 'Café Sol' })
  assert.equal(r.nombre, 'Café Sol')
})

test('login envía el PIN', async () => {
  const { api, llamadas } = falso(respuesta(200, { ok: true }))
  await api.login('4321')
  assert.deepEqual(JSON.parse(primera(llamadas).body ?? ''), { pin: '4321' })
})

test('codigoDeEnlace acepta el código suelto o la URL completa', () => {
  assert.equal(codigoDeEnlace('AbC123_-xyz'), 'AbC123_-xyz')
  assert.equal(codigoDeEnlace('  https://x.ts.net/f/AbC123_-xyz  '), 'AbC123_-xyz')
  assert.equal(codigoDeEnlace('https://x.ts.net/f/AbC123_-xyz?utm=1#a'), 'AbC123_-xyz')
  assert.equal(codigoDeEnlace(''), '')
})

test('una respuesta de error lanza ApiError con código y status', async () => {
  const { api } = falso(respuesta(409, { error: 'ENLACE_USADO' }))
  await assert.rejects(api.usarEnlace('p'), (e: unknown) => e instanceof ApiError && e.code === 'ENLACE_USADO' && e.status === 409)
})

test('si el servidor no responde, el error es SIN_CONEXION', async () => {
  const { api } = falso(new TypeError('fetch failed'))
  await assert.rejects(api.resumen(), (e: unknown) => e instanceof ApiError && e.code === 'SIN_CONEXION')
})

test('una respuesta que no es JSON válido no rompe: ERROR_INTERNO', async () => {
  const { api } = falso({ ok: false, status: 502, json: async () => { throw new SyntaxError('x') } })
  await assert.rejects(api.resumen(), (e: unknown) => e instanceof ApiError && e.code === 'ERROR_INTERNO' && e.status === 502)
})

test('sesion de caja devuelve los datos del comercio, o null si no hay sesión (sin lanzar por el 401)', async () => {
  const info = { ok: true, comercio: 'Casa Lola', premio: 'almuerzo gratis', total: 10 }
  const { api } = falso(respuesta(200, info), respuesta(401, { error: 'NO_AUTORIZADO' }), respuesta(500, { error: 'ERROR_INTERNO' }))
  assert.deepEqual(await api.sesion(), info)
  assert.equal(await api.sesion(), null)
  await assert.rejects(api.sesion(), (e: unknown) => e instanceof ApiError && e.status === 500)
})

test('codigoDeCliente extrae el código CL-XXXX del QR de la tarjeta', () => {
  assert.equal(codigoDeCliente('CL-7K4Q'), 'CL-7K4Q')
  assert.equal(codigoDeCliente('  cl-7k4q \n'), 'CL-7K4Q')
  assert.equal(codigoDeCliente('https://tienda.ts.net/caja/sumar/CL-7K4Q'), 'CL-7K4Q')
})

test('codigoDeCliente rechaza lo que no es un cliente (enlaces de sello, texto, vacío)', () => {
  assert.equal(codigoDeCliente('https://tienda.ts.net/f/AbC123_-xyz'), null)
  assert.equal(codigoDeCliente('hola'), null)
  assert.equal(codigoDeCliente(''), null)
  assert.equal(codigoDeCliente('CL-12'), null)
  assert.equal(codigoDeCliente('XCL-7K4QX'), null)
})

test('el ApiError conserva los datos extra del servidor (minutos de espera)', async () => {
  const { api } = falso(respuesta(429, { error: 'ESPERA_REQUERIDA', minutos: 45 }))
  await assert.rejects(api.fidelizar('+34612345187'), (e: unknown) => e instanceof ApiError && e.code === 'ESPERA_REQUERIDA' && e.datos?.minutos === 45)
})

test('el mensaje de espera indica los minutos y su singular', () => {
  assert.match(mensajeError('ESPERA_REQUERIDA', { minutos: 45 }), /45 minutos/)
  assert.match(mensajeError('ESPERA_REQUERIDA', { minutos: 1 }), /1 minuto\b/)
})

test('mensajeError traduce los códigos y tiene mensaje por defecto', () => {
  assert.match(mensajeError('ENLACE_USADO'), /ya se usó/i)
  assert.match(mensajeError('TARJETA_COMPLETA'), /canje/i)
  assert.match(mensajeError('PIN_INCORRECTO'), /PIN/)
  assert.match(mensajeError('SIN_CONEXION'), /conexión/i)
  assert.match(mensajeError('WHATSAPP_INVALIDO'), /\+34/)
  assert.ok(mensajeError('CODIGO_RARO').length > 5)
})
