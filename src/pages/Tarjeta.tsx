import { Link, useLocation } from 'react-router-dom'
import { Bike, ScanLine } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import Phone from '../components/Phone.tsx'
import ScreenHeader from '../components/ScreenHeader.tsx'
import LoyaltyCard from '../components/LoyaltyCard.tsx'
import { Aviso } from '../components/Estado.tsx'
import { useCliente } from './ClienteGate.tsx'
import Gratis from './Gratis.tsx'

export default function Tarjeta() {
  const { tarjeta, salir } = useCliente()
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso
  if (tarjeta.sellos >= tarjeta.total) return <Gratis />

  const faltan = tarjeta.total - tarjeta.sellos
  return (
    <Phone className="gap-5 px-5 pb-8 pt-[60px]">
      <ScreenHeader hello="Hola" title="Tu tarjeta" iniciales={tarjeta.codigo.slice(3, 5)} />
      <Aviso>{aviso}</Aviso>
      <LoyaltyCard
        nombre={tarjeta.comercio} count={tarjeta.sellos} total={tarjeta.total}
        title={`Al ${tarjeta.total}º: ${tarjeta.premio}`} sub={faltan === 1 ? 'Te falta 1 menú' : `Te faltan ${faltan} menús`}
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-[28px] border border-line bg-surface p-5">
        <div className="flex size-[132px] items-center justify-center rounded-2xl bg-bg">
          <QRCodeSVG value={tarjeta.codigo} size={104} fgColor="#14231C" bgColor="transparent" />
        </div>
        <p className="font-head text-xl font-bold">¿Comes en el local?</p>
        <p className="text-sm text-muted">Enseña este QR al pagar · {tarjeta.codigo}</p>
      </div>
      <p className="flex items-center justify-center gap-2 text-[13px] text-muted">
        <Bike size={16} /> ¿Pediste a domicilio? Escanea el QR de tu bolsa
      </p>
      <Link to="/app/escanear" className="flex items-center justify-center gap-2.5 rounded-full bg-accent py-5 text-[17px] font-semibold text-white">
        <ScanLine size={20} /> Escanear QR de mi pedido
      </Link>
      <button onClick={() => void salir()} className="text-center text-xs text-muted underline">
        {tarjeta.whatsapp} · No soy yo
      </button>
    </Phone>
  )
}
