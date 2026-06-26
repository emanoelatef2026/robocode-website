'use server'

import { createServiceClient }           from '@/lib/supabase/service'
import { requirePortalRole }             from '@/modules/rbac/guards'
import { revalidatePath }                from 'next/cache'
import type { MessageStatus }            from './constants'
import { submitParentMessageSchema, updateMessageStatusSchema } from './schemas'

// ── Submit a new parent message (with optional image upload) ──────────────────

export async function submitParentMessage(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requirePortalRole('parent')
    const db   = createServiceClient()

    const parsed = submitParentMessageSchema.safeParse({
      category:   (formData.get('category')   as string | null)?.trim(),
      message:    (formData.get('message')    as string | null)?.trim(),
      student_id: (formData.get('student_id') as string | null)?.trim(),
    })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message }
    }
    const { category, message, student_id: studentId } = parsed.data

    const file = formData.get('image') as File | null

    // Verify parent → student link
    const { data: parentRow } = await db
      .from('parents').select('id').eq('user_id', user.id).maybeSingle()
    const parentId = (parentRow as { id: string } | null)?.id ?? null
    if (!parentId) return { success: false, error: 'Parent record not found.' }

    const { data: link } = await db
      .from('parent_students')
      .select('student_id')
      .eq('parent_id', parentId)
      .eq('student_id', studentId)
      .maybeSingle()
    if (!link) return { success: false, error: 'Not authorized for this student.' }

    // Get student's branch
    const { data: studentRow } = await db
      .from('students').select('branch_id').eq('id', studentId).maybeSingle()
    const branchId = (studentRow as { branch_id: string } | null)?.branch_id ?? null
    if (!branchId) return { success: false, error: 'Student branch not found.' }

    // Upload image if present
    let imageUrl: string | null = null
    if (file && file.size > 0) {
      const ext      = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const allowed  = ['jpg', 'jpeg', 'png', 'webp', 'gif']
      if (!allowed.includes(ext)) return { success: false, error: 'Only image files are allowed.' }
      if (file.size > 5 * 1024 * 1024) return { success: false, error: 'Image must be under 5 MB.' }

      const path = `parent-messages/${user.id}/${Date.now()}.${ext}`
      const arrayBuffer = await file.arrayBuffer()
      const { error: upErr } = await db.storage
        .from('portfolio-images')
        .upload(path, new Uint8Array(arrayBuffer), {
          contentType: file.type,
          upsert:      false,
        })
      if (upErr) return { success: false, error: `Image upload failed: ${upErr.message}` }

      const { data: urlData } = db.storage.from('portfolio-images').getPublicUrl(path)
      imageUrl = urlData.publicUrl
    }

    // Insert message
    const { error } = await db.from('parent_messages').insert({
      parent_user_id: user.id,
      student_id:     studentId,
      branch_id:      branchId,
      category,
      message,
      image_url:      imageUrl,
    })

    if (error) return { success: false, error: error.message }

    revalidatePath('/portal/parent/feedback')
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Unexpected error.' }
  }
}

// ── TL: update message status + internal note ─────────────────────────────────

export async function updateMessageStatus(
  messageId:    string,
  status:       MessageStatus,
  internalNote: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = updateMessageStatusSchema.safeParse({ messageId, status, internalNote })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message }
    }

    const user = await requirePortalRole('team_leader')
    const db   = createServiceClient()

    // Verify message belongs to TL's branch
    const { data: msg } = await db
      .from('parent_messages')
      .select('branch_id')
      .eq('id', parsed.data.messageId)
      .maybeSingle()

    if (!msg) return { success: false, error: 'Message not found.' }

    if (!user.branchIds.includes((msg as { branch_id: string }).branch_id)) {
      return { success: false, error: 'Not authorized for this message.' }
    }

    const { error } = await db
      .from('parent_messages')
      .update({
        status:        parsed.data.status,
        internal_note: parsed.data.internalNote.trim() || null,
      })
      .eq('id', parsed.data.messageId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/portal/team-leader/parent-feedback')
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Unexpected error.' }
  }
}
