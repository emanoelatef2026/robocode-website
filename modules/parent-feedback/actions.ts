'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { requirePortalRole }   from '@/modules/rbac/guards'
import { revalidatePath }      from 'next/cache'

export interface SubmitParentFeedbackInput {
  student_id:        string
  session_milestone: number
  q1_yes:            boolean
  q2_yes:            boolean
  q3_yes:            boolean
  q4_yes:            boolean
  rating:            number
  notes?:            string
}

export async function submitParentFeedback(
  input: SubmitParentFeedbackInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requirePortalRole('parent')
    const db   = createServiceClient()

    // Resolve parent record
    const { data: parentRow } = await db
      .from('parents')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    const parentId = (parentRow as { id: string } | null)?.id ?? null
    if (!parentId) return { success: false, error: 'Parent record not found.' }

    // Verify this parent is linked to the student
    const { data: link } = await db
      .from('parent_students')
      .select('student_id')
      .eq('parent_id', parentId)
      .eq('student_id', input.student_id)
      .maybeSingle()
    if (!link) return { success: false, error: 'Not authorized for this student.' }

    // Validate rating
    if (input.rating < 1 || input.rating > 5) return { success: false, error: 'Invalid rating.' }

    // Validate milestone
    if (input.session_milestone <= 0 || input.session_milestone % 6 !== 0) {
      return { success: false, error: 'Invalid milestone.' }
    }

    // Upsert feedback (prevent duplicate)
    const { error } = await db
      .from('parent_feedback')
      .insert({
        parent_id:         parentId,
        student_id:        input.student_id,
        session_milestone: input.session_milestone,
        q1_yes:            input.q1_yes,
        q2_yes:            input.q2_yes,
        q3_yes:            input.q3_yes,
        q4_yes:            input.q4_yes,
        rating:            input.rating,
        notes:             input.notes?.trim() || null,
      })

    if (error) {
      if (error.code === '23505') return { success: false, error: 'Feedback already submitted for this milestone.' }
      return { success: false, error: error.message }
    }

    revalidatePath('/portal/parent')
    revalidatePath('/portal/parent/feedback')
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Unexpected error.' }
  }
}
