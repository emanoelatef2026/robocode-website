import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getInstructorByUserId,
  listSessionHistory,
  listInstructorGroups,
} from '@/modules/instructor-portal/queries'
import Link from 'next/link'
import HistoryFilterPanel from './_components/HistoryFilterPanel'

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  ongoing:   'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default async function SessionHistoryPage({ searchParams }: Props) {
  const user       = await requirePortalRole('instructor')
  const instructor = await getInstructorByUserId(user.id)

  if (!instructor) {
    return (
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No instructor record found. Contact your team leader.
      </div>
    )
  }

  const sp      = await searchParams
  const from    = sp.from    ?? undefined
  const to      = sp.to      ?? undefined
  const groupId = sp.groupId ?? undefined
  const topic   = sp.topic   ?? undefined
  const status  = sp.status  ?? undefined

  const [groups, sessions] = await Promise.all([
    listInstructorGroups(instructor.id),
    listSessionHistory(instructor.id, { from, to, groupId, topic, status }),
  ])

  const activeGroups = groups.filter((g) => !!g.course_title)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A]">Session History</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">All sessions across your groups</p>
      </div>

      {/* Filters — collapsible on mobile, always open on sm+ */}
      <HistoryFilterPanel
        groups={activeGroups}
        from={from}
        to={to}
        groupId={groupId}
        topic={topic}
        status={status}
      />

      {/* Results */}
      {sessions.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] text-sm text-[#64748B]">
          No sessions found.
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="border-b border-[#E2E8F0] px-5 py-3">
            <p className="text-sm font-semibold text-[#0B1F3A]">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Desktop table header */}
          <div className="hidden grid-cols-[120px_1fr_1fr_100px_1fr_140px_90px] gap-4 border-b border-[#F1F5F9] px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8] lg:grid">
            <span>Date</span>
            <span>Group</span>
            <span>Course</span>
            <span>Session #</span>
            <span>Topic</span>
            <span>Attendance</span>
            <span>Status</span>
          </div>

          <div className="divide-y divide-[#F1F5F9]">
            {sessions.map((s) => {
              const dateStr = new Date(s.scheduled_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })
              const attendanceStr = s.total_students > 0
                ? `${s.present_count}P · ${s.absent_count}A${s.late_count > 0 ? ` · ${s.late_count}L` : ''} / ${s.total_students}`
                : null

              return (
                <Link
                  key={s.session_id}
                  href={`/portal/instructor/history/${s.session_id}`}
                  className="block px-5 py-3.5 transition hover:bg-[#F8FAFC] lg:grid lg:grid-cols-[120px_1fr_1fr_100px_1fr_140px_90px] lg:items-center lg:gap-4"
                >
                  {/* Mobile card layout */}
                  <div className="flex items-start justify-between gap-3 lg:contents">
                    {/* Left column */}
                    <div className="flex flex-col gap-1 min-w-0 lg:contents">
                      <span className="text-xs text-[#64748B] lg:block">{dateStr}</span>
                      <span className="font-medium text-[#0B1F3A] text-sm truncate lg:block">{s.group_name}</span>
                      <span className="text-xs text-[#64748B] truncate lg:block">{s.course_title || '—'}</span>
                      <span className="text-xs font-semibold text-[#0B1F3A] lg:block">
                        Session {s.session_num} / {s.total_in_group}
                      </span>
                      {s.topic && (
                        <span className="text-xs text-[#64748B] truncate lg:block">{s.topic}</span>
                      )}
                      {!s.topic && (
                        <span className="text-xs italic text-[#94A3B8] lg:block">No topic</span>
                      )}
                      {attendanceStr && (
                        <span className="text-xs text-[#64748B] lg:block">
                          <span className="text-green-600">{s.present_count}P</span>
                          {' · '}
                          <span className="text-red-500">{s.absent_count}A</span>
                          {s.late_count > 0 && (
                            <>{' · '}<span className="text-yellow-600">{s.late_count}L</span></>
                          )}
                          {' / '}{s.total_students}
                        </span>
                      )}
                      {!attendanceStr && <span className="text-xs text-[#64748B] lg:block">—</span>}
                    </div>

                    {/* Status badge — right-aligned on mobile, inline on desktop */}
                    <span className={`shrink-0 self-start rounded-full px-2 py-0.5 text-[11px] font-medium lg:w-fit ${STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {s.status}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
