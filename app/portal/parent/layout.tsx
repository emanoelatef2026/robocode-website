import { requirePortalRole } from '@/modules/rbac/guards'
import { getParentChildren } from '@/modules/parents/parent-portal-queries'
import { getUnreadNotificationCount } from '@/modules/notifications/queries'
import ParentShell from '@/components/portal/parent/ParentShell'

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const user           = await requirePortalRole('parent')
  const [linkedChildren, unreadNotifications] = await Promise.all([
    getParentChildren(user.id),
    getUnreadNotificationCount(user.id),
  ])
  return (
    <ParentShell linkedChildren={linkedChildren} unreadNotifications={unreadNotifications} email={user.email}>
      {children}
    </ParentShell>
  )
}
