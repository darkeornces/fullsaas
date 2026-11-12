import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Keyboard, X } from 'lucide-react'
import QrScanner from 'qr-scanner'
import { codigoDeCliente } from '../api.ts'
import Phone from '../components/Phone.tsx'
import { Aviso } from '../components/Estado.tsx'

const esquina = 'absolute size-11 border-sun'

function mensajeCamara(e: unknown): string {
  if (!window.isSecureContext) return 'La cámara solo funciona con HTTPS (o en localhost). Usa la dirección segura de la tienda.'
  const texto = String(e)
  if (/Permission|NotAllowed/i.test(texto)) return 'Permite el acceso a la cámara en el navegador y vuelve a intentarlo.'
  if (/not found|NotFound|Requested device/i.test(texto)) return 'No se encontró ninguna cámara en este dispositivo.'
  return 'No se pudo abrir la cámara.'
}

export default function CajaEscanear() {
  const video = useRef<HTMLVideoElement>(null)
  const navigate = useNavigate()
  const [errorCamara, setErrorCamara] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    const el = video.current
    if (!el) return
    let atendido = false
    let ultimoRechazo = ''
    const escaner = new QrScanner(
      el,
      (resultado) => {
        if (atendido) return
        const codigo = codigoDeCliente(resultado.data)
        if (codigo) {
          atendido = true
          escaner.stop()
          navigate(`/caja/sumar/${codigo}`, { replace: true })
        } else if (resultado.data !== ultimoRechazo) {
          ultimoRechazo = resultado.data
          setAviso('Ese QR no es de un cliente. Pide que muestre su tarjeta.')
        }
      },
      { preferredCamera: 'environment', returnDetailedScanResult: true, maxScansPerSecond: 8, highlightScanRegion: false, highlightCodeOutline: false },
    )
    escaner.start().catch((e: unknown) => setErrorCamara(mensajeCamara(e)))
    return () => { escaner.stop(); escaner.destroy() }
  }, [navigate])

  return (
    <div className="bg-[#0d1712]">
      <Phone className="relative px-5 pb-8 pt-[60px] text-white">
        <video ref={video} muted playsInline className="absolute inset-0 size-full object-cover opacity-70" />
        <div className="relative flex flex-1 flex-col">
          <header className="flex items-center justify-between">
            <Link to="/caja" aria-label="Cerrar" className="flex size-11 items-center justify-center rounded-full bg-black/40"><X size={20} /></Link>
            <span className="rounded-full bg-black/40 px-4 py-2 font-semibold">Escanear cliente</span>
            <span className="size-11" />
          </header>

          <div className="relative mx-auto my-auto size-[240px]">
            <span className={`${esquina} left-0 top-0 rounded-tl-md border-l-[5px] border-t-[5px]`} />
            <span className={`${esquina} right-0 top-0 rounded-tr-md border-r-[5px] border-t-[5px]`} />
            <span className={`${esquina} bottom-0 left-0 rounded-bl-md border-b-[5px] border-l-[5px]`} />
            <span className={`${esquina} bottom-0 right-0 rounded-br-md border-b-[5px] border-r-[5px]`} />
          </div>

          <div className="flex flex-col gap-3">
            <p className="rounded-2xl bg-black/50 px-4 py-3 text-center text-sm">
              Apunta al QR de la tarjeta del cliente («¿Comes en el local?»)
            </p>
            <Aviso>{errorCamara ?? aviso}</Aviso>
            <Link to="/caja/sumar" className="flex items-center justify-center gap-2 rounded-full bg-white/15 py-4 text-sm font-semibold">
              <Keyboard size={16} /> Buscar por número o código
            </Link>
          </div>
        </div>
      </Phone>
    </div>
  )
}
