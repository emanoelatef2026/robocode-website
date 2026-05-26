import { requirePortalRole } from '@/modules/rbac/guards'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requirePortalRole('student')
  return <>{children}</>
}
