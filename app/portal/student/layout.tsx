import { requirePortalRole } from '@/modules/rbac/guards'
import StudentShell from '@/components/portal/student/StudentShell'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requirePortalRole('student')
  return <StudentShell>{children}</StudentShell>
}
