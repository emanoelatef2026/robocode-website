'use client'

import type { ReactNode } from 'react'

interface StatCardProps {
  label:      string
  value:      string | number | null | undefined
  sub?:       string
  icon?:      ReactNode
  accent?:    'green' | 'red' | 'amber' | 'blue' | 'slate'
  className?: string
}

const ACCENT_CLASSES: Record<NonNullable<StatCardProps['accent']>, string> = {
  green: 'text-emerald-700',
  red:   'text-red-700',
  amber: 'text-amber-700',
  blue:  'text-blue-700',
  slate: 'text-slate-600',
}

export function StatCard({ label, value, sub, icon, accent, className = '' }: StatCardProps) {
  const valueClass = accent ? ACCENT_CLASSES[accent] : 'text-[#1E293B]'
  return (
    <div className={`flex flex-col gap-1 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#64748B]">{label}</span>
        {icon && <span className="text-[#94A3B8]">{icon}</span>}
      </div>
      <span className={`text-2xl font-bold tabular-nums ${valueClass}`}>
        {value ?? '—'}
      </span>
      {sub && <span className="text-[10px] text-[#94A3B8]">{sub}</span>}
    </div>
  )
}
