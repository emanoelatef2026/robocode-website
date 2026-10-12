import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId, listInstructorGroups } from '@/modules/instructor-portal/queries'
import EmptyState from '@/components/admin/EmptyState'
import EvaluationCenter from './EvaluationCenter'

export default async function InstructorEvaluationsPage() {
  const user = await requirePortalRole('instructor')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) return <EmptyState title="Instructor record not found" description="Contact your team leader to link your account." />
  const groups = await listInstructorGroups(instructor.id)
  const unique = [...new Map(groups.map(g => [g.group_id, g])).values()]
  return <EvaluationCenter groups={unique.map(g => ({
    id: g.group_id, name: g.group_name, code: g.group_code, course: g.course_title,
    branch: g.branch_name, day: g.day_of_week, studentCount: g.student_count, completedSessions: g.completed_sessions,
  }))} />
}
