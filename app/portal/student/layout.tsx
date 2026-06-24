import { requirePortalRole } from '@/modules/rbac/guards'
import { getStudentDashboardData } from '@/modules/student-portal/queries'
import StudentShell from '@/components/portal/student/StudentShell'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortalRole('student')
  const data = await getStudentDashboardData(user.id)
  return (
    <StudentShell
      studentName={data?.student_name ?? undefined}
      groupName={data?.group_name ?? undefined}
    >
      {children}
    </StudentShell>
  )
}
