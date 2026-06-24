'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

interface Props {
  id:           string
  label:        string
  icon?:        string
  badge?:       number | null
  badgeColor?:  string
  defaultOpen?: boolean
  children:     ReactNode
}

export default function DashSection({
  id,
  label,
  icon,
  badge,
  badgeColor = 'bg-[#FF8A1F]/10 text-[#FF8A1F]',
  defaultOpen = true,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section id={id}>
      <button
        onClick={() => setOpen(v => !v)}
        className="mb-2 md:mb-4 flex w-full items-center justify-between ds-card px-4 py-2.5 md:py-3 text-left transition hover:border-[#CBD5E1] hover:bg-[#F8FAFC] active:scale-[0.99]"
      >
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-base leading-none">{icon}</span>}
          <span className="text-[14px] font-bold text-[#0B1F3A]">{label}</span>
          {badge != null && badge > 0 && (
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badgeColor}`}>
              {badge}
            </span>
          )}
        </div>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 shrink-0 text-[#94A3B8] transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && <div className="space-y-4">{children}</div>}
    </section>
  )
}
