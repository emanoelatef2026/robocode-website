'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, requireAuth } from '@/modules/rbac/guards'
import { getInstructorByUserId } from './queries'
import { resolveGroupProgressContext } from '@/modules/progress/resolve'
import { safeRecalcProgressBatch, buildBatchTuples } from '@/modules/progress/safe-recalc'
import type { ActionResult } from '@/types/app'

// ── Session CRUD ──────────────────────────────────────────────────────────────

const sessionSchema = z.object({
  group_course_id:  z.string().uuid(),
  branch_id:        z.string().uuid(),
  group_id:         z.string().uuid(),
  scheduled_at:     z.string().min(1),
  duration_minutes: z.coerce.number().int().min(1).max(480),
  type:             z.enum(['regular', 'makeup', 'exam', 'event']).default('regular'),
  delivery:         z.enum(['online', 'offline', 'hybrid']).optional().or(z.literal('')),
  meeting_url:      z.string().optional().or(z.literal('')),
  room:             z.string().optional().or(z.literal('')),
  topic:            z.string().optional().or(z.literal('')),
})

export async function createSession(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ sessionId: string }>> {
  const user       = await requirePermission('manage_attendance')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }
  }

  const raw = {
    group_course_id:  formData.get('group_course_id'),
    branch_id:        formData.get('branch_id'),
    group_id:         formData.get('group_id'),
    scheduled_at:     formData.get('scheduled_at'),
    duration_minutes: formData.get('duration_minutes'),
    type:             formData.get('type') || 'regular',
    delivery:         formData.get('delivery') || undefined,
    meeting_url:      formData.get('meeting_url') || undefined,
    room:             formData.get('room') || undefined,
    topic:            formData.get('topic') || undefined,
  }

  const parsed = sessionSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d  = parsed.data
  const db = createServiceClient()

  // Verify instructor owns this group_course
  const { data: gcRow } = await db
    .from('group_courses')
    .select('id')
    .eq('id', d.group_course_id)
    .eq('instructor_id', instructor.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!gcRow) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You are not assigned to this group.' } }
  }

  const { data: schedule, error: schedErr } = await db
    .from('schedules')
    .insert({
      group_course_id:  d.group_course_id,
      branch_id:        d.branch_id,
      scheduled_at:     new Date(d.scheduled_at).toISOString(),
      duration_minutes: d.duration_minutes,
      type:             d.type,
      delivery:         d.delivery   || null,
      meeting_url:      d.meeting_url || null,
      room:             d.room        || null,
      topic:            d.topic       || null,
      status:           'scheduled',
      created_by:       user.id,
    })
    .select('id')
    .single()

  if (schedErr || !schedule) {
    return { success: false, error: { code: 'DB_ERROR', message: schedErr?.message ?? 'Failed to create session.' } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'session.create',
    p_entity_type:  'schedule',
    p_entity_id:    schedule.id,
    p_new_values:   { group_course_id: d.group_course_id, scheduled_at: d.scheduled_at },
    p_branch_id:    d.branch_id,
  })

  revalidatePath(`/portal/instructor/groups/${d.group_id}`)
  return { success: true, data: { sessionId: schedule.id } }
}

const updateSessionSchema = z.object({
  session_id:       z.string().uuid(),
  group_id:         z.string().uuid(),
  status:           z.enum(['scheduled', 'ongoing', 'completed', 'cancelled']),
  topic:            z.string().optional().or(z.literal('')),
  notes:            z.string().optional().or(z.literal('')),
  meeting_url:      z.string().optional().or(z.literal('')),
  room:             z.string().optional().or(z.literal('')),
  duration_minutes: z.coerce.number().int().min(1).max(480).optional(),
})

export async function updateSession(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user       = await requirePermission('manage_attendance')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }
  }

  const raw = {
    session_id:       formData.get('session_id'),
    group_id:         formData.get('group_id'),
    status:           formData.get('status'),
    topic:            formData.get('topic')   || undefined,
    notes:            formData.get('notes')   || undefined,
    meeting_url:      formData.get('meeting_url') || undefined,
    room:             formData.get('room')     || undefined,
    duration_minutes: formData.get('duration_minutes') || undefined,
  }

  const parsed = updateSessionSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d  = parsed.data
  const db = createServiceClient()

  // Verify instructor owns this session's group_course
  const { data: sessRow } = await db
    .from('schedules')
    .select(
      `id, branch_id,
       group_courses!schedules_group_course_id_fkey(instructor_id)`
    )
    .eq('id', d.session_id)
    .single()

  if (!sessRow) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Session not found.' } }
  }

  const gc = (sessRow as any).group_courses
  if (gc?.instructor_id !== instructor.id) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You are not assigned to this session.' } }
  }

  const updates: Record<string, unknown> = { status: d.status }
  if (d.topic            !== undefined) updates.topic            = d.topic        || null
  if (d.notes            !== undefined) updates.notes            = d.notes        || null
  if (d.meeting_url      !== undefined) updates.meeting_url      = d.meeting_url  || null
  if (d.room             !== undefined) updates.room             = d.room         || null
  if (d.duration_minutes !== undefined) updates.duration_minutes = d.duration_minutes

  const { error: updateErr } = await db.from('schedules').update(updates).eq('id', d.session_id)
  if (updateErr) {
    return { success: false, error: { code: 'DB_ERROR', message: updateErr.message } }
  }

  revalidatePath(`/portal/instructor/groups/${d.group_id}`)
  revalidatePath(`/portal/instructor/groups/${d.group_id}/sessions/${d.session_id}`)
  return { success: true, data: undefined }
}

// ── Attendance ────────────────────────────────────────────────────────────────

export async function saveAttendance(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user       = await requirePermission('manage_attendance')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }
  }

  const sessionId  = formData.get('session_id') as string
  const groupId    = formData.get('group_id')   as string
  const studentIds = formData.getAll('student_ids[]') as string[]

  if (!sessionId || !groupId || studentIds.length === 0) {
    return { success: false, error: { code: 'VALIDATION', message: 'Session, group, and students are required.' } }
  }

  const db = createServiceClient()

  // Verify instructor owns this session
  const { data: sessRow } = await db
    .from('schedules')
    .select(
      `id, branch_id,
       group_courses!schedules_group_course_id_fkey(instructor_id)`
    )
    .eq('id', sessionId)
    .single()

  if (!sessRow) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Session not found.' } }
  }

  const gc = (sessRow as any).group_courses
  if (gc?.instructor_id !== instructor.id) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You are not assigned to this session.' } }
  }

  // Validate students belong to the group
  const { data: validMembers } = await db
    .from('group_students')
    .select('student_id')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .in('student_id', studentIds)

  const validSet     = new Set((validMembers ?? []).map((m: any) => m.student_id as string))
  const safeStudents = studentIds.filter((sid) => validSet.has(sid))

  if (safeStudents.length === 0) {
    return { success: false, error: { code: 'VALIDATION', message: 'No valid group members in submission.' } }
  }

  // Build upsert records
  type AttRecord = {
    schedule_id:   string
    student_id:    string
    status:        string
    late_minutes:  number | null
    notes:         string | null
    recorded_by:   string
    recorded_at:   string
  }
  const records: AttRecord[] = safeStudents.map((sid) => ({
    schedule_id:  sessionId,
    student_id:   sid,
    status:       (formData.get(`status_${sid}`) as string) || 'absent',
    late_minutes: Number(formData.get(`late_minutes_${sid}`) || 0) || null,
    notes:        (formData.get(`notes_${sid}`) as string | null) || null,
    recorded_by:  user.id,
    recorded_at:  new Date().toISOString(),
  }))

  const { error: upsertErr } = await db
    .from('attendance_records')
    .upsert(records, { onConflict: 'schedule_id,student_id' })

  if (upsertErr) {
    return { success: false, error: { code: 'DB_ERROR', message: upsertErr.message } }
  }

  // Mark session completed if it was just attended
  await db
    .from('schedules')
    .update({ status: 'completed' })
    .eq('id', sessionId)
    .eq('status', 'scheduled')

  // Recalculate progress
  const contexts = await resolveGroupProgressContext(groupId)
  if (contexts.length > 0) {
    await safeRecalcProgressBatch(
      buildBatchTuples(safeStudents, contexts),
      'saveAttendance'
    )
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'record_attendance',
    p_entity_type:  'schedule',
    p_entity_id:    sessionId,
    p_new_values:   { student_count: records.length },
    p_branch_id:    (sessRow as any).branch_id,
  })

  revalidatePath(`/portal/instructor/groups/${groupId}/sessions/${sessionId}`)
  return { success: true, data: undefined }
}

// ── Student Notes ─────────────────────────────────────────────────────────────

const noteSchema = z.object({
  student_id:  z.string().uuid(),
  group_id:    z.string().uuid(),
  content:     z.string().min(1, 'Note content is required'),
  is_private:  z.string().optional().transform((v) => v !== 'false'),
  schedule_id: z.string().uuid().optional().or(z.literal('')),
})

export async function createStudentNote(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ noteId: string }>> {
  const user = await requireAuth()
  const db   = createServiceClient()

  const raw = {
    student_id:  formData.get('student_id'),
    group_id:    formData.get('group_id'),
    content:     formData.get('content'),
    is_private:  formData.get('is_private') as string | undefined,
    schedule_id: formData.get('schedule_id') || undefined,
  }

  const parsed = noteSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  // Verify user is an instructor with access to this student's group
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }
  }

  const { data: gcRow } = await db
    .from('group_courses')
    .select('id')
    .eq('group_id', d.group_id)
    .eq('instructor_id', instructor.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!gcRow) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You are not assigned to this group.' } }
  }

  const { data: note, error: noteErr } = await db
    .from('student_notes')
    .insert({
      student_id:  d.student_id,
      author_id:   user.id,
      content:     d.content,
      is_private:  d.is_private,
      schedule_id: d.schedule_id || null,
    })
    .select('id')
    .single()

  if (noteErr || !note) {
    return { success: false, error: { code: 'DB_ERROR', message: noteErr?.message ?? 'Failed to save note.' } }
  }

  revalidatePath(`/portal/instructor/groups/${d.group_id}/students/${d.student_id}`)
  return { success: true, data: { noteId: (note as any).id } }
}

const updateNoteSchema = z.object({
  note_id:     z.string().uuid(),
  student_id:  z.string().uuid(),
  group_id:    z.string().uuid(),
  content:     z.string().min(1, 'Note content is required'),
  is_private:  z.string().optional().transform((v) => v !== 'false'),
})

export async function updateStudentNote(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  const db   = createServiceClient()

  const raw = {
    note_id:    formData.get('note_id'),
    student_id: formData.get('student_id'),
    group_id:   formData.get('group_id'),
    content:    formData.get('content'),
    is_private: formData.get('is_private') as string | undefined,
  }

  const parsed = updateNoteSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  // Only author can update — enforced by filtering on author_id
  const { error: updateErr } = await db
    .from('student_notes')
    .update({ content: d.content, is_private: d.is_private })
    .eq('id', d.note_id)
    .eq('author_id', user.id)

  if (updateErr) {
    return { success: false, error: { code: 'DB_ERROR', message: updateErr.message } }
  }

  revalidatePath(`/portal/instructor/groups/${d.group_id}/students/${d.student_id}`)
  return { success: true, data: undefined }
}

export async function deleteStudentNote(formData: FormData): Promise<ActionResult<void>> {
  const user = await requireAuth()
  const db   = createServiceClient()

  const noteId   = formData.get('note_id')   as string
  const studentId = formData.get('student_id') as string
  const groupId   = formData.get('group_id')   as string

  if (!noteId || !studentId || !groupId) {
    return { success: false, error: { code: 'VALIDATION', message: 'Missing required fields.' } }
  }

  const { error } = await db
    .from('student_notes')
    .delete()
    .eq('id', noteId)
    .eq('author_id', user.id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  revalidatePath(`/portal/instructor/groups/${groupId}/students/${studentId}`)
  return { success: true, data: undefined }
}
