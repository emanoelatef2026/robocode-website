import { requirePermission } from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import ParticipationReview from './ParticipationReview'

export default async function ParticipationRequests() {
  const user = await requirePermission('manage_instructors')
  if (!['super_admin', 'team_leader'].includes(user.globalRole)) return null
  const db = createServiceClient()
  let query = db.from('session_participations').select(`session_id,instructor_id,reason,requested_at,
    schedules!inner(topic,scheduled_at,branch_id,group_courses!inner(groups!inner(name))),
    instructors!inner(users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name,last_name)))`)
    .eq('state', 'requested').order('requested_at').limit(100)
  if (user.globalRole !== 'super_admin') query = query.in('schedules.branch_id', user.branchIds)
  const { data, error } = await query
  if (error) throw new Error('Unable to load participation approval requests. Please retry.')
  const requests = (data ?? []).map(row => {
    const s = row.schedules as unknown as { topic: string; scheduled_at: string; group_courses: { groups: { name: string } } }
    const p = (row.instructors as unknown as { users: { profiles: { first_name: string; last_name: string } } }).users?.profiles
    return { sessionId: row.session_id, instructorId: row.instructor_id, reason: row.reason ?? '',
      name: [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Instructor',
      group: s.group_courses?.groups?.name ?? 'Group', topic: s.topic ?? 'Session', date: s.scheduled_at }
  })
  return <ParticipationReview requests={requests} />
}
