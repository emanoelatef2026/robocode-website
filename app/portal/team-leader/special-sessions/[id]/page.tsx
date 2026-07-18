import { requirePortalRole, isBranchAccessible } from '@/modules/rbac/guards'
import { getTrialSession, getMakeupSession, searchLeadsForTrialSession } from '@/modules/special-sessions/queries'
import { createServiceClient } from '@/lib/supabase/service'
import EmptyState from '@/components/admin/EmptyState'
import TLSpecialSessionDetail from './_components/TLSpecialSessionDetail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function TLSpecialSessionPage({ params }: Props) {
  const { id } = await params
  const user = await requirePortalRole('team_leader')

  const db = createServiceClient()

  const { data: sessType } = await db
    .from('schedules')
    .select('type, group_course_id, branch_id')
    .eq('id', id)
    .is('group_course_id', null)
    .maybeSingle()

  if (!sessType) {
    return <EmptyState title="Session not found" description="This session does not exist." />
  }

  const sessionType = (sessType as any).type as string
  const branchId    = (sessType as any).branch_id as string

  if (!isBranchAccessible(user, branchId)) {
    return <EmptyState title="Session not found" description="This session does not exist." />
  }

  if (sessionType === 'trial') {
    const [session, leads] = await Promise.all([
      getTrialSession(id),
      searchLeadsForTrialSession('', branchId),
    ])
    if (!session) return <EmptyState title="Trial session not found" description="" />
    return <TLSpecialSessionDetail type="trial" trialSession={session} leads={leads} />
  }

  // For makeup: fetch searchable students
  const session = await getMakeupSession(id)
  if (!session) return <EmptyState title="Makeup session not found" description="" />
  return <TLSpecialSessionDetail type="makeup" makeupSession={session} leads={[]} />
}
