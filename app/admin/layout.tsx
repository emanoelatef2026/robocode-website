import { requireAuth } from '@/modules/rbac/guards'
import AdminShell from '@/components/admin/AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth()
  return (
    <AdminShell role={user.globalRole} permissions={user.permissions}>
      {children}
    </AdminShell>
  )
}
