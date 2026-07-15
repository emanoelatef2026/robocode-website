import { requirePortalRole } from '@/modules/rbac/guards'
import { getUnreadNotificationCount } from '@/modules/notifications/queries'
import TLShell from '@/components/portal/team-leader/TLShell'

export default async function TeamLeaderLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortalRole('team_leader')

  let unreadNotifications = 0
  try {
    unreadNotifications = await getUnreadNotificationCount(user.id)
  } catch {
    // non-fatal — bell just shows 0
  }

  return (
    <TLShell email={user.email} unreadNotifications={unreadNotifications}>
      {children}
    </TLShell>
  )
}
