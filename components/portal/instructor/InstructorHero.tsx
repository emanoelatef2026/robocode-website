import Link from 'next/link'

interface QuickStartSession {
  status:       string
  session_type: string
  group_id:     string
  group_name:   string
  course_title: string | null
  id:           string
}

interface Props {
  name:                 string
  branchName:           string | null
  todaySessionCount:    number
  pendingReviewsCount:  number
  thisMonthEarnings:    string
  ratingAvg:            number | null
  ratingCount:          number | null
  quickStart:           QuickStartSession | null
}

function StatChip({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-[5px]">
      <span className="text-[14px]">{icon}</span>
      <span className="text-[11px] font-bold text-white">{value}</span>
      <span className="text-[9px] text-white/50">{label}</span>
    </div>
  )
}

export default function InstructorHero({
  name, branchName, todaySessionCount, pendingReviewsCount, thisMonthEarnings,
  ratingAvg, ratingCount, quickStart,
}: Props) {
  const firstName = name.split(' ')[0] || 'Instructor'
  const initials   = name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || 'I'
  const greeting   = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #16304F 60%, #1E3A5F 100%)' }}>
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#FF8A1F]/10" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-[#FFD166]/5" />

      <div className="relative px-4 pb-4 pt-4">
        {/* Identity row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #FF8A1F, #0B1F3A)' }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[18px] font-extrabold leading-tight text-white">
                {greeting}, {firstName}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] text-white/45">
                {branchName && <span>{branchName}</span>}
                <span>
                  {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
            </div>
          </div>
          {ratingAvg != null && (
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">
              <span className="text-[13px]">⭐</span>
              <span className="text-[13px] font-bold text-white">{ratingAvg.toFixed(1)}</span>
              {ratingCount != null && <span className="text-[9px] text-white/50">({ratingCount})</span>}
            </div>
          )}
        </div>

        {/* Stat chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatChip icon="📅" value={todaySessionCount} label={todaySessionCount === 1 ? 'session today' : 'sessions today'} />
          {pendingReviewsCount > 0 && (
            <StatChip icon="📝" value={pendingReviewsCount} label="to review" />
          )}
          <StatChip icon="💰" value={thisMonthEarnings} label="this month" />
        </div>

        {/* Quick-start CTA — the single most prominent action on the page */}
        {quickStart && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/10 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-white">
                {quickStart.status === 'ongoing' ? 'Session in progress' : 'Next class ready'}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-white/60">
                {quickStart.group_name}{quickStart.course_title ? ` — ${quickStart.course_title}` : ''}
              </p>
            </div>
            <Link
              href={
                quickStart.session_type === 'primary'
                  ? `/portal/instructor/groups/${quickStart.group_id}/sessions/${quickStart.id}`
                  : `/portal/instructor/special-sessions/${quickStart.id}`
              }
              className="shrink-0 rounded-lg bg-[#10B981] px-4 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-emerald-600"
            >
              {quickStart.status === 'ongoing' ? 'Continue Session' : 'Start Session'}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
