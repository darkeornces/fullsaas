import { Utensils } from 'lucide-react'
import Stamps from './Stamps.tsx'

interface Props { nombre: string; count: number; total: number; title: string; sub: string; emoji?: string }

export default function LoyaltyCard({ nombre, count, total, title, sub, emoji = '🍽️' }: Props) {
  return (
    <div className="flex flex-col gap-6 rounded-[28px] bg-green p-6 shadow-[0_20px_40px_#1F4D3A40]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-sun">
            <Utensils size={22} className="text-green" />
          </div>
          <div>
            <p className="font-head text-xl font-bold text-white">{nombre}</p>
            <p className="text-[13px] text-white/70">Tarjeta de sellos</p>
          </div>
        </div>
        <span className="font-head text-[22px] font-bold text-sun">{count}/{total}</span>
      </div>
      <Stamps count={count} total={total} />
      <div className="flex items-center gap-3 rounded-2xl bg-white/[0.08] p-4">
        <span className="text-[26px]">{emoji}</span>
        <div>
          <p className="text-[15px] font-bold text-white">{title}</p>
          <p className="text-[13px] text-white/70">{sub}</p>
        </div>
      </div>
    </div>
  )
}
