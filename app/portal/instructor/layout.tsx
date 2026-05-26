import { requirePortalRole } from '@/modules/rbac/guards'

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  await requirePortalRole('instructor')
  return <>{children}</>
}
