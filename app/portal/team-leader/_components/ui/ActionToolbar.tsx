'use client'

import type { ReactNode } from 'react'

interface ActionToolbarProps {
  leading?:   ReactNode  // left-side content (selection count, info)
  trailing?:  ReactNode  // right-side actions
  sticky?:    boolean
  className?: string
}

export function ActionToolbar({ leading, trailing, sticky = false, className = '' }: ActionToolbarProps) {
  const stickyClass = sticky ? 'sticky bottom-4 z-20' : ''
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border border-[#D7E0EA] bg-white px-4 py-3 ${stickyClass} ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">{leading}</div>
      <div className="flex items-center gap-2 shrink-0">{trailing}</div>
    </div>
  )
}

// Standard action button for use inside ActionToolbar
interface ToolbarButtonProps {
  onClick?:   () => void
  disabled?:  boolean
  variant?:   'primary' | 'danger' | 'ghost'
  children:   ReactNode
  className?: string
}

const VARIANT_CLASSES: Record<NonNullable<ToolbarButtonProps['variant']>, string> = {
  primary: 'bg-[#0B1F3A] text-white hover:bg-[#163560] disabled:opacity-40',
  danger:  'bg-[#DC2626] text-white hover:bg-[#B91C1C] disabled:opacity-40',
  ghost:   'border border-[#D7E0EA] bg-white text-[#334155] hover:border-[#B8C6D6] hover:bg-[#F8FAFC] disabled:opacity-40',
}

export function ToolbarButton({ onClick, disabled, variant = 'ghost', children, className = '' }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-10 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold transition-colors ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
