import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId, listInstructorGroups } from '@/modules/instructor-portal/queries'
import Link from 'next/link'

export default async function InstructorGroupsPage() {
  const user       = await requirePortalRole('instructor')
  const instructor = await getInstructorByUserId(user.id)

  if (!instructor) {
    return (
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No instructor record found. Contact your team leader.
      </div>
    )
  }

  const groups = await listInstructorGroups(instructor.id)

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-[18px] md:text-xl font-bold text-[#0B1F3A]">My Groups</h1>
        <p className="mt-0.5 text-[12px] md:text-sm text-[#64748B]">Groups assigned to you</p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E2E8F0] px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#0B1F3A]">No groups assigned yet.</p>
          <p className="mt-1 text-sm text-[#94A3B8]">Contact your Team Leader to receive group assignments.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 md:gap-4">
          {groups.map((g) => {
            const isActive = !!g.course_title

            return (
              <Link
                key={g.group_id}
                href={`/portal/instructor/groups/${g.group_id}`}
                className="rounded-xl border border-[#E2E8F0] bg-white p-4 md:p-5 transition hover:border-[#CBD5E1] hover:shadow-sm active:bg-[#F8FAFC]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#0B1F3A]">{g.group_name}</p>
                    {g.group_code && (
                      <p className="mt-0.5 text-xs text-[#94A3B8]">{g.group_code}</p>
                    )}
                  </div>
                  {isActive ? (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      Active
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Forming
                    </span>
                  )}
                </div>

                <p className="mt-1.5 truncate text-sm text-[#64748B]">
                  {g.course_title || <span className="italic text-[#94A3B8]">No course assigned</span>}
                </p>
                {g.branch_name && (
                  <p className="mt-0.5 truncate text-xs text-[#94A3B8]">{g.branch_name}</p>
                )}

                {!isActive && (
                  <div className="mt-2.5">
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 border border-amber-200">
                      No course assigned
                    </span>
                  </div>
                )}

                {/* Session progress */}
                {isActive && g.total_sessions != null && g.total_sessions > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                      <span>Session {g.completed_sessions} / {g.total_sessions}</span>
                      <span>{Math.round((g.completed_sessions / g.total_sessions) * 100)}%</span>
                    </div>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                      <div
                        className="h-full rounded-full bg-[#FF8A1F]"
                        style={{ width: `${(g.completed_sessions / g.total_sessions) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-2 flex items-center gap-4 text-xs text-[#94A3B8]">
                  <span>{g.student_count} student{g.student_count !== 1 ? 's' : ''}</span>
                  {isActive && g.next_session_at && (
                    <span>
                      Next:{' '}
                      {new Date(g.next_session_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short',
                      })}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
