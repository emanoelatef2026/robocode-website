import {
  getInstructorByUserId,
  listInstructorGroups,
  getUpcomingSessionsForInstructor,
  listPendingSubmissions,
  getTodayActions,
  getStudentsRequiringAttention,
} from '@/modules/instructor-portal/queries'
import type { TodayAction } from '@/modules/instructor-portal/types'
import Link from 'next/link'

// ── Design tokens ─────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<TodayAction['type'], string> = {
  start_session:       'border-l-emerald-400 bg-emerald-50',
  complete_attendance: 'border-l-amber-400   bg-amber-50',
  add_notes:           'border-l-blue-400    bg-blue-50',
  review_homework:     'border-l-violet-400  bg-violet-50',
}

const ACTION_LABEL_COLORS: Record<TodayAction['type'], string> = {
  start_session:       'text-emerald-700',
  complete_attendance: 'text-amber-700',
  add_notes:           'text-blue-700',
  review_homework:     'text-violet-700',
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">{children}</div>
  )
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="border-b border-[#E2E8F0] px-5 py-3 flex items-center gap-2">
      <h2 className="text-sm font-semibold text-[#0B1F3A]">{title}</h2>
      {count !== undefined && (
        <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs font-normal text-[#64748B]">{count}</span>
      )}
    </div>
  )
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="px-5 py-8 text-center text-sm text-[#94A3B8]">{message}</div>
  )
}

// ── Stats header ──────────────────────────────────────────────────────────────

function StatsHeader({
  name,
  groupCount,
  studentCount,
  pendingReviews,
  upcomingSessions,
}: {
  name: string
  groupCount: number
  studentCount: number
  pendingReviews: number
  upcomingSessions: number
}) {
  const stats = [
    { label: 'Groups',            value: groupCount,       href: '/portal/instructor/groups' },
    { label: 'Students',          value: studentCount,     href: '/portal/instructor/groups' },
    { label: 'Pending Reviews',   value: pendingReviews,   href: '/portal/instructor/homework' },
    { label: 'Upcoming Sessions', value: upcomingSessions, href: '/portal/instructor/groups' },
  ]

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-[#0B1F3A]">Welcome back, {name}</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">Here&apos;s your overview for today.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ label, value, href }) => (
          <Link
            key={label}
            href={href}
            className="rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3 transition hover:border-[#CBD5E1]"
          >
            <p className="text-2xl font-bold text-[#0B1F3A]">{value}</p>
            <p className="mt-0.5 text-xs text-[#64748B]">{label}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Section 1: Today's Actions ────────────────────────────────────────────────

function TodayActionsSection({ actions }: { actions: TodayAction[] }) {
  return (
    <Card>
      <SectionHeader title="Today's Tasks" count={actions.length} />
      {actions.length === 0 ? (
        <EmptyRow message="No pending actions today." />
      ) : (
        <div className="divide-y divide-[#F1F5F9]">
          {actions.map((action, i) => (
            <Link
              key={i}
              href={action.href}
              className={`flex items-center gap-3 border-l-4 px-5 py-3 transition hover:opacity-80 ${ACTION_COLORS[action.type]}`}
            >
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${ACTION_LABEL_COLORS[action.type]}`}>{action.label}</p>
                {action.detail && (
                  <p className="text-xs text-[#64748B]">{action.detail}</p>
                )}
              </div>
              <span className="shrink-0 text-xs font-medium text-[#94A3B8]">→</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

// ── Section 2: Upcoming Sessions ─────────────────────────────────────────────

function UpcomingSessionsSection({
  sessions,
}: {
  sessions: Awaited<ReturnType<typeof getUpcomingSessionsForInstructor>>
}) {
  return (
    <Card>
      <SectionHeader title="Upcoming Sessions" count={sessions.length} />
      {sessions.length === 0 ? (
        <EmptyRow message="No scheduled sessions." />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F8FAFC]">
              <th className="px-5 py-2.5 text-left text-xs font-medium text-[#64748B]">Date</th>
              <th className="px-5 py-2.5 text-left text-xs font-medium text-[#64748B]">Time</th>
              <th className="px-5 py-2.5 text-left text-xs font-medium text-[#64748B]">Group</th>
              <th className="px-5 py-2.5 text-left text-xs font-medium text-[#64748B] hidden md:table-cell">Course</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {sessions.map((s) => {
              const dt        = new Date(s.scheduled_at)
              const sessionUrl = s.group_id
                ? `/portal/instructor/groups/${s.group_id}/sessions/${s.id}`
                : '#'
              return (
                <tr key={s.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-5 py-3 text-[#0B1F3A]">
                    {dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-5 py-3 text-[#64748B]">
                    {dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3 font-medium text-[#0B1F3A]">{s.group_name}</td>
                  <td className="px-5 py-3 text-[#64748B] hidden md:table-cell">{s.course_title}</td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={sessionUrl}
                      className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#64748B] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
                    >
                      Open Session
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Card>
  )
}

// ── Section 3: My Groups ──────────────────────────────────────────────────────

function MyGroupsSection({
  groups,
}: {
  groups: Awaited<ReturnType<typeof listInstructorGroups>>
}) {
  if (groups.length === 0) {
    return (
      <Card>
        <SectionHeader title="My Groups" count={0} />
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-[#0B1F3A]">No groups assigned yet.</p>
          <p className="mt-1 text-sm text-[#94A3B8]">Contact your Team Leader or Administrator.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <SectionHeader title="My Groups" count={groups.length} />
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#F8FAFC]">
            <th className="px-5 py-2.5 text-left text-xs font-medium text-[#64748B]">Code</th>
            <th className="px-5 py-2.5 text-left text-xs font-medium text-[#64748B]">Group</th>
            <th className="px-5 py-2.5 text-left text-xs font-medium text-[#64748B] hidden md:table-cell">Branch</th>
            <th className="px-5 py-2.5 text-right text-xs font-medium text-[#64748B]">Students</th>
            <th className="px-5 py-2.5 text-left text-xs font-medium text-[#64748B]">Status</th>
            <th className="px-5 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F1F5F9]">
          {groups.map((g) => {
            const isActive = g.course_title !== ''
            return (
              <tr key={g.group_id} className="hover:bg-[#F8FAFC]">
                <td className="px-5 py-3 font-mono text-xs text-[#94A3B8]">{g.group_code ?? '—'}</td>
                <td className="px-5 py-3">
                  <p className="font-medium text-[#0B1F3A]">{g.group_name}</p>
                  {isActive && <p className="text-xs text-[#94A3B8]">{g.course_title}</p>}
                </td>
                <td className="px-5 py-3 text-[#64748B] hidden md:table-cell">
                  {g.branch_name || <span className="text-[#CBD5E1]">—</span>}
                </td>
                <td className="px-5 py-3 text-right font-medium text-[#0B1F3A]">{g.student_count}</td>
                <td className="px-5 py-3">
                  {isActive ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Active</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Forming</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {isActive && (
                      <Link
                        href={`/portal/instructor/groups/${g.group_id}/sessions/new`}
                        className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#64748B] transition hover:border-emerald-400 hover:text-emerald-600"
                      >
                        Start Session
                      </Link>
                    )}
                    <Link
                      href={`/portal/instructor/groups/${g.group_id}`}
                      className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#64748B] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
                    >
                      Open
                    </Link>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}

// ── Section 4: Pending Homework Reviews ───────────────────────────────────────

function PendingReviewsSection({
  submissions,
}: {
  submissions: Awaited<ReturnType<typeof listPendingSubmissions>>
}) {
  return (
    <Card>
      <SectionHeader title="Pending Homework Reviews" count={submissions.length} />
      {submissions.length === 0 ? (
        <EmptyRow message="No submissions waiting for review." />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F8FAFC]">
              <th className="px-5 py-2.5 text-left text-xs font-medium text-[#64748B]">Student</th>
              <th className="px-5 py-2.5 text-left text-xs font-medium text-[#64748B]">Assignment</th>
              <th className="px-5 py-2.5 text-left text-xs font-medium text-[#64748B] hidden md:table-cell">Submitted</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {submissions.map((sub) => (
              <tr key={sub.submission_id} className="hover:bg-[#F8FAFC]">
                <td className="px-5 py-3 font-medium text-[#0B1F3A]">
                  {sub.student_name}
                  {sub.group_name && (
                    <span className="ml-1.5 text-xs font-normal text-[#94A3B8]">{sub.group_name}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-[#64748B]">
                  {sub.assignment_title}
                  {sub.is_late && (
                    <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">Late</span>
                  )}
                </td>
                <td className="px-5 py-3 text-[#94A3B8] hidden md:table-cell">
                  {new Date(sub.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/portal/instructor/homework/${sub.submission_id}`}
                    className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#64748B] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
                  >
                    Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

// ── Section 5: Students Requiring Attention ───────────────────────────────────

function AttentionSection({
  students,
}: {
  students: Awaited<ReturnType<typeof getStudentsRequiringAttention>>
}) {
  if (students.length === 0) return null

  return (
    <Card>
      <SectionHeader title="Students Requiring Attention" count={students.length} />
      <div className="divide-y divide-[#F1F5F9]">
        {students.map((s) => (
          <div key={`${s.student_id}:${s.group_id}`} className="flex items-center gap-4 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#0B1F3A]">{s.student_name}</p>
              <p className="text-xs text-[#94A3B8]">
                {s.group_name && <span>{s.group_name} · </span>}
                {s.reason}
              </p>
            </div>
            <Link
              href={s.href}
              className="shrink-0 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#64748B] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
            >
              Open Student
            </Link>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Section 6: Quick Actions ──────────────────────────────────────────────────

function QuickActionsSection({ permissions }: { permissions: string[] }) {
  const actions: { label: string; href: string; permission?: string }[] = [
    { label: 'My Groups',       href: '/portal/instructor/groups' },
    { label: 'Homework Reviews',href: '/portal/instructor/homework' },
    { label: 'Students',        href: '/admin/students',    permission: 'manage_students' },
    { label: 'Attendance',      href: '/admin/attendance',  permission: 'manage_attendance' },
    { label: 'Assignments',     href: '/admin/assignments', permission: 'manage_assignments' },
    { label: 'Groups',          href: '/admin/groups',      permission: 'manage_groups' },
  ]
  const visible = actions.filter((a) => !a.permission || permissions.includes(a.permission))

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
      <h2 className="mb-4 text-sm font-medium text-[#0B1F3A]">Quick Actions</h2>
      <div className="flex flex-wrap gap-2">
        {visible.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default async function InstructorDashboard({
  userId,
  permissions,
}: {
  userId:      string
  permissions: string[]
}) {
  const instructor = await getInstructorByUserId(userId)

  if (!instructor) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] text-sm text-[#64748B]">
        No instructor record found. Contact your Team Leader or Administrator.
      </div>
    )
  }

  const name = [instructor.first_name, instructor.last_name].filter(Boolean).join(' ') || instructor.email

  const [todayActions, upcoming, groups, pending, attention] = await Promise.all([
    getTodayActions(instructor.id).catch(() => []),
    getUpcomingSessionsForInstructor(instructor.id, 5).catch(() => []),
    listInstructorGroups(instructor.id).catch(() => []),
    listPendingSubmissions(instructor.id, 10).catch(() => []),
    getStudentsRequiringAttention(instructor.id, 5).catch(() => []),
  ])

  const totalStudents = groups.reduce((sum, g) => sum + g.student_count, 0)

  return (
    <div className="space-y-5">
      {/* Stats header */}
      <StatsHeader
        name={name}
        groupCount={groups.length}
        studentCount={totalStudents}
        pendingReviews={pending.length}
        upcomingSessions={upcoming.length}
      />

      {/* Today's Tasks */}
      <TodayActionsSection actions={todayActions} />

      {/* My Groups */}
      <MyGroupsSection groups={groups} />

      {/* Upcoming Sessions */}
      <UpcomingSessionsSection sessions={upcoming} />

      {/* Pending Homework Reviews */}
      <PendingReviewsSection submissions={pending} />

      {/* Students Requiring Attention */}
      <AttentionSection students={attention} />

      {/* Quick Actions */}
      <QuickActionsSection permissions={permissions} />
    </div>
  )
}
