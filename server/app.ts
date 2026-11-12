import express, { type Request } from 'express'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { AppError } from './errors.ts'
import type { Repo } from './repo.ts'
import type { Cliente, Config } from './tipos.ts'

const COOKIE_CAJA = 'caja'
const COOKIE_CLIENTE = 'cliente'
const VENTANA_MS = 15 * 60_000
const MAX_FALLOS_PIN = 5
const MAX_ENTRADAS = 20

const hash = (s: string) => createHash('sha256').update(s).digest()
const iguales = (a: string, b: string) => timingSafeEqual(hash(a), hash(b))
const enmascarar = (n: string | null) => (n ? `${n.slice(0, 3)} ••• ••• ${n.slice(-3)}` : null)

interface Deps { repo: Repo; config: Config; now?: () => Date }

export function createApp({ repo, config, now = () => new Date() }: Deps) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxy)

  const firmar = (payload: string) => createHmac('sha256', config.sessionSecret).update(payload).digest('base64url')
  const emitir = (payload: string, segundos: number) => {
    const exp = Math.floor(now().getTime() / 1000) + segundos
    return `${payload}.${exp}.${firmar(`${payload}.${exp}`)}`
  }
  const verificar = (valor: string | undefined): string | null => {
    if (!valor) return null
    const i = valor.lastIndexOf('.')
    const j = valor.lastIndexOf('.', i - 1)
    if (i < 0 || j < 0) return null
    const payload = valor.slice(0, j)
    const exp = valor.slice(j + 1, i)
    if (!/^\d+$/.test(exp) || !iguales(valor.slice(i + 1), firmar(`${payload}.${exp}`))) return null
    return Number(exp) > now().getTime() / 1000 ? payload : null
  }
  const leerCookie = (req: Request, nombre: string): string | undefined =>
    (req.headers.cookie ?? '').split(';').map((c) => c.trim()).find((c) => c.startsWith(nombre + '='))?.slice(nombre.length + 1)
  const atributos = () => `Path=/; HttpOnly; SameSite=Strict${config.cookieSecure ? '; Secure' : ''}`

  function limitador(max: number) {
    const intentos = new Map<string, { n: number; desde: number }>()
    return {
      bloqueado(ip: string) {
        const r = intentos.get(ip)
        if (!r) return false
        if (now().getTime() - r.desde > VENTANA_MS) { intentos.delete(ip); return false }
        return r.n >= max
      },
      registrar(ip: string) {
        const r = intentos.get(ip) ?? { n: 0, desde: now().getTime() }
        r.n++
        intentos.set(ip, r)
      },
      reiniciar: (ip: string) => intentos.delete(ip),
    }
  }
  const limitePin = limitador(MAX_FALLOS_PIN)
  const limiteEntradas = limitador(MAX_ENTRADAS)
  const ipDe = (req: Request) => req.ip ?? 'desconocida'

  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' })
    if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store')
    next()
  })
  app.use(express.json({ limit: '10kb' }))

  app.get('/healthz', (req, res) => { res.json({ ok: true }) })

  // ---------- caja: sesión ----------
  app.post('/api/caja/login', async (req, res) => {
    const ip = ipDe(req)
    if (limitePin.bloqueado(ip)) throw new AppError('DEMASIADOS_INTENTOS')
    const entra = await repo.verificarCredenciales(req.body?.correo, req.body?.pin)
    if (!entra) {
      limitePin.registrar(ip)
      res.status(401).json({ error: 'CREDENCIALES_INCORRECTAS' })
      return
    }
    limitePin.reiniciar(ip)
    const segundos = config.sesionHoras * 3600
    res.set('Set-Cookie', `${COOKIE_CAJA}=${emitir('caja', segundos)}; Max-Age=${segundos}; ${atributos()}`)
    res.json({ ok: true })
  })

  app.post('/api/caja/logout', (req, res) => {
    res.set('Set-Cookie', `${COOKIE_CAJA}=; Max-Age=0; ${atributos()}`)
    res.json({ ok: true })
  })

  const caja = express.Router()
  caja.use((req, res, next) => {
    if (verificar(leerCookie(req, COOKIE_CAJA)) !== 'caja') throw new AppError('NO_AUTORIZADO')
    next()
  })
  app.use('/api/caja', caja)

  const nombreTienda = async () => (await repo.obtenerAjustes()).nombre

  const urlEnlace = (codigo: string) => `${config.baseUrl}/f/${codigo}`
  const waLink = (whatsapp: string, url: string, nombre: string) => {
    const texto = `Hola, gracias por tu compra en ${nombre}. Abre este enlace para sumar tu sello (vale una sola vez): ${url}`
    return `https://wa.me/${whatsapp.slice(1)}?text=${encodeURIComponent(texto)}`
  }

  caja.get('/sesion', async (req, res) => {
    res.json({ ok: true, comercio: await nombreTienda(), premio: config.premio, total: config.sellosRequeridos })
  })

  caja.post('/fidelizar', async (req, res) => {
    const { enlace, cliente, reutilizado } = await repo.crearEnlace(req.body?.whatsapp)
    const url = urlEnlace(enlace.codigo)
    res.status(reutilizado ? 200 : 201).json({
      cliente,
      enlace: { codigo: enlace.codigo, url, expiraEn: enlace.expiraEn },
      waLink: waLink(cliente.whatsapp, url, await nombreTienda()),
      reutilizado,
    })
  })

  caja.get('/buscar', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : ''
    res.json(await repo.buscar(q))
  })

  caja.get('/clientes/:codigo', async (req, res) => {
    const c = await repo.obtenerPorCodigo(String(req.params.codigo))
    if (!c) throw new AppError('NO_ENCONTRADO')
    res.json(c)
  })

  caja.post('/clientes/:codigo/canjear', async (req, res) => {
    res.json(await repo.canjear(String(req.params.codigo)))
  })

  caja.get('/ajustes', async (req, res) => { res.json(await repo.obtenerAjustes()) })

  caja.put('/ajustes', async (req, res) => { res.json(await repo.guardarAjustes(req.body)) })

  caja.put('/pin', async (req, res) => {
    const ip = ipDe(req)
    if (limitePin.bloqueado(ip)) throw new AppError('DEMASIADOS_INTENTOS')
    try {
      await repo.cambiarPin(req.body?.pinActual, req.body?.pinNuevo)
    } catch (e) {
      if (e instanceof AppError && e.code === 'CREDENCIALES_INCORRECTAS') limitePin.registrar(ip)
      throw e
    }
    res.json({ ok: true })
  })

  caja.get('/resumen', async (req, res) => { res.json(await repo.resumen()) })

  caja.get('/movimientos', async (req, res) => {
    const filas = await repo.movimientos(20)
    res.json(filas.map((m) => ({ ...m, whatsapp: enmascarar(m.whatsapp) })))
  })

  // ---------- cliente: entra con su número ----------
  const vistaTarjeta = (c: Cliente, nombre: string) => ({
    codigo: c.codigo, comercio: nombre, premio: config.premio,
    sellos: c.sellos, total: config.sellosRequeridos, whatsapp: enmascarar(c.whatsapp),
  })

  app.post('/api/entrar', async (req, res) => {
    const ip = ipDe(req)
    if (limiteEntradas.bloqueado(ip)) throw new AppError('DEMASIADOS_INTENTOS')
    limiteEntradas.registrar(ip)
    const c = await repo.entrar(req.body?.whatsapp)
    const segundos = config.clienteSesionDias * 86400
    res.set('Set-Cookie', `${COOKIE_CLIENTE}=${emitir(`c:${c.codigo}`, segundos)}; Max-Age=${segundos}; ${atributos()}`)
    res.json(vistaTarjeta(c, await nombreTienda()))
  })

  app.post('/api/salir', (req, res) => {
    res.set('Set-Cookie', `${COOKIE_CLIENTE}=; Max-Age=0; ${atributos()}`)
    res.json({ ok: true })
  })

  async function clienteActual(req: Request): Promise<Cliente> {
    const payload = verificar(leerCookie(req, COOKIE_CLIENTE))
    if (!payload?.startsWith('c:')) throw new AppError('NO_AUTORIZADO')
    const c = await repo.obtenerPorCodigo(payload.slice(2))
    if (!c) throw new AppError('NO_AUTORIZADO')
    return c
  }

  app.get('/api/tarjeta', async (req, res) => {
    res.json(vistaTarjeta(await clienteActual(req), await nombreTienda()))
  })

  app.post('/api/enlaces/:codigo/usar', async (req, res) => {
    const c = await repo.usarEnlace(String(req.params.codigo))
    const segundos = config.clienteSesionDias * 86400
    res.set('Set-Cookie', `${COOKIE_CLIENTE}=${emitir(`c:${c.codigo}`, segundos)}; Max-Age=${segundos}; ${atributos()}`)
    res.json(vistaTarjeta(c, await nombreTienda()))
  })

  app.use('/api', (req, res) => { res.status(404).json({ error: 'NO_ENCONTRADO' }) })

  app.use((err: unknown, req: Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof AppError) { res.status(err.status).json({ error: err.code, ...err.datos }); return }
    if ((err as { type?: string })?.type === 'entity.parse.failed') { res.status(400).json({ error: 'JSON_INVALIDO' }); return }
    console.error(err)
    res.status(500).json({ error: 'ERROR_INTERNO' })
  })

  return app
}
