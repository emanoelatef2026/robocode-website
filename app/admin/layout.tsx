import { requireAuth } from '@/modules/rbac/guards'
import { getUnreadNotificationCount } from '@/modules/notifications/queries'
import AdminShell from '@/components/admin/AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth()

  let unreadNotifications = 0
  try {
    unreadNotifications = await getUnreadNotificationCount(user.id)
  } catch {
    // non-fatal — bell just shows 0
  }

  return (
    <AdminShell role={user.globalRole} permissions={user.permissions} email={user.email} unreadNotifications={unreadNotifications}>
      {children}
    </AdminShell>
  )
}
