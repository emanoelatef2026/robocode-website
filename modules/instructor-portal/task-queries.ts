import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export interface TeachingTask { sessionId: string; groupId: string; groupName: string; count?: number }
export interface TeachingTasks { ongoing: TeachingTask[]; reviews: TeachingTask[]; reviewCount: number }
type Schedule = { id: string; group_courses: { group_id: string; groups: { name: string } } }

/** Server callers pass the instructor resolved from the authenticated account. */
export async function getTeachingTasks(instructorId: string): Promise<TeachingTasks> {
  const db = createServiceClient()
  const [ongoing, changes] = await Promise.all([
    db.from('schedules').select('id,group_courses!inner(group_id,groups!inner(name))')
      .eq('lead_instructor_id', instructorId).eq('status', 'ongoing').order('scheduled_at').limit(8),
    db.from('session_change_requests').select('id,schedules!inner(id,lead_instructor_id,group_courses!inner(group_id,groups!inner(name)))', { count: 'exact' })
      .eq('status', 'pending').eq('schedules.lead_instructor_id', instructorId).order('created_at').limit(100),
  ])
  if (ongoing.error || changes.error) throw new Error('Teaching tasks could not be loaded.')
  const task = (s: Schedule): TeachingTask => ({ sessionId: s.id, groupId: s.group_courses.group_id, groupName: s.group_courses.groups.name })
  const reviews = new Map<string, TeachingTask>()
  for (const row of changes.data ?? []) {
    const session = row.schedules as unknown as Schedule
    const existing = reviews.get(session.id)
    if (existing) existing.count = (existing.count ?? 0) + 1
    else reviews.set(session.id, { ...task(session), count: 1 })
  }
  return { ongoing: (ongoing.data ?? []).map(s => task(s as unknown as Schedule)), reviews: [...reviews.values()], reviewCount: changes.count ?? 0 }
}
