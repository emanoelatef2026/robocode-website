import { requirePortalRole } from '@/modules/rbac/guards'
import { getDashboardStats, getUpcomingSchedules } from '@/modules/schedule/queries'
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

export default async function TLDashboardPage() {
  const user = await requirePortalRole('team_leader')

  const branchId = user.branchIds[0]
  if (!branchId) {
    return (
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No branch assigned to your account. Contact a super admin.
      </div>
    )
  }

  const [stats, upcoming] = await Promise.all([
    getDashboardStats(branchId),
    getUpcomingSchedules(branchId, 5),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A]">Dashboard</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">Overview of your branch</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Active Students"    value={stats.activeStudents}    href="/portal/team-leader/students" />
        <StatCard label="Active Instructors" value={stats.activeInstructors} href="/portal/team-leader/instructors" />
        <StatCard label="Active Groups"      value={stats.activeGroups}      href="/portal/team-leader/groups" />
        <StatCard label="Upcoming Sessions"  value={stats.upcomingSessions}  href="/portal/team-leader/groups" />
      </div>

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
