import 'server-only'
import Link from 'next/link'
import { getTrialConversionAnalytics } from '@/modules/special-sessions/queries'

interface Props {
  branchIds: string[]
}

export default async function TrialConversionWidget({ branchIds }: Props) {
  const stats = await getTrialConversionAnalytics(branchIds)

  const tiles = [
    {
      label: 'Trials This Month',
      value: String(stats.trials_this_month),
      sub:   null,
      alert: false,
    },
    {
      label: 'Attended',
      value: String(stats.attended_trials),
      sub:   stats.trials_this_month > 0
        ? `${Math.round((stats.attended_trials / stats.trials_this_month) * 100)}% show-up`
        : null,
      alert: false,
    },
    {
      label: 'Converted',
      value: String(stats.converted_students),
      sub:   null,
      alert: false,
    },
    {
      label: 'Conversion Rate',
      value: `${stats.conversion_rate}%`,
      sub:   null,
      alert: stats.conversion_rate < 30 && stats.attended_trials > 0,
    },
    {
      label: 'Top Trial Instructor',
      value: stats.top_trial_instructor ?? '—',
      sub:   null,
      alert: false,
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
          This Month
        </p>
        <Link
          href="/portal/team-leader/special-sessions"
          className="text-[11px] font-semibold text-[#FF8A1F] hover:underline"
        >
          View All →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(t => (
          <div
            key={t.label}
            className={`min-w-0 rounded-xl border bg-white px-2 py-2.5 md:px-3 md:py-3 ${
              t.alert ? 'border-[#FECACA]' : 'border-[#E2E8F0]'
            }`}
          >
            <p className={`truncate text-[15px] font-extrabold leading-none md:text-[18px] ${
              t.alert ? 'text-[#EF4444]' : 'text-[#0B1F3A]'
            }`}>
              {t.value}
            </p>
            <p className="mt-0.5 truncate text-[8px] font-medium leading-tight text-[#64748B] md:text-[10px]">
              {t.label}
            </p>
            {t.sub && (
              <p className="mt-0.5 truncate text-[8px] text-[#94A3B8]">{t.sub}</p>
            )}
          </div>
        ))}
      </div>

      {stats.trials_this_month === 0 && (
        <p className="text-[12px] text-[#94A3B8]">
          No trial sessions this month.{' '}
          <Link href="/portal/team-leader/special-sessions/new?type=trial" className="text-[#A855F7] hover:underline font-medium">
            Create one →
          </Link>
        </p>
      )}
    </div>
  )
}
