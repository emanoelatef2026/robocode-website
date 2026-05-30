import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export interface GroupReadiness {
  hasCourse:     boolean
  hasInstructor: boolean
  isActive:      boolean
  missing:       string[]
}

export async function computeGroupReadiness(groupId: string): Promise<GroupReadiness> {
  const db = createServiceClient()

  const [{ data: gcRow }, { data: giRow }] = await Promise.all([
    db.from('group_courses')
      .select('id, instructor_id')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .maybeSingle(),
    db.from('group_instructors')
      .select('instructor_id')
      .eq('group_id', groupId)
      .limit(1)
      .maybeSingle(),
  ])

  const hasCourse     = !!gcRow
  const hasInstructor = !!((gcRow as any)?.instructor_id || (giRow as any)?.instructor_id)
  const isActive      = hasCourse && hasInstructor

  const missing: string[] = []
  if (!hasCourse)     missing.push('Course not assigned')
  if (!hasInstructor) missing.push('No instructor assigned')

  return { hasCourse, hasInstructor, isActive, missing }
}

// Call after any config change to keep groups.status in sync.
// Only modifies groups in 'forming' or 'active' state — never touches 'completed' or 'cancelled'.
export async function syncGroupStatus(
  groupId: string,
  db: ReturnType<typeof createServiceClient>
): Promise<void> {
  const readiness  = await computeGroupReadiness(groupId)
  const nextStatus = readiness.isActive ? 'active' : 'forming'

  await db
    .from('groups')
    .update({ status: nextStatus })
    .eq('id', groupId)
    .in('status', ['forming', 'active'])
}
