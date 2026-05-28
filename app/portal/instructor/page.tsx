import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getInstructorByUserId,
  getInstructorDashboardStats,
  getUpcomingSessionsForInstructor,
  listPendingSubmissions,
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

  // Resolve instructor record
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) {
    return (
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No instructor record found for your account. Contact your team leader.
      </div>
    )
  }

  // Graceful degradation: individual try-catch per section
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

      {upcomingError && <WarningBanner message={`Upcoming sessions unavailable: ${upcomingError}`} />}

      {upcoming.length > 0 && (
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
      )}
    </div>
  )
}
