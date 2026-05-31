'use server'

import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePortalRole } from '@/modules/rbac/guards'
import type { ActionResult } from '@/types/app'

const feedbackSchema = z.object({
  schedule_id: z.string().uuid(),
  q1_score:    z.coerce.number().int().min(1).max(5),
  q2_score:    z.coerce.number().int().min(1).max(5),
  q3_score:    z.coerce.number().int().min(1).max(5),
  comment:     z.string().max(500).optional().or(z.literal('')),
})

export async function submitSessionFeedback(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePortalRole('student')
  const db   = createServiceClient()

  // Resolve student_id
  const { data: studentRow } = await db
    .from('students')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!studentRow) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Student record not found.' } }
  }
  const studentId = (studentRow as any).id as string

  const raw = {
    schedule_id: formData.get('schedule_id'),
    q1_score:    formData.get('q1_score'),
    q2_score:    formData.get('q2_score'),
    q3_score:    formData.get('q3_score'),
    comment:     formData.get('comment') || undefined,
  }

  const parsed = feedbackSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  // Verify the session exists and is completed
  const { data: sessRow } = await db
    .from('schedules')
    .select('id, status')
    .eq('id', d.schedule_id)
    .maybeSingle()

  if (!sessRow) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Session not found.' } }
  }
  if ((sessRow as any).status !== 'completed') {
    return { success: false, error: { code: 'VALIDATION', message: 'Feedback can only be submitted for completed sessions.' } }
  }

  // Idempotent insert — UNIQUE constraint prevents duplicates
  const { error } = await db.from('session_feedback').insert({
    schedule_id: d.schedule_id,
    student_id:  studentId,
    q1_score:    d.q1_score,
    q2_score:    d.q2_score,
    q3_score:    d.q3_score,
    comment:     d.comment || null,
  })

  if (error) {
    if (error.code === '23505') {
      // Duplicate — already submitted
      return { success: false, error: { code: 'DUPLICATE', message: 'You have already submitted feedback for this session.' } }
    }
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  return { success: true, data: undefined }
}
