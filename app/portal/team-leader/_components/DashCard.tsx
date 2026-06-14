import type { ReactNode } from 'react'

interface DashCardProps {
  title:     string
  count?:    number | null
  badge?:    ReactNode
  action?:   ReactNode
  children:  ReactNode
  accent?:   string
  className?: string
  id?:       string
}

export default function DashCard({ title, count, badge, action, children, accent = 'border-[#E2E8F0]', className = '', id }: DashCardProps) {
  return (
    <div id={id} className={`rounded-2xl border bg-white overflow-hidden ${accent} ${className}`}>
      <div className={`flex items-center justify-between gap-2 px-4 py-3 border-b ${accent}`}>
        <div className="flex items-center gap-2 min-w-0">
          <p className="truncate text-[13px] font-semibold text-[#0B1F3A]">{title}</p>
          {count != null && count > 0 && (
            <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#FF8A1F] px-1.5 text-[10px] font-bold text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
          {badge}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  )
}

interface DashCardEmptyProps {
  text:    string
  emoji?:  string
}

export function DashCardEmpty({ text, emoji = '' }: DashCardEmptyProps) {
  return (
    <p className="px-4 py-5 md:py-8 text-center text-[12px] text-[#94A3B8]">
      {emoji && <span className="mr-1.5">{emoji}</span>}{text}
    </p>
  )
}

interface DashRowProps {
  left:      ReactNode
  right?:    ReactNode
  actions?:  ReactNode
  onClick?:  () => void
  className?: string
}

export function DashRow({ left, right, actions, onClick, className = '' }: DashRowProps) {
  return (
    <div
      className={`flex items-center gap-3 border-b border-[#F1F5F9] px-4 py-3 last:border-0 ${onClick ? 'cursor-pointer hover:bg-[#F8FAFC] active:bg-[#F1F5F9]' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">{left}</div>
      {right   && <div className="shrink-0 text-right">{right}</div>}
      {actions && <div className="shrink-0 flex items-center gap-1.5">{actions}</div>}
    </div>
  )
}

interface SkeletonRowsProps {
  count?: number
  className?: string
}

export function SkeletonRows({ count = 3, className = '' }: SkeletonRowsProps) {
  return (
    <div className={`space-y-0 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-[#F1F5F9] px-4 py-3 last:border-0">
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-2/3 rounded-full bg-[#F1F5F9] animate-pulse" />
            <div className="h-2.5 w-1/2 rounded-full bg-[#F8FAFC] animate-pulse" />
          </div>
          <div className="h-5 w-12 rounded-full bg-[#F1F5F9] animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden ${className}`}>
      <div className="border-b border-[#E2E8F0] px-4 py-3">
        <div className="h-3.5 w-1/3 rounded-full bg-[#F1F5F9] animate-pulse" />
      </div>
      <SkeletonRows count={4} />
    </div>
  )
}
