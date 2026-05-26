import { requirePortalRole } from '@/modules/rbac/guards'

// Super Admin portal — protected, requires super_admin role.
// Dashboard UI will be built in a later phase.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePortalRole('super_admin')
  return <>{children}</>
}
