'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, requireAuth } from '@/modules/rbac/guards'
import { getInstructorByUserId } from './queries'
import { resolveGroupProgressContext } from '@/modules/progress/resolve'
import { safeRecalcProgressBatch, buildBatchTuples } from '@/modules/progress/safe-recalc'
import type { ActionResult } from '@/types/app'

// ── Auth helpers ──────────────────────────────────────────────────────────────

// Returns true if instructor is directly assigned to the group_course OR is in group_instructors for the group.
async function hasGroupCourseAccess(
  groupCourseId: string,
  instructorId:  string,
  db:            ReturnType<typeof createServiceClient>
): Promise<boolean> {
  const { data: gcRow } = await db
    .from('group_courses')
    .select('group_id, instructor_id')
    .eq('id', groupCourseId)
    .eq('status', 'active')
    .maybeSingle()

  if (!gcRow) return false
  if ((gcRow as any).instructor_id === instructorId) return true

  const { data: giRow } = await db
    .from('group_instructors')
    .select('id')
    .eq('group_id', (gcRow as any).group_id)
    .eq('instructor_id', instructorId)
    .maybeSingle()

  return !!giRow
}

// Returns group context if instructor has session access, null otherwise.
async function getSessionAccessContext(
  sessionId:    string,
  instructorId: string,
  db:           ReturnType<typeof createServiceClient>
): Promise<{ groupId: string; branchId: string } | null> {
  const { data: sessRow } = await db
    .from('schedules')
    .select('id, branch_id, group_courses!schedules_group_course_id_fkey(group_id, instructor_id)')
    .eq('id', sessionId)
    .maybeSingle()

  if (!sessRow) return null
  const gc      = (sessRow as any).group_courses
  const groupId = gc?.group_id  as string
  const branchId= (sessRow as any).branch_id as string

  if (gc?.instructor_id === instructorId) return { groupId, branchId }

  const { data: giRow } = await db
    .from('group_instructors')
    .select('id')
    .eq('group_id', groupId ?? '')
    .eq('instructor_id', instructorId)
    .maybeSingle()

  return giRow ? { groupId, branchId } : null
}

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

  const allowed = await hasGroupCourseAccess(d.group_course_id, instructor.id, db)
  if (!allowed) {
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
    p_action:       'session.schedule',
    p_entity_type:  'schedule',
    p_entity_id:    schedule.id,
    p_new_values:   { group_course_id: d.group_course_id, scheduled_at: d.scheduled_at },
    p_branch_id:    d.branch_id,
  })

  revalidatePath(`/portal/instructor/groups/${d.group_id}`)
  redirect(`/portal/instructor/groups/${d.group_id}/sessions/${schedule.id}`)
}

// ── Start Session directly from group page ────────────────────────────────────
// Creates a session immediately with status='ongoing', started_at=now.

export async function startGroupSession(
  groupCourseId: string,
  groupId:       string,
  branchId:      string
): Promise<ActionResult<{ sessionId: string }>> {
  const user       = await requirePermission('manage_attendance')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }
  }

  const db = createServiceClient()

  const allowed = await hasGroupCourseAccess(groupCourseId, instructor.id, db)
  if (!allowed) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You are not assigned to this group.' } }
  }

  const now = new Date().toISOString()

  const { data: schedule, error } = await db
    .from('schedules')
    .insert({
      group_course_id:  groupCourseId,
      branch_id:        branchId,
      scheduled_at:     now,
      started_at:       now,
      duration_minutes: 90,
      type:             'regular',
      status:           'ongoing',
      created_by:       user.id,
    })
    .select('id')
    .single()

  if (error || !schedule) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to start session.' } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'session.start_direct',
    p_entity_type:  'schedule',
    p_entity_id:    (schedule as any).id,
    p_new_values:   { group_course_id: groupCourseId, started_at: now },
    p_branch_id:    branchId,
  })

  revalidatePath(`/portal/instructor/groups/${groupId}`)
  return { success: true, data: { sessionId: (schedule as any).id } }
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
    topic:            formData.get('topic')        || undefined,
    notes:            formData.get('notes')        || undefined,
    meeting_url:      formData.get('meeting_url')  || undefined,
    room:             formData.get('room')         || undefined,
    duration_minutes: formData.get('duration_minutes') || undefined,
  }

  const parsed = updateSessionSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d  = parsed.data
  const db = createServiceClient()

  const ctx = await getSessionAccessContext(d.session_id, instructor.id, db)
  if (!ctx) {
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

// ── Session lifecycle: start / end ───────────────────────────────────────────

export async function startSession(
  sessionId: string,
  groupId:   string
): Promise<ActionResult<void>> {
  const user       = await requirePermission('manage_attendance')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }
  }

  const db = createServiceClient()

  const { data: sessRow } = await db
    .from('schedules')
    .select('id, status')
    .eq('id', sessionId)
    .single()

  if (!sessRow) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Session not found.' } }
  }

  const ctx = await getSessionAccessContext(sessionId, instructor.id, db)
  if (!ctx) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You are not assigned to this session.' } }
  }

  if ((sessRow as any).status === 'ongoing') {
    return { success: false, error: { code: 'VALIDATION', message: 'Session is already in progress.' } }
  }
  if ((sessRow as any).status === 'completed') {
    return { success: false, error: { code: 'VALIDATION', message: 'Session is already completed.' } }
  }

  const { error } = await db
    .from('schedules')
    .update({ status: 'ongoing', started_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  revalidatePath(`/portal/instructor/groups/${groupId}`)
  revalidatePath(`/portal/instructor/groups/${groupId}/sessions/${sessionId}`)
  return { success: true, data: undefined }
}

export async function endSession(
  sessionId: string,
  groupId:   string,
  force     = false
): Promise<ActionResult<void>> {
  const user       = await requirePermission('manage_attendance')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }
  }

  const db = createServiceClient()

  const { data: sessRow } = await db
    .from('schedules')
    .select('id, status, topic, notes, branch_id, group_courses!schedules_group_course_id_fkey(group_id)')
    .eq('id', sessionId)
    .single()

  if (!sessRow) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Session not found.' } }
  }

  const ctx = await getSessionAccessContext(sessionId, instructor.id, db)
  if (!ctx) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You are not assigned to this session.' } }
  }

  if ((sessRow as any).status === 'completed') {
    return { success: false, error: { code: 'VALIDATION', message: 'Session is already completed.' } }
  }
  if ((sessRow as any).status === 'cancelled') {
    return { success: false, error: { code: 'VALIDATION', message: 'Session is cancelled.' } }
  }

  if (!force) {
    const gcGroupId = ctx.groupId
    const [studRes, attRes] = await Promise.all([
      db.from('group_students').select('student_id', { count: 'exact', head: true })
        .eq('group_id', gcGroupId).eq('status', 'active'),
      db.from('attendance_records').select('student_id', { count: 'exact', head: true })
        .eq('schedule_id', sessionId).not('status', 'is', null),
    ])

    const totalStudents  = studRes.count ?? 0
    const markedStudents = attRes.count  ?? 0
    const attendanceMissing = totalStudents - markedStudents
    const notesRequired = !(sessRow as any).topic && !(sessRow as any).notes

    if (attendanceMissing > 0 || notesRequired) {
      return {
        success: false,
        error: {
          code:    'VALIDATION',
          message: [
            attendanceMissing > 0 ? `${attendanceMissing} student${attendanceMissing > 1 ? 's' : ''} without attendance.` : '',
            notesRequired ? 'Session notes or topic required.' : '',
          ].filter(Boolean).join(' '),
        },
      }
    }
  }

  const { error } = await db
    .from('schedules')
    .update({ status: 'completed', ended_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'session.end',
    p_entity_type:  'schedule',
    p_entity_id:    sessionId,
    p_new_values:   { ended_at: new Date().toISOString(), force },
    p_branch_id:    ctx.branchId,
  })

  revalidatePath(`/portal/instructor/groups/${groupId}`)
  revalidatePath(`/portal/instructor/groups/${groupId}/sessions/${sessionId}`)
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

  const db  = createServiceClient()
  const ctx = await getSessionAccessContext(sessionId, instructor.id, db)
  if (!ctx) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You are not assigned to this session.' } }
  }

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
    p_branch_id:    ctx.branchId,
  })

  revalidatePath(`/portal/instructor/groups/${groupId}/sessions/${sessionId}`)
  return { success: true, data: undefined }
}

// ── Recording management ──────────────────────────────────────────────────────

const PROVIDERS = ['google_drive', 'youtube', 'vimeo', 'zoom', 'other'] as const
type Provider = typeof PROVIDERS[number]

function detectProvider(url: string): Provider {
  if (url.includes('drive.google.com') || url.includes('docs.google.com')) return 'google_drive'
  if (url.includes('youtube.com') || url.includes('youtu.be'))             return 'youtube'
  if (url.includes('vimeo.com'))                                            return 'vimeo'
  if (url.includes('zoom.us'))                                              return 'zoom'
  return 'other'
}

const addRecordingSchema = z.object({
  session_id:   z.string().uuid(),
  group_id:     z.string().uuid(),
  external_url: z.string().url('Enter a valid URL'),
  title:        z.string().optional().or(z.literal('')),
})

export async function addSessionRecording(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user       = await requirePermission('manage_attendance')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }
  }

  const raw = {
    session_id:   formData.get('session_id'),
    group_id:     formData.get('group_id'),
    external_url: formData.get('external_url'),
    title:        formData.get('title') || undefined,
  }

  const parsed = addRecordingSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d  = parsed.data
  const db = createServiceClient()

  const ctx = await getSessionAccessContext(d.session_id, instructor.id, db)
  if (!ctx) return { success: false, error: { code: 'FORBIDDEN', message: 'You are not assigned to this session.' } }

  const { data: rec, error } = await db
    .from('session_recordings')
    .insert({
      schedule_id:          d.session_id,
      branch_id:            ctx.branchId,
      external_url:         d.external_url,
      title:                d.title || null,
      provider:             detectProvider(d.external_url),
      recorded_by:          user.id,
      visible_to_students:  true,
      visible_to_parents:   false,
    })
    .select('id')
    .single()

  if (error || !rec) return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to add recording.' } }

  revalidatePath(`/portal/instructor/groups/${d.group_id}/sessions/${d.session_id}`)
  return { success: true, data: { id: (rec as any).id } }
}

export async function removeSessionRecording(
  recordingId: string,
  sessionId:   string,
  groupId:     string
): Promise<ActionResult<void>> {
  const user       = await requirePermission('manage_attendance')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }

  const db = createServiceClient()
  const { error } = await db.from('session_recordings').delete().eq('id', recordingId).eq('recorded_by', user.id)
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath(`/portal/instructor/groups/${groupId}/sessions/${sessionId}`)
  return { success: true, data: undefined }
}

// ── Session resources ─────────────────────────────────────────────────────────

const resourcesSchema = z.object({
  session_id:      z.string().uuid(),
  group_id:        z.string().uuid(),
  resources_json:  z.string(),
})

export async function updateSessionResources(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user       = await requirePermission('manage_attendance')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }

  const raw = {
    session_id:     formData.get('session_id'),
    group_id:       formData.get('group_id'),
    resources_json: formData.get('resources_json'),
  }

  const parsed = resourcesSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }

  const d  = parsed.data
  const db = createServiceClient()

  const ctx = await getSessionAccessContext(d.session_id, instructor.id, db)
  if (!ctx) return { success: false, error: { code: 'FORBIDDEN', message: 'You are not assigned to this session.' } }

  let resources: unknown[]
  try { resources = JSON.parse(d.resources_json) } catch { return { success: false, error: { code: 'VALIDATION', message: 'Invalid resources format.' } } }

  const { error } = await db.from('schedules').update({ resources_links: resources }).eq('id', d.session_id)
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath(`/portal/instructor/groups/${d.group_id}/sessions/${d.session_id}`)
  return { success: true, data: undefined }
}

// ── Quick homework from session ───────────────────────────────────────────────

const homeworkSchema = z.object({
  session_id:  z.string().uuid(),
  group_id:    z.string().uuid(),
  module_id:   z.string().uuid(),
  title:       z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional().or(z.literal('')),
  due_at:      z.string().optional().or(z.literal('')),
})

export async function createSessionHomework(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ assignmentId: string }>> {
  const user       = await requirePermission('manage_courses')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }

  const raw = {
    session_id:  formData.get('session_id'),
    group_id:    formData.get('group_id'),
    module_id:   formData.get('module_id'),
    title:       formData.get('title'),
    description: formData.get('description') || undefined,
    due_at:      formData.get('due_at') || undefined,
  }

  const parsed = homeworkSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }

  const d  = parsed.data
  const db = createServiceClient()

  const ctx = await getSessionAccessContext(d.session_id, instructor.id, db)
  if (!ctx) return { success: false, error: { code: 'FORBIDDEN', message: 'You are not assigned to this session.' } }

  const { data: assignment, error } = await db
    .from('assignments')
    .insert({
      module_id:            d.module_id,
      schedule_id:          d.session_id,
      title:                d.title,
      description:          d.description || null,
      type:                 'homework',
      submission_type:      'text',
      max_score:            100,
      due_at:               d.due_at ? new Date(d.due_at).toISOString() : null,
      status:               'published',
      allow_late:           true,
      resubmission_allowed: true,
      max_resubmissions:    1,
      portfolio_eligible:   false,
      rubric:               [],
      created_by:           user.id,
    })
    .select('id')
    .single()

  if (error || !assignment) return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to create homework.' } }

  revalidatePath(`/portal/instructor/groups/${d.group_id}/sessions/${d.session_id}`)
  revalidatePath('/portal/instructor/homework')
  return { success: true, data: { assignmentId: (assignment as any).id } }
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

  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }
  }

  // Verify access (group_courses OR group_instructors)
  const { data: gcRow } = await db
    .from('group_courses')
    .select('id')
    .eq('group_id', d.group_id)
    .eq('instructor_id', instructor.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!gcRow) {
    const { data: giRow } = await db
      .from('group_instructors')
      .select('group_id')
      .eq('group_id', d.group_id)
      .eq('instructor_id', instructor.id)
      .maybeSingle()
    if (!giRow) {
      return { success: false, error: { code: 'FORBIDDEN', message: 'You are not assigned to this group.' } }
    }
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
  note_id:    z.string().uuid(),
  student_id: z.string().uuid(),
  group_id:   z.string().uuid(),
  content:    z.string().min(1, 'Note content is required'),
  is_private: z.string().optional().transform((v) => v !== 'false'),
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

  const noteId    = formData.get('note_id')    as string
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
