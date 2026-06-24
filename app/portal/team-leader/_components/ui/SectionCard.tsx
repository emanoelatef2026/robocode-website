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
    <div className={`ds-card shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3">
          {title && <h3 className="text-sm font-semibold text-[#1E293B]">{title}</h3>}
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={noPad ? '' : 'p-5'}>{children}</div>
    </div>
  )
}
