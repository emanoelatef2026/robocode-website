import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId, getGroupForInstructor } from '@/modules/instructor-portal/queries'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  ongoing:   'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default async function GroupDetailPage({ params }: Props) {
  const user       = await requirePortalRole('instructor')
  const { id }     = await params
  const instructor = await getInstructorByUserId(user.id)

  if (!instructor) notFound()

  const group = await getGroupForInstructor(id, instructor.id)
  if (!group) notFound()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/portal/instructor/groups" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
            ← My Groups
          </Link>
          <h1 className="mt-1 text-xl font-bold text-[#0B1F3A]">{group.group_name}</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">{group.course_title}</p>
        </div>
        <Link
          href={`/portal/instructor/groups/${id}/sessions/new`}
          className="shrink-0 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e07818] transition"
        >
          + New Session
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sessions */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-[#0B1F3A]">Sessions</h2>

          {group.sessions.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] text-sm text-[#64748B]">
              No sessions yet.{' '}
              <Link href={`/portal/instructor/groups/${id}/sessions/new`} className="ml-1 text-[#FF8A1F] hover:underline">
                Create one
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E2E8F0] bg-white divide-y divide-[#F1F5F9]">
              {group.sessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/portal/instructor/groups/${id}/sessions/${s.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-[#F8FAFC] transition"
                >
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
                    <p className="truncate text-xs text-[#94A3B8]">{s.email}</p>
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
