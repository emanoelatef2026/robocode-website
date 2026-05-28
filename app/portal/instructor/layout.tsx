import { requirePortalRole } from '@/modules/rbac/guards'
import InstructorShell from '@/components/portal/instructor/InstructorShell'

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  await requirePortalRole('instructor')
  return <InstructorShell>{children}</InstructorShell>
}
