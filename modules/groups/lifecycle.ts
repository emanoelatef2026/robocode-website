import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export interface GroupReadiness {
  hasCourse:     boolean
  hasSemester:   boolean
  hasInstructor: boolean
  isActive:      boolean
  missing:       string[]
}

export async function computeGroupReadiness(groupId: string): Promise<GroupReadiness> {
  const db = createServiceClient()

  const [{ data: group }, { data: gcRow }, { data: giRow }] = await Promise.all([
    db.from('groups').select('semester_id').eq('id', groupId).maybeSingle(),
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
  const hasSemester   = !!(group as any)?.semester_id
  const hasInstructor = !!((gcRow as any)?.instructor_id || (giRow as any)?.instructor_id)
  const isActive      = hasCourse && hasSemester && hasInstructor

  const missing: string[] = []
  if (!hasCourse)     missing.push('Course not assigned')
  if (!hasSemester)   missing.push('Semester not assigned')
  if (!hasInstructor) missing.push('No instructor assigned')

  return { hasCourse, hasSemester, hasInstructor, isActive, missing }
}

// Call after any academic config change to keep groups.status in sync.
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
