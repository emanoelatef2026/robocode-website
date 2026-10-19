import 'server-only'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { getInstructorByUserId } from './queries'
import { scheduleSessionEffects } from './session-effects'
import type { ActionResult } from '@/types/app'

const identity = z.object({ sessionId: z.string().uuid(), groupId: z.string().uuid() })
const attendance = z.array(z.object({
  student_id: z.string().uuid(),
  status: z.enum(['present', 'absent', 'late', 'excused', 'makeup']),
  late_minutes: z.number().int().min(0).max(480).nullable(),
  notes: z.string().max(10000).nullable(),
})).min(1).max(1000).refine(rows => new Set(rows.map(r => r.student_id)).size === rows.length, {
  message: 'Duplicate students in attendance.',
})

export async function persistInstructorSession(
  form: FormData, complete: boolean, includeAttendance: boolean,
): Promise<ActionResult<{ attendanceRevision: number; alreadyCompleted?: boolean }>> {
  const user = await requirePermission('manage_attendance')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }
  const ids = identity.safeParse({ sessionId: form.get('session_id'), groupId: form.get('group_id') })
  if (!ids.success) return { success: false, error: { code: 'VALIDATION', message: 'Valid session and group are required.' } }
  const rows = includeAttendance ? attendance.safeParse(form.getAll('student_ids[]').map(sid => ({
    student_id: sid,
    status: form.get(`status_${sid}`),
    late_minutes: form.get(`late_minutes_${sid}`) ? Number(form.get(`late_minutes_${sid}`)) : null,
    notes: form.get(`notes_${sid}`) || null,
  }))) : null
  if (rows && !rows.success) return { success: false, error: { code: 'VALIDATION', message: rows.error.issues[0].message } }
  const topic = form.get('topic')
  if (topic !== null && typeof topic !== 'string') return { success: false, error: { code: 'VALIDATION', message: 'Invalid topic.' } }
  const { sessionId, groupId } = ids.data
  const rawRevision = form.get('attendance_revision')
  const revision = rawRevision === null ? null : Number(rawRevision)
  if (revision !== null && (!Number.isSafeInteger(revision) || revision < 0)) return { success: false, error: { code: 'VALIDATION', message: 'Invalid attendance revision.' } }
  const { data, error } = await createServiceClient().rpc('save_shared_instructor_session', {
    p_actor_id: user.id, p_instructor_id: instructor.id,
    p_session_id: sessionId, p_group_id: groupId, p_complete: complete,
    p_attendance: rows?.success ? rows.data : null, p_topic: topic, p_expected_revision: revision,
  })
  if (error) return { success: false, error: {
    code: error.code === '42501' ? 'FORBIDDEN' : error.code === '22023' ? 'VALIDATION' : 'DB_ERROR',
    message: ['42501', '22023'].includes(error.code) ? error.message : 'Unable to save the session. Please retry.',
  } }
  if (!data) return { success: false, error: { code: 'DB_ERROR', message: 'Session save returned no result.' } }
  if (complete) scheduleSessionEffects(sessionId)
  revalidatePath(`/portal/instructor/groups/${groupId}`)
  revalidatePath(`/portal/instructor/groups/${groupId}/sessions/${sessionId}`)
  return { success: true, data: { attendanceRevision: data.attendance_revision ?? 0, alreadyCompleted: data.already_completed === true } }
}
