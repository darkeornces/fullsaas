import { useState } from 'react'
import { Check, Copy, Printer, Send } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import type { Fidelizacion } from '../tipos.ts'

interface Props { fid: Fidelizacion; comercio: string; total: number }

export default function CodigoGenerado({ fid, comercio, total }: Props) {
  const [copiado, setCopiado] = useState(false)

  const copiar = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const campo = e.currentTarget.parentElement?.querySelector('input')
    try {
      await navigator.clipboard.writeText(fid.enlace.url)
    } catch {
      campo?.select()
      document.execCommand('copy')
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <>
      {fid.reutilizado && (
        <p role="status" className="rounded-xl bg-sun/30 px-4 py-3 text-sm text-ink print:hidden">
          Este número ya tenía un código vigente sin usar: es el mismo QR. Podrás generar otro pasada 1 hora.
        </p>
      )}
      <div className="mx-auto flex w-[290px] flex-col items-center gap-3 rounded-3xl border border-line bg-surface p-5 print:border-0">
        <p className="font-head text-lg font-bold uppercase tracking-[0.15em]">{comercio}</p>
        <p className="font-head text-xl font-extrabold">¡SUMA TU SELLO!</p>
        <div className="rounded-2xl border-2 border-ink p-3"><QRCodeSVG value={fid.enlace.url} size={150} fgColor="#14231C" /></div>
        <p className="text-center text-xs text-muted">Escanéalo con la cámara o abre el enlace. Vale una sola vez.</p>
        <p className="text-sm font-semibold">{fid.cliente.whatsapp} · {fid.cliente.sellos}/{total}</p>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-green/30 bg-white p-2 print:hidden">
        <input
          readOnly value={fid.enlace.url} aria-label="Enlace de un solo uso" onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 bg-transparent px-2 text-xs text-muted"
        />
        <button onClick={copiar} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-green px-3 py-2 text-xs font-bold text-white">
          {copiado ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
        </button>
      </div>

      <div className="flex flex-col gap-3 print:hidden">
        <a href={fid.waLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-full bg-[#1a9e4b] py-4 text-base font-bold text-white">
          <Send size={18} /> Enviar por WhatsApp
        </a>
        <button onClick={() => window.print()} className="flex items-center justify-center gap-2 rounded-full border border-line bg-surface py-3 text-sm font-semibold"><Printer size={16} /> Imprimir</button>
      </div>
    </>
  )
}
