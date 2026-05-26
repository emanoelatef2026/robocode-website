'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import type { ActionResult } from '@/types/app'

const gradeSchema = z.object({
  submission_id:   z.string().uuid(),
  assignment_id:   z.string().uuid(),
  score:           z.coerce.number().min(0).max(10000).optional(),
  feedback:        z.string().optional().or(z.literal('')),
  public_feedback: z.string().optional().or(z.literal('')),
  status:          z.enum(['submitted', 'under_review', 'graded', 'returned', 'resubmission_requested', 'resubmitted']),
  rubric_scores:   z.string().optional().or(z.literal('')),
  portfolio_visible: z.string().optional().transform((v) => v === 'on' || v === 'true'),
})

export async function gradeSubmission(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePermission('grade_assignments')
  const db   = createServiceClient()

  const raw = {
    submission_id:    formData.get('submission_id'),
    assignment_id:    formData.get('assignment_id'),
    score:            formData.get('score') || undefined,
    feedback:         formData.get('feedback') || undefined,
    public_feedback:  formData.get('public_feedback') || undefined,
    status:           formData.get('status'),
    rubric_scores:    formData.get('rubric_scores') || undefined,
    portfolio_visible: formData.get('portfolio_visible'),
  }

  const parsed = gradeSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  let rubric_scores: Record<string, number> = {}
  if (d.rubric_scores) {
    try { rubric_scores = JSON.parse(d.rubric_scores) } catch { /* keep empty */ }
  }

  const { error } = await db
    .from('submissions')
    .update({
      score:             d.score ?? null,
      feedback:          d.feedback || null,
      public_feedback:   d.public_feedback || null,
      status:            d.status,
      rubric_scores,
      graded_by:         user.id,
      graded_at:         new Date().toISOString(),
      portfolio_visible: d.portfolio_visible,
    })
    .eq('id', d.submission_id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'grade',
    p_entity_type:  'submission',
    p_entity_id:    d.submission_id,
    p_new_values:   { score: d.score, status: d.status },
  })

  revalidatePath(`/admin/assignments/${d.assignment_id}`)
  revalidatePath(`/admin/assignments/${d.assignment_id}/submissions/${d.submission_id}`)
  return { success: true, data: undefined }
}
