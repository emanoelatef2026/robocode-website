import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getInstructorByUserId,
  listInstructorGroups,
  listPendingSubmissions,
  getTodayActions,
  getStudentsRequiringAttention,
} from '@/modules/instructor-portal/queries'
import Link from 'next/link'

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

  // Load all operational data in parallel; graceful degradation per section
  let groups:    Awaited<ReturnType<typeof listInstructorGroups>>     = []
  let todayActs: Awaited<ReturnType<typeof getTodayActions>>          = []
  let pending:   Awaited<ReturnType<typeof listPendingSubmissions>>   = []
  let attention: Awaited<ReturnType<typeof getStudentsRequiringAttention>> = []

  await Promise.allSettled([
    listInstructorGroups(instructor.id).then((r)     => { groups    = r }),
    getTodayActions(instructor.id).then((r)           => { todayActs = r }),
    listPendingSubmissions(instructor.id, 999).then((r) => { pending  = r }),
    getStudentsRequiringAttention(instructor.id).then((r) => { attention = r }),
  ])

  const activeGroups  = groups.filter((g) => g.course_title && g.course_module_title && g.semester_id)
  const formingGroups = groups.filter((g) => !g.course_title || !g.course_module_title || !g.semester_id)

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A]">Good morning, {name}</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
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
                  act.type === 'start_session'      ? 'bg-emerald-100 text-emerald-700' :
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

      {/* Active Groups — operational view */}
      {activeGroups.length > 0 && (
        <section>
          <SectionHeading>My Groups</SectionHeading>
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

                  {/* Course + Semester */}
                  <p className="mt-1 text-xs text-[#64748B]">{g.course_title}</p>
                  {g.course_module_title && (
                    <p className="mt-0.5 text-xs font-medium text-[#FF8A1F]">{g.course_module_title}</p>
                  )}

                  {/* Session progress */}
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
                      <Link
                        href={`/portal/instructor/groups/${g.group_id}/sessions/new`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[#FF8A1F] hover:underline"
                      >
                        Schedule session →
                      </Link>
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

      {/* Forming groups — setup still needed */}
      {formingGroups.length > 0 && (
        <section>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">
              {formingGroups.length} group{formingGroups.length !== 1 ? 's' : ''} need setup
            </p>
            <ul className="mt-2 space-y-1">
              {formingGroups.map((g) => {
                const missing: string[] = []
                if (!g.course_title)        missing.push('no course')
                if (!g.course_module_title) missing.push('no semester')
                if (!g.semester_id)         missing.push('no academic period')
                return (
                  <li key={g.group_id} className="text-xs text-amber-700">
                    <span className="font-medium">{g.group_name}</span>
                    {' '}— {missing.join(', ')}
                  </li>
                )
              })}
            </ul>
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
