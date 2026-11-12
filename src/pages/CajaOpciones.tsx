import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { api } from '../api.ts'
import { useAccion, useCarga } from '../hooks.ts'
import Phone from '../components/Phone.tsx'
import { Aviso, Cargando, Fallo } from '../components/Estado.tsx'

const ATAJOS = [15, 30, 60, 120]

export default function CajaOpciones() {
  const { datos, error } = useCarga(() => api.ajustes(), [])
  const [activa, setActiva] = useState<boolean | null>(null)
  const [minutos, setMinutos] = useState('')
  const [guardado, setGuardado] = useState(false)
  const { error: errorGuardar, ocupado, ejecutar } = useAccion()

  if (error) return <Fallo error={error} to="/caja" enlace="Volver a caja" />
  if (!datos) return <Cargando />

  const espera = datos.enlaceEsperaMinutos
  const estaActiva = activa ?? espera > 0
  const valor = minutos !== '' ? minutos : String(espera > 0 ? espera : 60)
  const numero = Number(valor)
  const valido = !estaActiva || (Number.isInteger(numero) && numero >= 1 && numero <= 1440)

  const guardar = async () => {
    setGuardado(false)
    const r = await ejecutar(() => api.guardarAjustes({ enlaceEsperaMinutos: estaActiva ? numero : 0 }))
    if (r) setGuardado(true)
  }

  return (
    <Phone className="gap-5 px-5 pb-8 pt-[60px]">
      <header className="flex items-center gap-3">
        <Link to="/caja" aria-label="Volver" className="flex size-10 items-center justify-center rounded-full border border-line bg-surface"><ArrowLeft size={18} /></Link>
        <h1 className="font-head text-2xl font-bold">Opciones</h1>
      </header>

      <section className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-head text-lg font-bold">Espera entre códigos</h2>
            <p className="mt-1 text-sm text-muted">Tiempo que debe pasar antes de generar un código nuevo para el mismo número de WhatsApp.</p>
          </div>
          <button
            role="switch" aria-checked={estaActiva} aria-label="Esperar entre códigos"
            onClick={() => { setActiva(!estaActiva); setGuardado(false) }}
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
                  key={m} onClick={() => { setMinutos(String(m)); setGuardado(false) }}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${valor === String(m) ? 'border-green bg-green text-white' : 'border-line bg-bg'}`}
                >
                  {m >= 60 ? `${m / 60} h` : `${m} min`}
                </button>
              ))}
            </div>
            <input
              id="min" type="number" inputMode="numeric" min={1} max={1440} value={valor}
              onChange={(e) => { setMinutos(e.target.value); setGuardado(false) }}
              className="w-full rounded-2xl border-2 border-line bg-bg px-4 py-3 text-lg focus:border-green focus:outline-none"
            />
            {!valido && <p className="text-xs text-[#b23a17]">Escribe un número entero entre 1 y 1440 minutos.</p>}
          </div>
        ) : (
          <p className="rounded-2xl bg-sun/25 p-4 text-sm">
            <strong>Sin espera.</strong> Cada vez que generes un código para un número se crea uno nuevo, y el anterior sin usar deja de valer.
          </p>
        )}
      </section>

      <Aviso>{errorGuardar}</Aviso>
      <button
        onClick={() => void guardar()} disabled={!valido || ocupado}
        className="flex items-center justify-center gap-2 rounded-full bg-accent py-4 text-base font-bold text-white disabled:opacity-40"
      >
        {guardado ? <><Check size={18} /> Guardado</> : ocupado ? 'Guardando…' : 'Guardar'}
      </button>
    </Phone>
  )
}
