import { requirePortalRole } from '@/modules/rbac/guards'
import AdminShell from '@/components/admin/AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePortalRole('super_admin')
  return <AdminShell>{children}</AdminShell>
}
