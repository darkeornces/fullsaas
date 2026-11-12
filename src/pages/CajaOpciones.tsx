import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { api } from '../api.ts'
import { useAccion, useCarga } from '../hooks.ts'
import Phone from '../components/Phone.tsx'
import { Aviso, Cargando, Fallo } from '../components/Estado.tsx'
import { useCaja } from './CajaGate.tsx'

const ATAJOS = [15, 30, 60, 120]
const MAX_NOMBRE = 40

export default function CajaOpciones() {
  const { recargar } = useCaja()
  const { datos, error } = useCarga(() => api.ajustes(), [])
  const [activa, setActiva] = useState<boolean | null>(null)
  const [minutos, setMinutos] = useState('')
  const [nombre, setNombre] = useState<string | null>(null)
  const [correo, setCorreo] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)
  const { error: errorGuardar, ocupado, ejecutar } = useAccion()

  if (error) return <Fallo error={error} to="/caja" enlace="Volver a caja" />
  if (!datos) return <Cargando />

  const espera = datos.enlaceEsperaMinutos
  const estaActiva = activa ?? espera > 0
  const valor = minutos !== '' ? minutos : String(espera > 0 ? espera : 60)
  const numero = Number(valor)
  const esperaValida = !estaActiva || (Number.isInteger(numero) && numero >= 1 && numero <= 1440)

  const nombreActual = nombre ?? datos.nombre
  const nombreLimpio = nombreActual.trim().replace(/\s+/g, ' ')
  const nombreValido = nombreLimpio.length >= 1 && nombreLimpio.length <= MAX_NOMBRE

  const correoActual = correo ?? datos.correo ?? ''
  const correoLimpio = correoActual.trim().toLowerCase()
  const correoValido = correoLimpio === '' ? !datos.correo : /^[^\s@]+@[^\s@.]+(\.[^\s@.]{2,})+$/.test(correoLimpio)
  const correoCambiado = correoLimpio !== '' && correoLimpio !== (datos.correo ?? '')

  const cambiado = nombreLimpio !== datos.nombre || (estaActiva ? numero : 0) !== espera || correoCambiado
  const puedeGuardar = esperaValida && nombreValido && correoValido && cambiado

  const guardar = async () => {
    setGuardado(false)
    const r = await ejecutar(() => api.guardarAjustes({ nombre: nombreLimpio, enlaceEsperaMinutos: estaActiva ? numero : 0, ...(correoCambiado ? { correo: correoLimpio } : {}) }))
    if (r) { setGuardado(true); setNombre(r.nombre); setCorreo(r.correo ?? null); recargar() }
  }
  const tocar = () => setGuardado(false)

  return (
    <Phone className="gap-5 px-5 pb-8 pt-[60px]">
      <header className="flex items-center gap-3">
        <Link to="/caja" aria-label="Volver" className="flex size-10 items-center justify-center rounded-full border border-line bg-surface"><ArrowLeft size={18} /></Link>
        <h1 className="font-head text-2xl font-bold">Opciones</h1>
      </header>

      <section className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5">
        <div>
          <h2 className="font-head text-lg font-bold">Nombre de la tienda</h2>
          <p className="mt-1 text-sm text-muted">Aparece en la tarjeta del cliente, en el código QR y en el mensaje de WhatsApp.</p>
        </div>
        <input
          id="nombre" aria-label="Nombre de la tienda" value={nombreActual} maxLength={MAX_NOMBRE} autoComplete="off"
          onChange={(e) => { setNombre(e.target.value); tocar() }}
          className="w-full rounded-2xl border-2 border-line bg-bg px-4 py-3 text-lg focus:border-green focus:outline-none"
        />
        <div className="flex justify-between text-xs">
          {!nombreValido ? <span className="text-[#b23a17]">Escribe un nombre (hasta {MAX_NOMBRE} caracteres).</span> : <span />}
          <span className="text-muted">{nombreActual.length}/{MAX_NOMBRE}</span>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5">
        <div>
          <h2 className="font-head text-lg font-bold">Correo de acceso</h2>
          <p className="mt-1 text-sm text-muted">
            {datos.correo
              ? 'Para entrar a la tienda se pide este correo y el PIN.'
              : 'Aún no hay correo: hoy se entra solo con el PIN. Si lo defines, se pedirá correo y PIN.'}
          </p>
        </div>
        <input
          id="correo" type="email" inputMode="email" aria-label="Correo de acceso" autoComplete="off" placeholder="tu@correo.com"
          value={correoActual} onChange={(e) => { setCorreo(e.target.value); tocar() }}
          className="w-full rounded-2xl border-2 border-line bg-bg px-4 py-3 text-lg focus:border-green focus:outline-none"
        />
        {!correoValido && <p className="text-xs text-[#b23a17]">Escribe un correo válido, por ejemplo tu@correo.com.</p>}
      </section>

      <section className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-head text-lg font-bold">Espera entre códigos</h2>
            <p className="mt-1 text-sm text-muted">Tiempo que debe pasar antes de generar un código nuevo para el mismo número de WhatsApp.</p>
          </div>
          <button
            role="switch" aria-checked={estaActiva} aria-label="Esperar entre códigos"
            onClick={() => { setActiva(!estaActiva); tocar() }}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${estaActiva ? 'bg-green' : 'bg-line'}`}
          >
            <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${estaActiva ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>

        {estaActiva ? (
          <div className="flex flex-col gap-3">
            <label htmlFor="min" className="text-xs font-semibold">Minutos de espera</label>
            <div className="flex flex-wrap gap-2">
              {ATAJOS.map((m) => (
                <button
                  key={m} onClick={() => { setMinutos(String(m)); tocar() }}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${valor === String(m) ? 'border-green bg-green text-white' : 'border-line bg-bg'}`}
                >
                  {m >= 60 ? `${m / 60} h` : `${m} min`}
                </button>
              ))}
            </div>
            <input
              id="min" type="number" inputMode="numeric" min={1} max={1440} value={valor}
              onChange={(e) => { setMinutos(e.target.value); tocar() }}
              className="w-full rounded-2xl border-2 border-line bg-bg px-4 py-3 text-lg focus:border-green focus:outline-none"
            />
            {!esperaValida && <p className="text-xs text-[#b23a17]">Escribe un número entero entre 1 y 1440 minutos.</p>}
          </div>
        ) : (
          <p className="rounded-2xl bg-sun/25 p-4 text-sm">
            <strong>Sin espera.</strong> Cada vez que generes un código para un número se crea uno nuevo, y el anterior sin usar deja de valer.
          </p>
        )}
      </section>

      <Aviso>{errorGuardar}</Aviso>
      <button
        onClick={() => void guardar()} disabled={(!puedeGuardar && !guardado) || ocupado}
        className="flex items-center justify-center gap-2 rounded-full bg-accent py-4 text-base font-bold text-white disabled:opacity-40"
      >
        {guardado ? <><Check size={18} /> Guardado</> : ocupado ? 'Guardando…' : 'Guardar'}
      </button>
    </Phone>
  )
}
