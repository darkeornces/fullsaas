import { Sparkles } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import Phone from '../components/Phone.tsx'
import ScreenHeader from '../components/ScreenHeader.tsx'
import LoyaltyCard from '../components/LoyaltyCard.tsx'
import { useCliente } from './ClienteGate.tsx'

export default function Gratis() {
  const { tarjeta } = useCliente()
  return (
    <Phone className="gap-5 px-5 pb-8 pt-[60px]">
      <ScreenHeader hello="¡Enhorabuena!" title="Te lo has ganado" iniciales={tarjeta.codigo.slice(3, 5)} />
      <LoyaltyCard nombre={tarjeta.comercio} count={tarjeta.sellos} total={tarjeta.total} emoji="🎉" title="¡Tarjeta completa!" sub="El próximo almuerzo invita la casa" />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[28px] bg-accent p-6 text-white">
        <div className="rounded-2xl bg-white p-4">
          <QRCodeSVG value={tarjeta.codigo} size={140} fgColor="#14231C" />
        </div>
        <p className="font-head text-[26px] font-bold">1 {tarjeta.premio}</p>
        <p className="text-[13px] text-white/85">Enséñalo en caja para canjearlo · {tarjeta.codigo}</p>
      </div>
      <p className="flex items-center justify-center gap-2.5 rounded-full bg-green py-5 text-[17px] font-semibold text-white">
        <Sparkles size={20} /> Pídelo en caja
      </p>
    </Phone>
  )
}
