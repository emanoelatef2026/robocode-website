import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getInstructorByUserId,
  listInstructorGroups,
  listPendingSubmissions,
  getTodayActions,
  getStudentsRequiringAttention,
  getInstructorDashboardStats,
} from '@/modules/instructor-portal/queries'
import Link from 'next/link'

const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold text-[#0B1F3A]">{children}</h2>
}

export default async function InstructorDashboardPage() {
  const user = await requirePortalRole('instructor')

  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) {
    return (
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No instructor record found for your account. Contact your team leader.
      </div>
    )
  }

  const name = [instructor.first_name, instructor.last_name].filter(Boolean).join(' ') || instructor.email

  let groups:    Awaited<ReturnType<typeof listInstructorGroups>>     = []
  let todayActs: Awaited<ReturnType<typeof getTodayActions>>          = []
  let pending:   Awaited<ReturnType<typeof listPendingSubmissions>>   = []
  let attention: Awaited<ReturnType<typeof getStudentsRequiringAttention>> = []
  let stats:     Awaited<ReturnType<typeof getInstructorDashboardStats>>   = {
    groupCount: 0, studentCount: 0, completedSessions: 0, pendingReviews: 0,
  }

  await Promise.allSettled([
    listInstructorGroups(instructor.id).then((r)      => { groups    = r }),
    getTodayActions(instructor.id).then((r)            => { todayActs = r }),
    listPendingSubmissions(instructor.id, 999).then((r) => { pending  = r }),
    getStudentsRequiringAttention(instructor.id).then((r) => { attention = r }),
    getInstructorDashboardStats(instructor.id).then((r) => { stats   = r }),
  ])

  const activeGroups = groups.filter((g) => !!g.course_title)

  // Today's groups: groups whose day_of_week matches today
  const todayDayNum = new Date().getDay()
  const todayGroups = activeGroups.filter((g) => {
    if (!g.next_session_at) return false
    const next = new Date(g.next_session_at)
    // Check if the next occurrence is today
    const now = new Date()
    return (
      next.getFullYear() === now.getFullYear() &&
      next.getMonth()    === now.getMonth()    &&
      next.getDate()     === now.getDate()
    )
  })

  const totalCompleted = groups.reduce((sum, g) => sum + g.completed_sessions, 0)

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A]">Good morning, {name}</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'My Groups',          value: stats.groupCount },
          { label: 'My Students',        value: stats.studentCount },
          { label: 'Pending Homework',   value: pending.length },
          { label: 'Sessions Completed', value: totalCompleted },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-4 text-center">
            <p className="text-2xl font-bold text-[#0B1F3A]">{value}</p>
            <p className="mt-0.5 text-xs text-[#64748B]">{label}</p>
          </div>
        ))}
      </div>

      {/* Today's Actions */}
      {todayActs.length > 0 && (
        <section>
          <SectionHeading>Today</SectionHeading>
          <div className="space-y-2">
            {todayActs.map((act, i) => (
              <Link
                key={i}
                href={act.href}
                className="flex items-center gap-4 rounded-xl border border-[#E2E8F0] bg-white px-5 py-3.5 transition hover:border-[#FF8A1F] hover:shadow-sm"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
                  act.type === 'start_session'       ? 'bg-emerald-100 text-emerald-700' :
                  act.type === 'complete_attendance' ? 'bg-amber-100 text-amber-700' :
                  act.type === 'review_homework'     ? 'bg-blue-100 text-blue-700' :
                  'bg-[#F1F5F9] text-[#64748B]'
                }`}>
                  {act.type === 'start_session' ? '▶' : act.type === 'review_homework' ? '📋' : '✓'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#0B1F3A]">{act.label}</p>
                  {act.detail && <p className="text-xs text-[#64748B]">{act.detail}</p>}
                </div>
                <span className="shrink-0 text-xs text-[#FF8A1F]">→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Today's Groups */}
      {todayGroups.length > 0 && (
        <section>
          <SectionHeading>Today's Groups</SectionHeading>
          <div className="rounded-xl border border-[#E2E8F0] bg-white divide-y divide-[#F1F5F9]">
            {todayGroups.map((g) => (
              <Link
                key={g.group_id}
                href={`/portal/instructor/groups/${g.group_id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#F8FAFC] transition"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#0B1F3A]">{g.group_name}</p>
                  <p className="text-xs text-[#64748B]">{g.course_title}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#64748B]">{g.student_count} students</p>
                  {g.next_session_at && (
                    <p className="text-xs text-[#FF8A1F]">
                      {new Date(g.next_session_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-[#94A3B8]">→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* My Active Groups */}
      {activeGroups.length > 0 && (
        <section>
          <SectionHeading>My Active Groups</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            {activeGroups.map((g) => {
              const sessionPct = g.total_sessions > 0
                ? Math.round((g.completed_sessions / g.total_sessions) * 100)
                : null

              return (
                <Link
                  key={g.group_id}
                  href={`/portal/instructor/groups/${g.group_id}`}
                  className="rounded-xl border border-[#E2E8F0] bg-white p-5 transition hover:border-[#CBD5E1] hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-[#0B1F3A]">{g.group_name}</p>
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                      Active
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-[#64748B]">{g.course_title}</p>

                  {g.total_sessions > 0 ? (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-[#64748B]">
                        <span>Session {g.completed_sessions} / {g.total_sessions}</span>
                        {sessionPct !== null && <span>{sessionPct}%</span>}
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                        <div
                          className="h-full rounded-full bg-[#FF8A1F]"
                          style={{ width: `${sessionPct ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-[#94A3B8]">No sessions yet</p>
                  )}

                  <div className="mt-2 flex items-center justify-between text-xs text-[#94A3B8]">
                    <span>{g.student_count} student{g.student_count !== 1 ? 's' : ''}</span>
                    {g.next_session_at ? (
                      <span>Next: {new Date(g.next_session_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                    ) : (
                      <span>Schedule day not set</span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Pending Homework Reviews */}
      {pending.length > 0 && (
        <section>
          <div className="flex items-center justify-between">
            <SectionHeading>Pending Reviews</SectionHeading>
            <Link href="/portal/instructor/homework" className="text-xs text-[#FF8A1F] hover:underline">
              View all →
            </Link>
          </div>
          <div className="rounded-xl border border-[#E2E8F0] bg-white divide-y divide-[#F1F5F9]">
            {pending.slice(0, 5).map((s) => (
              <Link
                key={s.submission_id}
                href={`/portal/instructor/homework/${s.submission_id}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-[#F8FAFC] transition"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#0B1F3A]">{s.student_name}</p>
                  <p className="truncate text-xs text-[#64748B]">{s.assignment_title}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    {s.status}
                  </span>
                  {s.is_late && (
                    <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600">late</span>
                  )}
                </div>
              </Link>
            ))}
            {pending.length > 5 && (
              <div className="px-5 py-2.5 text-xs text-[#94A3B8]">
                +{pending.length - 5} more
              </div>
            )}
          </div>
        </section>
      )}

      {/* Students Requiring Attention */}
      {attention.length > 0 && (
        <section>
          <SectionHeading>Students Requiring Attention</SectionHeading>
          <div className="rounded-xl border border-[#E2E8F0] bg-white divide-y divide-[#F1F5F9]">
            {attention.map((s) => (
              <Link
                key={`${s.student_id}:${s.group_id}`}
                href={s.href}
                className="flex items-center gap-4 px-5 py-3 hover:bg-[#F8FAFC] transition"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-600">
                  {s.absence_count}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#0B1F3A]">{s.student_name}</p>
                  <p className="truncate text-xs text-[#64748B]">{s.group_name} · {s.reason}</p>
                </div>
                <span className="shrink-0 text-xs text-[#94A3B8]">→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {groups.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#E2E8F0] px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#0B1F3A]">No groups assigned yet.</p>
          <p className="mt-1 text-sm text-[#94A3B8]">Contact your Team Leader to receive assignments.</p>
        </div>
      )}
    </div>
  )
}
