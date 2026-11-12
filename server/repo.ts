import { randomBytes, randomInt } from 'node:crypto'
import type { Db } from 'mongodb'
import { AppError } from './errors.ts'
import { inicioDelDia } from './tiempo.ts'
import type { Cliente, Config, Enlace, Movimiento, Resumen } from './tipos.ts'

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const SIN_ID = { projection: { _id: 0 } }
const SIN_INTERNOS = { projection: { _id: 0, ultimoEnlace: 0 } }
const DUPLICADO = 11000

const nuevoCodigo = (): string =>
  'CL-' + Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('')
const nuevoToken = (bytes = 24): string => randomBytes(bytes).toString('base64url')

export function normalizarWhatsapp(entrada: unknown): string {
  let n = String(entrada ?? '').replace(/[\s().-]/g, '')
  if (n.startsWith('00')) n = '+' + n.slice(2)
  if (!/^\+\d{8,15}$/.test(n)) throw new AppError('WHATSAPP_INVALIDO')
  return n
}

export type Repo = ReturnType<typeof createRepo>

export function createRepo(db: Db, config: Pick<Config, 'nombre' | 'sellosRequeridos' | 'enlaceVigenciaHoras' | 'enlaceEsperaMinutos' | 'zonaHoraria'>, now: () => Date = () => new Date()) {
  const clientes = db.collection<Cliente & { ultimoEnlace?: { codigo: string; creadoEn: Date } }>('clientes')
  const enlaces = db.collection<Enlace>('enlaces')
  const movimientos = db.collection('movimientos')
  const ajustes = db.collection<{ _id: string; enlaceEsperaMinutos?: unknown; nombre?: unknown }>('ajustes')

  const registrar = (tipo: Movimiento['tipo'], datos: Record<string, unknown>) => movimientos.insertOne({ tipo, fecha: now(), ...datos })

  async function init() {
    await clientes.createIndex({ codigo: 1 }, { unique: true })
    await clientes.createIndex(
      { whatsapp: 1 },
      { unique: true, partialFilterExpression: { whatsapp: { $type: 'string' } } },
    )
    await enlaces.createIndex({ codigo: 1 }, { unique: true })
    await movimientos.createIndex({ fecha: -1 })
    await ajustes.updateOne({ _id: 'general' }, { $setOnInsert: { enlaceEsperaMinutos: config.enlaceEsperaMinutos } }, { upsert: true })
    await ajustes.updateOne({ _id: 'general', nombre: { $exists: false } }, { $set: { nombre: config.nombre } })
  }

  const obtenerPorCodigo = (codigo: string) => clientes.findOne({ codigo }, SIN_INTERNOS)

  async function entrar(entrada: unknown): Promise<Cliente> {
    const whatsapp = normalizarWhatsapp(entrada)
    for (;;) {
      try {
        const r = await clientes.findOneAndUpdate(
          { whatsapp },
          { $setOnInsert: { codigo: nuevoCodigo(), sellos: 0, canjes: 0, creadoEn: now() } },
          { upsert: true, returnDocument: 'after', includeResultMetadata: true },
        )
        if (!r.value) throw new Error('upsert sin documento')
        const { _id, ultimoEnlace, ...cliente } = r.value
        if (!r.lastErrorObject?.updatedExisting) await registrar('alta', { codigo: cliente.codigo })
        return cliente
      } catch (e) {
        if ((e as { code?: number }).code !== DUPLICADO) throw e
      }
    }
  }

  async function buscar(consulta: unknown): Promise<Cliente> {
    const q = String(consulta ?? '').trim()
    let filtro
    if (/^cl-/i.test(q)) filtro = { codigo: q.toUpperCase() }
    else {
      try { filtro = { whatsapp: normalizarWhatsapp(q) } } catch { throw new AppError('NO_ENCONTRADO') }
    }
    const c = await clientes.findOne(filtro, SIN_INTERNOS)
    if (!c) throw new AppError('NO_ENCONTRADO')
    return c
  }

  async function sumarSello(codigo: string, datos: Record<string, unknown> = {}): Promise<Cliente> {
    const c = await clientes.findOneAndUpdate(
      { codigo, sellos: { $lt: config.sellosRequeridos } }, { $inc: { sellos: 1 } },
      { returnDocument: 'after', ...SIN_INTERNOS },
    )
    if (!c) throw new AppError((await obtenerPorCodigo(codigo)) ? 'TARJETA_COMPLETA' : 'NO_ENCONTRADO')
    await registrar('sello', { codigo, ...datos })
    return c
  }

  async function canjear(codigo: string): Promise<Cliente> {
    const c = await clientes.findOneAndUpdate(
      { codigo, sellos: { $gte: config.sellosRequeridos } },
      { $set: { sellos: 0 }, $inc: { canjes: 1 } },
      { returnDocument: 'after', ...SIN_INTERNOS },
    )
    if (!c) throw new AppError((await obtenerPorCodigo(codigo)) ? 'SIN_PREMIO' : 'NO_ENCONTRADO')
    await registrar('canje', { codigo })
    return c
  }

  const nombreValido = (valor: unknown): string | null => {
    if (typeof valor !== 'string' || /[\u0000-\u001f\u007f]/.test(valor)) return null
    const limpio = valor.trim().replace(/\s+/g, ' ')
    return limpio.length >= 1 && limpio.length <= 40 ? limpio : null
  }

  async function leerAjustes(): Promise<{ enlaceEsperaMinutos: number; nombre: string }> {
    const doc = await ajustes.findOne({ _id: 'general' })
    const espera = doc?.enlaceEsperaMinutos
    return {
      enlaceEsperaMinutos: typeof espera === 'number' && Number.isFinite(espera) && espera >= 0 ? espera : config.enlaceEsperaMinutos,
      nombre: nombreValido(doc?.nombre) ?? config.nombre,
    }
  }

  const esperaMinutos = async (): Promise<number> => (await leerAjustes()).enlaceEsperaMinutos
  const obtenerAjustes = leerAjustes

  async function guardarAjustes(entrada: unknown): Promise<{ enlaceEsperaMinutos: number; nombre: string }> {
    const cuerpo = (entrada ?? {}) as { enlaceEsperaMinutos?: unknown; nombre?: unknown }
    const cambios: { enlaceEsperaMinutos?: number; nombre?: string } = {}
    if (cuerpo.enlaceEsperaMinutos !== undefined) {
      const v = cuerpo.enlaceEsperaMinutos
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 1440) throw new AppError('DATOS_INVALIDOS')
      cambios.enlaceEsperaMinutos = v
    }
    if (cuerpo.nombre !== undefined) {
      const n = nombreValido(cuerpo.nombre)
      if (n === null) throw new AppError('DATOS_INVALIDOS')
      cambios.nombre = n
    }
    if (Object.keys(cambios).length === 0) throw new AppError('DATOS_INVALIDOS')
    await ajustes.updateOne({ _id: 'general' }, { $set: cambios }, { upsert: true })
    return leerAjustes()
  }

  const vigencia = (desde: Date) => new Date(desde.getTime() + config.enlaceVigenciaHoras * 3_600_000)

  async function crearEnlace(whatsapp: unknown): Promise<{ enlace: Enlace; cliente: Cliente; reutilizado: boolean }> {
    const base = await entrar(whatsapp)
    const ahora = now()
    const espera = (await esperaMinutos()) * 60_000
    const codigo = nuevoToken(12)

    const previo = await clientes.findOneAndUpdate(
      { codigo: base.codigo, $or: [{ ultimoEnlace: { $exists: false } }, { 'ultimoEnlace.creadoEn': { $lte: new Date(ahora.getTime() - espera) } }] },
      { $set: { ultimoEnlace: { codigo, creadoEn: ahora } } },
      { returnDocument: 'before' },
    )
    if (previo) {
      if (previo.ultimoEnlace) await enlaces.updateOne({ codigo: previo.ultimoEnlace.codigo, usado: false }, { $set: { revocado: true } })
      const enlace: Enlace = { codigo, cliente: base.codigo, usado: false, creadoEn: ahora, expiraEn: vigencia(ahora) }
      await enlaces.insertOne({ ...enlace })
      return { enlace, cliente: base, reutilizado: false }
    }

    const actual = await clientes.findOne({ codigo: base.codigo })
    const ultimo = actual?.ultimoEnlace
    if (!ultimo) throw new AppError('NO_ENCONTRADO')
    const existente = await enlaces.findOne({ codigo: ultimo.codigo }, SIN_ID)
    const pendiente: Enlace = existente ?? { codigo: ultimo.codigo, cliente: base.codigo, usado: false, creadoEn: ultimo.creadoEn, expiraEn: vigencia(ultimo.creadoEn) }
    if (!pendiente.usado && !pendiente.revocado && pendiente.expiraEn > ahora) {
      return { enlace: pendiente, cliente: base, reutilizado: true }
    }
    const minutos = Math.ceil((ultimo.creadoEn.getTime() + espera - ahora.getTime()) / 60_000)
    throw new AppError('ESPERA_REQUERIDA', { minutos })
  }

  async function usarEnlace(codigo: string): Promise<Cliente> {
    const ahora = now()
    const previo = await enlaces.findOne({ codigo: String(codigo) }, SIN_ID)
    if (!previo) throw new AppError('ENLACE_NO_EXISTE')
    const cliente = await obtenerPorCodigo(previo.cliente)
    if (!cliente) throw new AppError('NO_ENCONTRADO')
    if (previo.revocado && !previo.usado) throw new AppError('ENLACE_EXPIRADO')
    if (!previo.usado && previo.expiraEn > ahora && cliente.sellos >= config.sellosRequeridos) throw new AppError('TARJETA_COMPLETA')

    const consumido = await enlaces.findOneAndUpdate(
      { codigo: previo.codigo, usado: false, revocado: { $ne: true }, expiraEn: { $gt: ahora } },
      { $set: { usado: true, usadoEn: ahora } },
      { returnDocument: 'after', ...SIN_ID },
    )
    if (!consumido) throw new AppError(previo.usado || (await enlaces.findOne({ codigo: previo.codigo, usado: true })) ? 'ENLACE_USADO' : 'ENLACE_EXPIRADO')
    try {
      return await sumarSello(cliente.codigo, { origen: 'enlace' })
    } catch (e) {
      await enlaces.updateOne({ codigo: previo.codigo }, { $set: { usado: false }, $unset: { usadoEn: '' } })
      throw e
    }
  }

  const listarMovimientos = (limite = 20): Promise<Movimiento[]> =>
    movimientos.aggregate([
      { $sort: { fecha: -1, _id: -1 } },
      { $limit: limite },
      { $lookup: { from: 'clientes', localField: 'codigo', foreignField: 'codigo', as: 'c' } },
      { $set: { c: { $first: '$c' } } },
      { $project: { _id: 0, tipo: 1, fecha: 1, codigo: 1, origen: 1, whatsapp: '$c.whatsapp', sellos: '$c.sellos' } },
    ]).toArray() as Promise<Movimiento[]>

  async function resumen(): Promise<Resumen> {
    const desde = inicioDelDia(now(), config.zonaHoraria)
    const filas = await movimientos.aggregate([
      { $match: { fecha: { $gte: desde } } },
      { $group: { _id: '$tipo', n: { $sum: 1 } } },
    ]).toArray()
    const n = (t: string) => filas.find((f) => f._id === t)?.n ?? 0
    return { sellosHoy: n('sello'), clientesNuevos: n('alta'), canjes: n('canje') }
  }

  return {
    init, entrar, buscar, obtenerPorCodigo,
    sumarSello, canjear, crearEnlace, usarEnlace, movimientos: listarMovimientos, resumen, obtenerAjustes, guardarAjustes,
  }
}
