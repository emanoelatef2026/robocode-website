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
    healthy: 'bg-[#E7F8EE] text-[#15803D]',
    warning: 'bg-[#FFFBEB] text-[#B45309]',
    danger:  'bg-[#FEE2E2] text-[#DC2626]',
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
  const color = colorClass ?? (pct >= 75 ? 'bg-[#10B981]' : pct >= 50 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]')
  return (
    <div className="h-1.5 w-full rounded-full bg-[#F1F5F9]">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function getRiskStyle(score: number) {
  if (score >= 60) return { cls: 'bg-[#FEE2E2] text-[#DC2626]',    text: 'Critical' }
  if (score >= 35) return { cls: 'bg-[#FFFBEB] text-[#B45309]', text: 'Medium'  }
  return              { cls: 'bg-[#E7F8EE] text-[#15803D]', text: 'Low'     }
}

function getDotColor(score: number) {
  if (score >= 60) return 'bg-[#EF4444]'
  if (score >= 35) return 'bg-[#F59E0B]'
  return 'bg-[#10B981]'
}

function getRiskLabel(score: number) {
  if (score >= 60) return 'Critical'
  if (score >= 35) return 'Medium Risk'
  return 'Low Risk'
}

export function InstructorScoreBadge({ score }: { score: number }) {
  const cls = score >= 75 ? 'bg-[#E7F8EE] text-[#15803D]'
            : score >= 55 ? 'bg-[#FFFBEB] text-[#B45309]'
            :               'bg-[#FEE2E2] text-[#DC2626]'
  return (
    <span className={`rounded-lg px-2.5 py-1 text-[12px] font-bold tabular-nums ${cls}`}>
      {score}
    </span>
  )
}
