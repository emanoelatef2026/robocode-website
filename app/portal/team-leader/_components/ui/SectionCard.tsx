'use client'

import type { ReactNode } from 'react'

interface SectionCardProps {
  title?:     string
  action?:    ReactNode
  children:   ReactNode
  className?: string
  noPad?:     boolean
}

export function SectionCard({ title, action, children, className = '', noPad = false }: SectionCardProps) {
  return (
    <div className={`rounded-2xl border border-[#D7E0EA] bg-white ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-[#EDF1F5] px-5 py-4">
          {title && <h3 className="text-[16px] font-semibold text-[#0B1F3A]">{title}</h3>}
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={noPad ? '' : 'p-5'}>{children}</div>
    </div>
  )
}
