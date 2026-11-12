import type { ReactNode } from 'react'

export default function Phone({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`mx-auto flex min-h-dvh w-full max-w-[390px] flex-col ${className}`}>
      {children}
    </div>
  )
}
