import Link from 'next/link'
import StatusBadge from '@/components/admin/StatusBadge'

export interface InstructorGroupCardData {
  group_id:            string
  group_name:          string
  group_code?:         string | null
  course_title?:       string | null
  branch_name?:        string | null
  student_count:       number
  completed_sessions:  number
  total_sessions?:     number | null
  allocated_sessions?: number | null
  from_session:        number
  next_session_at?:    string | null
}

export default function InstructorGroupCard({ g }: { g: InstructorGroupCardData }) {
  const isActive   = !!g.course_title
  const myTotal    = g.allocated_sessions ?? g.total_sessions
  const sessionPct = myTotal != null && myTotal > 0
    ? Math.min(100, Math.round((g.completed_sessions / myTotal) * 100))
    : null
  const toSess   = g.allocated_sessions != null
    ? g.from_session + g.allocated_sessions - 1
    : null
  const nextSess = g.from_session + g.completed_sessions

  return (
    <Link
      href={`/portal/instructor/groups/${g.group_id}`}
      className="ds-card group flex gap-4 p-4 md:p-5 transition-all duration-150 hover:border-[#CBD5E1] hover:shadow-[0_4px_16px_rgba(11,31,58,.10)] active:bg-[#F8FAFC]"
    >
      {/* Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF]">
        <svg viewBox="0 0 20 20" fill="#6366F1" className="h-5 w-5">
          <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
        </svg>
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">

        {/* Header row: name + badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-[#0B1F3A] transition-colors group-hover:text-[#6366F1]">
              {g.group_name}
            </p>
            {g.group_code && (
              <p className="text-[10px] text-[#94A3B8]">{g.group_code}</p>
            )}
          </div>
          <StatusBadge status={isActive ? 'active' : 'forming'} />
        </div>

        {/* Course + branch */}
        <p className="mt-0.5 truncate text-xs text-[#64748B]">
          {g.course_title ?? <span className="italic text-[#94A3B8]">No course assigned</span>}
        </p>
        {g.branch_name && (
          <p className="mt-0.5 truncate text-[10px] text-[#94A3B8]">{g.branch_name}</p>
        )}

        {/* Session progress */}
        {isActive && myTotal != null && myTotal > 0 ? (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-[#64748B]">
              <span>Session {g.completed_sessions} / {myTotal}</span>
              {sessionPct !== null && (
                <span className="font-semibold">{sessionPct}%</span>
              )}
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
              <div
                className="h-full rounded-full bg-[#FF8A1F] transition-[width] duration-300"
                style={{ width: `${sessionPct ?? 0}%` }}
              />
            </div>
            {g.allocated_sessions != null ? (
              <div className="mt-1 flex items-center justify-between text-[10px] text-[#94A3B8]">
                <span>Allocation: sessions {g.from_session}–{toSess}</span>
                <span>Next: #{nextSess}</span>
              </div>
            ) : (
              <p className="mt-0.5 text-[10px] text-[#94A3B8]">
                Group: session {g.from_session} of {g.total_sessions ?? '∞'}
              </p>
            )}
          </div>
        ) : isActive ? (
          <p className="mt-2 text-xs text-[#94A3B8]">No sessions yet</p>
        ) : null}

        {/* Footer meta */}
        <div className="mt-3 flex items-center justify-between text-[10px] text-[#94A3B8]">
          <span>{g.student_count} student{g.student_count !== 1 ? 's' : ''}</span>
          {g.next_session_at ? (
            <span className="font-medium text-[#64748B]">
              Next: {new Date(g.next_session_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          ) : isActive ? (
            <span>Schedule not set</span>
          ) : null}
        </div>

      </div>
    </Link>
  )
}
