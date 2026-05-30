import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getInstructorByUserId,
  getInstructorDashboardStats,
  getUpcomingSessionsForInstructor,
  listPendingSubmissions,
  listInstructorGroups,
} from '@/modules/instructor-portal/queries'
import Link from 'next/link'

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-[#E2E8F0] bg-white p-5 transition hover:border-[#CBD5E1] hover:shadow-sm"
    >
      <p className="text-2xl font-bold text-[#0B1F3A]">{value}</p>
      <p className="mt-1 text-sm text-[#64748B]">{label}</p>
    </Link>
  )
}

function WarningBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
      {message}
    </div>
  )
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

  let stats = { groupCount: 0, studentCount: 0, upcomingSessions: 0, pendingReviews: 0 }
  let statsError: string | null = null
  try {
    stats = await getInstructorDashboardStats(instructor.id)
  } catch (e) {
    statsError = e instanceof Error ? e.message : 'Failed to load stats'
  }

  let upcoming: Awaited<ReturnType<typeof getUpcomingSessionsForInstructor>> = []
  let upcomingError: string | null = null
  try {
    upcoming = await getUpcomingSessionsForInstructor(instructor.id, 5)
  } catch (e) {
    upcomingError = e instanceof Error ? e.message : 'Failed to load sessions'
  }

  let pendingCount = 0
  try {
    const pending = await listPendingSubmissions(instructor.id)
    pendingCount = pending.length
  } catch { /* non-critical */ }

  // Collect forming groups to surface blockers
  let formingGroups: { group_id: string; group_name: string; missing: string[] }[] = []
  try {
    const groups = await listInstructorGroups(instructor.id)
    formingGroups = groups
      .filter((g) => !g.course_title || !g.semester_id)
      .map((g) => {
        const missing: string[] = []
        if (!g.course_title) missing.push('Course not assigned')
        if (!g.semester_id)  missing.push('Semester not assigned')
        return { group_id: g.group_id, group_name: g.group_name, missing }
      })
  } catch { /* non-critical */ }

  const name = [instructor.first_name, instructor.last_name].filter(Boolean).join(' ') || instructor.email

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A]">Dashboard</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">Welcome back, {name}</p>
      </div>

      {statsError && <WarningBanner message={`Stats unavailable: ${statsError}`} />}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="My Groups"          value={stats.groupCount}       href="/portal/instructor/groups" />
        <StatCard label="My Students"        value={stats.studentCount}     href="/portal/instructor/groups" />
        <StatCard label="Upcoming Sessions"  value={stats.upcomingSessions} href="/portal/instructor/groups" />
        <StatCard label="Pending Reviews"    value={pendingCount}           href="/portal/instructor/homework" />
      </div>

      {/* Forming groups — surface blockers */}
      {formingGroups.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50">
          <div className="border-b border-amber-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-amber-800">
              {formingGroups.length} group{formingGroups.length !== 1 ? 's' : ''} cannot start sessions yet
            </h2>
            <p className="mt-0.5 text-xs text-amber-700">Contact your administrator to complete the setup.</p>
          </div>
          <div className="divide-y divide-amber-100">
            {formingGroups.map((g) => (
              <Link
                key={g.group_id}
                href={`/portal/instructor/groups/${g.group_id}`}
                className="flex items-start justify-between gap-4 px-5 py-3 hover:bg-amber-100/40 transition"
              >
                <div>
                  <p className="text-sm font-medium text-amber-900">{g.group_name}</p>
                  <p className="mt-0.5 text-xs text-amber-700">{g.missing.join(' · ')}</p>
                </div>
                <span className="shrink-0 text-xs text-amber-600 hover:underline">View →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {upcomingError && <WarningBanner message={`Upcoming sessions unavailable: ${upcomingError}`} />}

      {upcoming.length > 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white">
          <div className="border-b border-[#E2E8F0] px-5 py-3">
            <h2 className="text-sm font-semibold text-[#0B1F3A]">Upcoming Sessions</h2>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {upcoming.map((s) => (
              <div key={s.id} className="flex items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#0B1F3A]">
                    {s.group_name} · {s.course_title}
                  </p>
                  {s.topic && (
                    <p className="truncate text-xs text-[#64748B]">{s.topic}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm text-[#0B1F3A]">
                    {new Date(s.scheduled_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short',
                    })}
                  </p>
                  <p className="text-xs text-[#64748B]">
                    {new Date(s.scheduled_at).toLocaleTimeString('en-GB', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        stats.groupCount > 0 && formingGroups.length < stats.groupCount && (
          <div className="rounded-xl border border-[#E2E8F0] bg-white px-5 py-6 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">No upcoming sessions</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Sessions appear here once you create them from your active groups.
            </p>
            <Link
              href="/portal/instructor/groups"
              className="mt-3 inline-block text-xs font-medium text-[#FF8A1F] hover:underline"
            >
              View my groups →
            </Link>
          </div>
        )
      )}
    </div>
  )
}
