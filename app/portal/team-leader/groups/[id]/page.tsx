import { requirePortalRole } from '@/modules/rbac/guards'
import { getGroupDetail } from '@/modules/schedule/queries'
import { listStudents } from '@/modules/students/queries'
import { listCourses } from '@/modules/courses/queries'
import { listInstructors } from '@/modules/instructors/queries'
import { listSchedules } from '@/modules/schedule/queries'
import { notFound } from 'next/navigation'
import StatusBadge from '@/components/admin/StatusBadge'
import PageHeader from '@/components/admin/PageHeader'
import TLEnrollStudentsForm, { UnenrollButton } from './TLEnrollStudentsForm'
import TLAssignCourseForm from './TLAssignCourseForm'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function TLGroupDetailPage({ params }: Props) {
  const user = await requirePortalRole('team_leader')
  const branchId = user.branchIds[0]
  const { id } = await params

  const group = await getGroupDetail(id)
  if (!group) notFound()

  const [allStudents, courses, instructors, upcomingSessions, pastSessions] = await Promise.all([
    listStudents({ branchId: group.branch_id, perPage: 200 }),
    listCourses({ branchId: group.branch_id, perPage: 100 }),
    listInstructors({ branchId: group.branch_id, perPage: 100 }),
    group.group_course_id
      ? listSchedules({ groupCourseId: group.group_course_id, upcoming: true, limit: 5 })
      : Promise.resolve([]),
    group.group_course_id
      ? listSchedules({ groupCourseId: group.group_course_id, limit: 5 })
      : Promise.resolve([]),
  ])

  const enrolledIds = group.students.map((s) => s.id)

  return (
    <div className="space-y-6">
      <PageHeader
        title={group.name}
        description={group.code ? `Code: ${group.code}` : 'Group detail'}
        action={
          <div className="flex gap-2">
            <Link
              href="/portal/team-leader/groups"
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
            >
              Back
            </Link>
            <Link
              href={`/portal/team-leader/groups/${id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18]"
            >
              Edit Group
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: info + course assignment */}
        <div className="space-y-6 lg:col-span-1">
          {/* Group info */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-[#0B1F3A]">Group Info</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-[#64748B]">Status</dt>
                <dd className="mt-0.5"><StatusBadge status={group.status} /></dd>
              </div>
              <div>
                <dt className="text-xs text-[#64748B]">Type</dt>
                <dd className="mt-0.5 text-sm text-[#0B1F3A] capitalize">{group.type}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#64748B]">Capacity</dt>
                <dd className="mt-0.5 text-sm text-[#0B1F3A]">
                  {group.students.length}{group.capacity ? ` / ${group.capacity}` : ' enrolled'}
                </dd>
              </div>
              {group.course_title && (
                <div>
                  <dt className="text-xs text-[#64748B]">Course</dt>
                  <dd className="mt-0.5 text-sm text-[#0B1F3A]">{group.course_title}</dd>
                </div>
              )}
              {group.instructor_name && (
                <div>
                  <dt className="text-xs text-[#64748B]">Instructor</dt>
                  <dd className="mt-0.5 text-sm text-[#0B1F3A]">{group.instructor_name}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Assign course */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-[#0B1F3A]">Assign Course & Instructor</h2>
            <TLAssignCourseForm
              groupId={id}
              courses={courses.data}
              instructors={instructors.data}
              currentCourseId={group.course_id}
              currentInstructorId={group.instructor_id}
            />
          </div>
        </div>

        {/* Right: students + sessions */}
        <div className="space-y-6 lg:col-span-2">
          {/* Students */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3">
              <h2 className="text-sm font-semibold text-[#0B1F3A]">
                Students ({group.students.length})
              </h2>
            </div>
            {group.students.length > 0 && (
              <div className="divide-y divide-[#F1F5F9]">
                {group.students.map((s) => {
                  const name = s.first_name
                    ? `${s.first_name} ${s.last_name ?? ''}`.trim()
                    : s.email
                  return (
                    <div key={s.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-[#0B1F3A]">{name}</p>
                        <p className="text-xs text-[#64748B]">{s.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/portal/team-leader/students/${s.id}`}
                          className="text-xs font-medium text-[#FF8A1F] hover:underline"
                        >
                          View
                        </Link>
                        <UnenrollButton groupId={id} studentId={s.id} name={name} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="border-t border-[#E2E8F0] p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#64748B]">Enroll student</p>
              <TLEnrollStudentsForm
                groupId={id}
                enrolledIds={enrolledIds}
                availableStudents={allStudents.data}
              />
            </div>
          </div>

          {/* Sessions */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3">
              <h2 className="text-sm font-semibold text-[#0B1F3A]">Upcoming Sessions</h2>
              {group.group_course_id && (
                <Link
                  href={`/portal/team-leader/groups/${id}/sessions/new`}
                  className="text-xs font-medium text-[#FF8A1F] hover:underline"
                >
                  + New Session
                </Link>
              )}
            </div>
            {!group.group_course_id ? (
              <div className="px-5 py-8 text-center text-sm text-[#64748B]">
                Assign a course first to manage sessions.
              </div>
            ) : upcomingSessions.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-[#64748B]">
                No upcoming sessions.{' '}
                <Link href={`/portal/team-leader/groups/${id}/sessions/new`} className="text-[#FF8A1F] hover:underline">
                  Schedule one.
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[#F1F5F9]">
                {upcomingSessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-[#0B1F3A]">
                        {new Date(s.scheduled_at).toLocaleDateString('en-GB', {
                          weekday: 'short', day: 'numeric', month: 'short',
                        })}
                        {' '}
                        {new Date(s.scheduled_at).toLocaleTimeString('en-GB', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                      {s.topic && <p className="text-xs text-[#64748B]">{s.topic}</p>}
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                ))}
              </div>
            )}

            {pastSessions.length > 0 && (
              <>
                <div className="border-t border-[#E2E8F0] px-5 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Recent Past Sessions</p>
                </div>
                <div className="divide-y divide-[#F1F5F9]">
                  {pastSessions
                    .filter((s) => new Date(s.scheduled_at) < new Date())
                    .slice(0, 3)
                    .map((s) => (
                      <div key={s.id} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <p className="text-sm text-[#64748B]">
                            {new Date(s.scheduled_at).toLocaleDateString('en-GB', {
                              weekday: 'short', day: 'numeric', month: 'short',
                            })}
                          </p>
                          {s.topic && <p className="text-xs text-[#94A3B8]">{s.topic}</p>}
                        </div>
                        <StatusBadge status={s.status} />
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
