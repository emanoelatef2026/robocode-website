import { requirePortalRole } from '@/modules/rbac/guards'
import { getStudentDashboardData } from '@/modules/student-portal/queries'
import { getUnreadNotificationCount } from '@/modules/notifications/queries'
import StudentShell from '@/components/portal/student/StudentShell'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortalRole('student')
  const data = await getStudentDashboardData(user.id)

  let unreadNotifications = 0
  try {
    unreadNotifications = await getUnreadNotificationCount(user.id)
  } catch {
    // non-fatal — bell just shows 0
  }

  return (
    <StudentShell
      studentName={data?.student_name ?? undefined}
      groupName={data?.group_name ?? undefined}
      currentStreak={data?.current_streak ?? 0}
      groupRank={data?.group_rank ?? null}
      currentLevel={data?.current_level ?? 1}
      totalXp={data?.total_xp ?? 0}
      xpProgressPct={data?.xp_progress_pct ?? 0}
      xpToNextLevel={data?.xp_to_next_level ?? 500}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </StudentShell>
  )
}
