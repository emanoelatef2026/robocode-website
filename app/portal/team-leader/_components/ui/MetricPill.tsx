'use client'

type Variant = 'green' | 'red' | 'amber' | 'blue' | 'slate' | 'purple'

const CLASSES: Record<Variant, string> = {
  green:  'bg-emerald-100 text-emerald-700',
  red:    'bg-red-100 text-red-700',
  amber:  'bg-amber-100 text-amber-700',
  blue:   'bg-blue-100 text-blue-700',
  slate:  'bg-slate-100 text-slate-600',
  purple: 'bg-purple-100 text-purple-700',
}

interface MetricPillProps {
  label:      string
  variant?:   Variant
  className?: string
}

export function MetricPill({ label, variant = 'slate', className = '' }: MetricPillProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${CLASSES[variant]} ${className}`}>
      {label}
    </span>
  )
}

// Derives variant from a numeric percentage value using operational-engine thresholds
export function AttendancePill({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <MetricPill label="—" variant="slate" />
  const variant: Variant = pct >= 80 ? 'green' : pct >= 60 ? 'amber' : 'red'
  return <MetricPill label={`${pct}%`} variant={variant} />
}

// Derives variant from sessions remaining
export function SessionsPill({ remaining }: { remaining: number | null | undefined }) {
  if (remaining == null) return <MetricPill label="—" variant="slate" />
  const variant: Variant = remaining <= 0 ? 'red' : remaining <= 2 ? 'amber' : 'green'
  return <MetricPill label={`${remaining} left`} variant={variant} />
}

// Derives variant from a risk level string
export function RiskPill({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' | null | undefined }) {
  if (!level) return <MetricPill label="—" variant="slate" />
  const variants: Record<string, Variant> = { HIGH: 'red', MEDIUM: 'amber', LOW: 'green' }
  return <MetricPill label={level} variant={variants[level] ?? 'slate'} />
}
