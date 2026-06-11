import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId, getGroupForInstructor, getGroupAttendanceAnalytics } from '@/modules/instructor-portal/queries'
import { getCourse } from '@/modules/courses/queries'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import StartGroupSessionButton from './StartGroupSessionButton'
import InstructorCoursePanel from './InstructorCoursePanel'

interface Props { params: Promise<{ id: string }> }

const STATUS_COLORS: Record<string, string> = {
  scheduled:   'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  ongoing:     'bg-yellow-100 text-yellow-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-700',
}

const DAY_LABELS: Record<string, string> = {
  sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
}

export default async function GroupDetailPage({ params }: Props) {
  const user       = await requirePortalRole('instructor')
  const { id }     = await params
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) notFound()

  const group = await getGroupForInstructor(id, instructor.id)
  if (!group) notFound()

  const [analytics, course] = await Promise.all([
    getGroupAttendanceAnalytics(id, instructor.id),
    group.course_id ? getCourse(group.course_id) : Promise.resolve(null),
  ])

  const hasCourse = !!group.group_course_id
  const isActive  = hasCourse

  const totalPct = group.total_sessions > 0
    ? Math.round((group.completed_sessions / group.total_sessions) * 100)
    : null

  const scheduleLabel = group.day_of_week
    ? [DAY_LABELS[group.day_of_week.toLowerCase()] ?? group.day_of_week, group.time].filter(Boolean).join(' · ')
    : null

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/portal/instructor/groups" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
            ← My Groups
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0B1F3A]">{group.group_name}</h1>
            {isActive ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Active</span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Forming</span>
            )}
          </div>
          {group.course_title && (
            <p className="mt-0.5 text-sm text-[#64748B]">{group.course_title}</p>
          )}
        </div>
        {isActive && (
          <StartGroupSessionButton
            groupId={id}
            groupCourseId={group.group_course_id}
            branchId={group.branch_id}
          />
        )}
      </div>

      {/* Forming — no course assigned banner */}
      {!isActive && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">No course assigned yet</p>
          <p className="mt-0.5 text-xs text-amber-700">
            Sessions can be started once a course is assigned. Contact your administrator.
          </p>
        </div>
      )}

      {/* Group meta */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white px-5 py-4">
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          {group.branch_name && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">Branch</p>
              <p className="mt-0.5 font-medium text-[#0B1F3A]">{group.branch_name}</p>
            </div>
          )}
          {scheduleLabel && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">Schedule</p>
              <p className="mt-0.5 font-medium text-[#0B1F3A]">{scheduleLabel}</p>
            </div>
          )}
          {group.course_title && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">Course</p>
              <p className="mt-0.5 font-medium text-[#0B1F3A]">{group.course_title}</p>
            </div>
          )}
          {group.total_sessions > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">Total Sessions</p>
              <p className="mt-0.5 font-medium text-[#0B1F3A]">{group.total_sessions}</p>
            </div>
          )}
        </div>
      </div>

      {/* Course Content Panel — read-only, collapsible */}
      {isActive && course && (
        <InstructorCoursePanel course={course} />
      )}

      {/* Session progress */}
      {isActive && group.total_sessions > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#0B1F3A]">Progress</p>
            <p className="text-sm text-[#64748B]">
              Session {group.completed_sessions} / {group.total_sessions}
            </p>
          </div>
          {totalPct !== null && (
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
              <div
                className="h-full rounded-full bg-[#FF8A1F] transition-all"
                style={{ width: `${totalPct}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Attendance Analytics */}
      {analytics.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[#0B1F3A]">Attendance Analytics</h2>
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="hidden grid-cols-[1fr_80px_80px_80px_80px_70px] gap-4 border-b border-[#F1F5F9] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8] sm:grid">
              <span>Student</span>
              <span className="text-center">Present</span>
              <span className="text-center">Absent</span>
              <span className="text-center">Late</span>
              <span className="text-center">Total</span>
              <span className="text-center">Rate</span>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              {analytics.map((row) => (
                <Link
                  key={row.student_id}
                  href={`/portal/instructor/groups/${id}/students/${row.student_id}`}
                  className="flex flex-col gap-1 px-5 py-3 transition hover:bg-[#F8FAFC] sm:grid sm:grid-cols-[1fr_80px_80px_80px_80px_70px] sm:items-center sm:gap-4"
                >
                  <div className="flex items-center gap-2">
                    {row.attention && (
                      <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                        ⚠ {row.absent} absent
                      </span>
                    )}
                    <span className="text-sm font-medium text-[#0B1F3A] truncate">{row.student_name}</span>
                  </div>
                  <span className="text-center text-sm text-green-600 font-medium">{row.present}</span>
                  <span className="text-center text-sm text-red-500 font-medium">{row.absent}</span>
                  <span className="text-center text-sm text-yellow-600 font-medium">{row.late}</span>
                  <span className="text-center text-sm text-[#64748B]">{row.total}</span>
                  <span className={`text-center text-sm font-semibold ${row.pct >= 75 ? 'text-green-600' : row.pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {row.total > 0 ? `${row.pct}%` : '—'}
                  </span>
                </Link>
              ))}
            </div>
          </div>
          {analytics.some((r) => r.attention) && (
            <p className="mt-2 text-xs text-red-600">
              ⚠ Students with ≥ 3 absences require attention.
            </p>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">

        {/* Sessions */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-[#0B1F3A]">Sessions</h2>

          {!isActive ? (
            <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-6 text-center">
              <p className="text-sm font-medium text-amber-800">Sessions unavailable</p>
              <p className="mt-1 text-xs text-amber-700">Assign a course to this group first.</p>
            </div>
          ) : group.sessions.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#E2E8F0] text-sm text-[#64748B]">
              <span>No sessions yet.</span>
              <StartGroupSessionButton
                groupId={id}
                groupCourseId={group.group_course_id}
                branchId={group.branch_id}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-[#E2E8F0] bg-white divide-y divide-[#F1F5F9]">
              {group.sessions.map((s, idx) => (
                <Link
                  key={s.id}
                  href={`/portal/instructor/groups/${id}/sessions/${s.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-[#F8FAFC] transition"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F1F5F9] text-xs font-semibold text-[#64748B]">
                    {group.sessions.length - idx}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#0B1F3A]">
                      {s.topic ?? new Date(s.scheduled_at).toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short',
                      })}
                    </p>
                    <p className="text-xs text-[#64748B]">
                      {new Date(s.scheduled_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}{' '}
                      · {s.duration_minutes}min
                      {s.attendance_count !== null && (
                        <> · {s.attendance_count} marked</>
                      )}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {s.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Students */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#0B1F3A]">
            Students ({group.students.length})
          </h2>

          {group.students.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] text-sm text-[#64748B]">
              No students enrolled.
            </div>
          ) : (
            <div className="rounded-xl border border-[#E2E8F0] bg-white divide-y divide-[#F1F5F9]">
              {group.students.map((s) => (
                <Link
                  key={s.student_id}
                  href={`/portal/instructor/groups/${id}/students/${s.student_id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F8FAFC] transition"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-xs font-semibold text-[#3B82F6]">
                    {(s.first_name?.[0] ?? s.email[0]).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[#0B1F3A]">
                      {[s.first_name, s.last_name].filter(Boolean).join(' ') || s.email}
                    </p>
                    <p className="truncate text-xs text-[#94A3B8] capitalize">{s.enrollment_type}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
