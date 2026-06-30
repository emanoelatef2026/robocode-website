import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId } from '@/modules/instructor-portal/queries'
import { getTrialSession, getMakeupSession } from '@/modules/special-sessions/queries'
import { createServiceClient } from '@/lib/supabase/service'
import EmptyState from '@/components/admin/EmptyState'
import StatusBadge from '@/components/admin/StatusBadge'
import SpecialSessionDetail from './_components/SpecialSessionDetail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SpecialSessionPage({ params }: Props) {
  const { id } = await params
  const user   = await requirePortalRole('instructor')
  const instructor = await getInstructorByUserId(user.id)

  if (!instructor) {
    return <EmptyState title="No instructor record found" description="Contact your team leader." />
  }

  // Determine the session type first
  const db = createServiceClient()
  const { data: sessType } = await db
    .from('schedules')
    .select('type, group_course_id')
    .eq('id', id)
    .is('group_course_id', null)
    .maybeSingle()

  if (!sessType) {
    return <EmptyState title="Session not found" description="This session does not exist or belongs to a group." />
  }

  const sessionType = (sessType as any).type as string

  if (sessionType === 'trial') {
    const session = await getTrialSession(id)
    if (!session) return <EmptyState title="Trial session not found" description="" />
    return <SpecialSessionDetail type="trial" trialSession={session} instructorId={instructor.id} />
  }

  const session = await getMakeupSession(id)
  if (!session) return <EmptyState title="Makeup session not found" description="" />
  return <SpecialSessionDetail type="makeup" makeupSession={session} instructorId={instructor.id} />
}
