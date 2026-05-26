import { requirePortalRole } from '@/modules/rbac/guards'

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  await requirePortalRole('parent')
  return <>{children}</>
}
