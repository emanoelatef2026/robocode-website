'use client'

import type { ReactNode } from 'react'

interface EmptyStateProps {
  title:       string
  description?: string
  action?:     ReactNode
  icon?:       ReactNode
  className?:  string
}

export function EmptyState({ title, description, action, icon, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] py-12 text-center ${className}`}>
      {icon && <div className="text-3xl text-[#CBD5E1]">{icon}</div>}
      <div className="space-y-1">
        <p className="text-sm font-medium text-[#475569]">{title}</p>
        {description && <p className="text-xs text-[#94A3B8]">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
