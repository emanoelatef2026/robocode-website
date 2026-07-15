import Link from 'next/link'
import StatusBadge from '@/components/admin/StatusBadge'
import { EVALUATION_CRITERION_LABELS } from '@/modules/student-evaluations/types'
import type { ChildOverviewCard as ChildOverviewData, UpcomingClass } from '@/modules/parents/parent-portal-queries'

function fmtMoney(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

const DAY_LABELS: Record<string, string> = {
  sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
}

function formatClassTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour   = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`
}

function StatChip({ icon, value, label, tone, href }: {
  icon: string; value: string | number; label: string; tone?: 'warn'; href?: string
}) {
  const cls = [
    'flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 transition',
    href ? 'hover:bg-white/20' : '',
  ].join(' ')
  const content = (
    <>
      <span className="text-[14px]">{icon}</span>
      <span className={`text-[12px] font-bold ${tone === 'warn' ? 'text-[#FCD34D]' : 'text-white'}`}>{value}</span>
      <span className="text-[10px] text-white/50">{label}</span>
    </>
  )
  if (href) return <Link href={href} className={cls}>{content}</Link>
  return <div className={cls}>{content}</div>
}

interface Props {
  overview:      ChildOverviewData
  assignmentPct: number | null
  upcomingClass: UpcomingClass | null
  nextDueDate:   string | null
  childHref:     (path: string) => string
}

export default function ParentHero({ overview, assignmentPct, upcomingClass, nextDueDate, childHref }: Props) {
  const initials = overview.student_name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?'
  const hasBalance = overview.outstanding_balance != null && overview.outstanding_balance > 0
  const overdue    = hasBalance && !!nextDueDate && new Date(nextDueDate) < new Date()

  const nextClassLabel = (() => {
    if (upcomingClass?.next_session_at) {
      const d = new Date(upcomingClass.next_session_at)
      return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}${upcomingClass.time ? ` · ${formatClassTime(upcomingClass.time)}` : ''}`
    }
    if (upcomingClass?.day_of_week) {
      return `${DAY_LABELS[upcomingClass.day_of_week.toLowerCase()] ?? upcomingClass.day_of_week}${upcomingClass.time ? ` · ${formatClassTime(upcomingClass.time)}` : ''}`
    }
    return null
  })()

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #16304F 60%, #1E3A5F 100%)' }}>
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#FF8A1F]/10" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-[#FFD166]/5" />

      <div className="relative p-5">
        {/* Identity + next class — the ONE place student identity is shown */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {overview.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={overview.avatar_url} alt={overview.student_name} className="h-12 w-12 shrink-0 rounded-full object-cover" />
            ) : (
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #FF8A1F, #0B1F3A)' }}
              >
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-[20px] font-extrabold leading-tight text-white">{overview.student_name}</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-white/45">
                {overview.branch_name && <span>{overview.branch_name}</span>}
                <StatusBadge status={overview.status} dot />
              </div>
            </div>
          </div>

          <div className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-right">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-white/40">Next Class</p>
            <p className="mt-0.5 text-[13px] font-bold text-white">{nextClassLabel ?? 'Not scheduled'}</p>
          </div>
        </div>

        {/* Stat chips — everything measurable, at a glance */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatChip icon="📚" value={overview.active_courses} label={overview.active_courses === 1 ? 'course' : 'courses'} />
          <StatChip
            icon="✅"
            value={overview.attendance_pct != null ? `${overview.attendance_pct}%` : '—'}
            label="attendance"
            tone={overview.attendance_pct != null && overview.attendance_pct < 60 ? 'warn' : undefined}
            href={childHref('/portal/parent/attendance')}
          />
          {assignmentPct != null && (
            <StatChip icon="📝" value={`${Math.round(assignmentPct)}%`} label="assignments" href={childHref('/portal/parent/assignments')} />
          )}
          <StatChip icon="📜" value={overview.certificates_count} label={overview.certificates_count === 1 ? 'certificate' : 'certificates'} href={childHref('/portal/parent/certificates')} />
          {overview.competitions_count > 0 && (
            <StatChip icon="🎖️" value={overview.competitions_count} label={overview.competitions_count === 1 ? 'competition' : 'competitions'} href={childHref('/portal/parent/competitions')} />
          )}
          {overview.outstanding_balance != null && (
            <StatChip
              icon="💰"
              value={hasBalance ? `EGP ${fmtMoney(overview.outstanding_balance)}` : 'Paid ✓'}
              label={overdue ? 'overdue' : 'balance'}
              tone={overdue ? 'warn' : undefined}
              href={childHref('/portal/parent/finance')}
            />
          )}
        </div>

        {/* Latest highlights — the ONE place these appear */}
        {(overview.latest_evaluation || overview.latest_achievement) && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-white/10 pt-3 text-[12px] text-white/70">
            {overview.latest_evaluation && (
              <p>
                <span className="font-semibold text-white/90">Latest evaluation:</span>{' '}
                {EVALUATION_CRITERION_LABELS[overview.latest_evaluation.criterion as keyof typeof EVALUATION_CRITERION_LABELS] ?? overview.latest_evaluation.criterion}
                {overview.latest_evaluation.rating != null && ` · ${overview.latest_evaluation.rating}★`}
              </p>
            )}
            {overview.latest_achievement && (
              <p>
                <span className="font-semibold text-white/90">Latest achievement:</span> {overview.latest_achievement.title}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
