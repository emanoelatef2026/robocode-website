interface RiskBadgeProps {
  score: number
  label?: string
  size?: 'sm' | 'md'
}

export default function RiskBadge({ score, label, size = 'sm' }: RiskBadgeProps) {
  const { cls, text } = getRiskStyle(score)
  const sizeClass = size === 'md' ? 'px-2.5 py-1 text-[11px]' : 'px-2 py-0.5 text-[10px]'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${cls} ${sizeClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${getDotColor(score)}`} />
      {label ?? getRiskLabel(score)}
    </span>
  )
}

export function HealthBadge({ status }: { status: 'healthy' | 'warning' | 'danger' }) {
  const map = {
    healthy: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger:  'bg-red-100 text-red-700',
  }
  const labels = { healthy: 'Healthy', warning: 'Warning', danger: 'At Risk' }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status]}`}>
      {labels[status]}
    </span>
  )
}

export function ScoreBar({ value, max = 100, colorClass }: { value: number; max?: number; colorClass?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const color = colorClass ?? (pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500')
  return (
    <div className="h-1.5 w-full rounded-full bg-[#F1F5F9]">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function getRiskStyle(score: number) {
  if (score >= 60) return { cls: 'bg-red-100 text-red-700',    text: 'Critical' }
  if (score >= 35) return { cls: 'bg-amber-100 text-amber-700', text: 'Medium'  }
  return              { cls: 'bg-emerald-100 text-emerald-700', text: 'Low'     }
}

function getDotColor(score: number) {
  if (score >= 60) return 'bg-red-500'
  if (score >= 35) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function getRiskLabel(score: number) {
  if (score >= 60) return 'Critical'
  if (score >= 35) return 'Medium Risk'
  return 'Low Risk'
}

export function InstructorScoreBadge({ score }: { score: number }) {
  const cls = score >= 75 ? 'bg-emerald-100 text-emerald-700'
            : score >= 55 ? 'bg-amber-100 text-amber-700'
            :               'bg-red-100 text-red-700'
  return (
    <span className={`rounded-lg px-2.5 py-1 text-[12px] font-bold tabular-nums ${cls}`}>
      {score}
    </span>
  )
}
