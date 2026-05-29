import { requirePortalRole } from '@/modules/rbac/guards'
import { getParentChildren } from '@/modules/parents/parent-portal-queries'
import ParentShell from '@/components/portal/parent/ParentShell'

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const user           = await requirePortalRole('parent')
  const linkedChildren = await getParentChildren(user.id)
  return <ParentShell linkedChildren={linkedChildren}>{children}</ParentShell>
}
