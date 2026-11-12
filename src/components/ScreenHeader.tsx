export default function ScreenHeader({ hello, title, iniciales = '' }: { hello: string; title: string; iniciales?: string }) {
  return (
    <header className="flex items-center justify-between px-1">
      <div>
        <p className="text-[15px] text-muted">{hello}</p>
        <h1 className="font-head text-[28px] font-bold tracking-tight text-ink">{title}</h1>
      </div>
      <div className="flex size-11 items-center justify-center rounded-full bg-sun text-[15px] font-bold">{iniciales}</div>
    </header>
  )
}
