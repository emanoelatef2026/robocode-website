import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId, getSessionDetail } from '@/modules/instructor-portal/queries'
import { notFound, redirect } from 'next/navigation'

interface Props { params: Promise<{ sessionId: string }> }

// A completed session isn't a dead record — instructors still need to upload
// resources/homework for it after class (e.g. sending the deck they used,
// assigning take-home tasks), which the interactive session page already
// supports regardless of status. Rather than maintaining a second, read-only
// view of the same session, this route just verifies ownership and forwards
// to the one page that can actually do everything.
export default async function SessionHistoryDetailPage({ params }: Props) {
  const user          = await requirePortalRole('instructor')
  const { sessionId } = await params
  const instructor    = await getInstructorByUserId(user.id)
  if (!instructor) notFound()

  const session = await getSessionDetail(sessionId, instructor.id)
  if (!session) notFound()

  redirect(`/portal/instructor/groups/${session.group_id}/sessions/${sessionId}`)
}
