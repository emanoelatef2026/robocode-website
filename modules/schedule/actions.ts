'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { createScheduleSchema, updateScheduleSchema } from './schemas'
import type { ActionResult } from '@/types/app'

function validReturnTo(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null
  if (raw.startsWith('/admin/') || raw.startsWith('/portal/team-leader/')) return raw
  return null
}

export async function createSchedule(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const raw = {
    group_course_id:  formData.get('group_course_id'),
    branch_id:        formData.get('branch_id'),
    scheduled_at:     formData.get('scheduled_at'),
    duration_minutes: formData.get('duration_minutes'),
    type:             formData.get('type') || 'regular',
    delivery:         formData.get('delivery') || undefined,
    meeting_url:      formData.get('meeting_url') || undefined,
    room:             formData.get('room') || undefined,
    topic:            formData.get('topic'),
  }

  const parsed = createScheduleSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const user = await requirePermission('manage_schedule', { branchId: parsed.data.branch_id })
  const db   = createServiceClient()

  const { group_course_id, branch_id, scheduled_at, duration_minutes, type, delivery, meeting_url, room, topic } = parsed.data

  const { data: schedule, error } = await db
    .from('schedules')
    .insert({
      group_course_id,
      branch_id,
      scheduled_at,
      duration_minutes,
      type,
      delivery:    delivery || null,
      meeting_url: meeting_url || null,
      room:        room || null,
      topic:       topic.trim(),
      status:      'scheduled',
      created_by:  user.id,
    })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'schedule',
    p_entity_id:    schedule.id,
    p_new_values:   { group_course_id, branch_id, scheduled_at, type },
    p_branch_id:    branch_id,
  })

  const returnTo = validReturnTo(formData.get('_return_to'))
  revalidatePath('/admin')
  revalidatePath('/portal/team-leader')
  redirect(returnTo ?? '/admin')
}

export async function updateSchedule(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_schedule')
  const db   = createServiceClient()

  const raw = {
    id:                  formData.get('id'),
    scheduled_at:        formData.get('scheduled_at') || undefined,
    duration_minutes:    formData.get('duration_minutes') || undefined,
    type:                formData.get('type') || undefined,
    delivery:            formData.get('delivery') || undefined,
    meeting_url:         formData.get('meeting_url') || undefined,
    room:                formData.get('room') || undefined,
    status:              formData.get('status') || undefined,
    cancellation_reason: formData.get('cancellation_reason') || undefined,
    topic:               formData.get('topic') || undefined,
    notes:               formData.get('notes') || undefined,
  }

  const parsed = updateScheduleSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { id, ...rest } = parsed.data
  const updates: Record<string, unknown> = {}

  if (rest.scheduled_at)        updates.scheduled_at        = rest.scheduled_at
  if (rest.duration_minutes)    updates.duration_minutes    = rest.duration_minutes
  if (rest.type)                updates.type                = rest.type
  if (rest.delivery !== undefined) updates.delivery         = rest.delivery || null
  if (rest.meeting_url !== undefined) updates.meeting_url   = rest.meeting_url || null
  if (rest.room !== undefined)  updates.room                = rest.room || null
  if (rest.status)              updates.status              = rest.status
  if (rest.cancellation_reason !== undefined) updates.cancellation_reason = rest.cancellation_reason || null
  if (rest.topic !== undefined) updates.topic               = rest.topic || null
  if (rest.notes !== undefined) updates.notes               = rest.notes || null

  const { error } = await db.from('schedules').update(updates).eq('id', id)
  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'schedule',
    p_entity_id:    id,
    p_new_values:   updates,
  })

  const returnTo = validReturnTo(formData.get('_return_to'))
  revalidatePath('/admin')
  revalidatePath('/portal/team-leader')
  redirect(returnTo ?? '/admin')
}
