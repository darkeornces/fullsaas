import { Gift, Utensils } from 'lucide-react'

export default function Stamps({ count, total = 10 }: { count: number; total?: number }) {
  const done = count >= total
  return (
    <div className="grid grid-cols-5 gap-2.5">
      {Array.from({ length: total }, (_, i) => {
        const base = 'flex h-14 items-center justify-center rounded-full'
        if (i === total - 1) {
          return done ? (
            <div key={i} className={`${base} bg-accent`}><Gift size={22} className="text-white" /></div>
          ) : (
            <div key={i} className={`${base} border-[1.5px] border-accent bg-accent/20`}><Gift size={22} className="text-accent" /></div>
          )
        }
        return i < count ? (
          <div key={i} className={`${base} bg-sun`}><Utensils size={20} className="text-green" /></div>
        ) : (
          <div key={i} className={`${base} border-[1.5px] border-white/25 bg-white/[0.07] text-[15px] font-semibold text-white/40`}>{i + 1}</div>
        )
      })}
    </div>
  )
}
