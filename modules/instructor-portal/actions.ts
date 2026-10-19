'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { canEditSessionContent } from './session-content'
import { persistInstructorSession } from './session-lifecycle'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, requireAuth } from '@/modules/rbac/guards'
import { getInstructorByUserId } from './queries'
import { resolveGroupProgressContext } from '@/modules/progress/resolve'
import { safeRecalcProgressBatch, buildBatchTuples } from '@/modules/progress/safe-recalc'
import {
  validateSessionOwnership,
  canInstructorCreateNextSession,
} from '@/modules/academic/session-ownership'
import { validateAcademicTopic } from '@/modules/academic/constants'
import {
  deleteSessionStartingNotification,
  seedNewHomeworkAssignedNotification,
  seedNewSessionResourcesNotification,
} from '@/modules/notifications/actions'
import { getStudentUserId, getParentUserIdsForStudent } from '@/modules/notifications/queries'
import {
  createStudentNote as sharedCreateStudentNote,
  updateStudentNote as sharedUpdateStudentNote,
  deleteStudentNote as sharedDeleteStudentNote,
} from '@/modules/student-notes/actions'
import { createStudentEvaluation } from '@/modules/student-evaluations/actions'
import type { EvaluationCriterion } from '@/modules/student-evaluations/types'
import type { ActionResult } from '@/types/app'

// Statuses that count toward student attendance (XP, achievements).
// Distinct from SLOT_CONSUMING_STATUSES (enrollment billing) — excused/absent do not award XP.

// ── Auth helpers ──────────────────────────────────────────────────────────────

// Returns true if instructor is directly assigned to the group_course OR is in group_instructors
// AND their allocation is still active AND the next session falls within their range.
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
  const groupId = (gcRow as any).group_id as string

  const isPrimary = (gcRow as any).instructor_id === instructorId
  if (!isPrimary) {
    const { data: giRow } = await db
      .from('group_instructors')
      .select('group_id')
      .eq('group_id', groupId)
      .eq('instructor_id', instructorId)
      .maybeSingle()
    if (!giRow) return false
  }

  return true
}

// Returns group + branch context if the instructor can operate on the given session,
// applying both group-membership AND immutable allocation-range enforcement.
async function getSessionAccessContext(
  sessionId:    string,
  instructorId: string,
  db:           ReturnType<typeof createServiceClient>
): Promise<{ groupId: string; courseId: string | null; branchId: string } | null> {
  // Fetch branch_id in the same query (needed for audit logs)
  const { data: sessRow } = await db
    .from('schedules')
    .select('branch_id, group_courses!schedules_group_course_id_fkey(group_id, course_id)')
    .eq('id', sessionId)
    .maybeSingle()

  if (!sessRow) return null
  const branchId = (sessRow as any).branch_id as string
  const groupId  = (sessRow as any).group_courses?.group_id as string | undefined
  const courseId = (sessRow as any).group_courses?.course_id as string | null
  if (!groupId) return null

  // Ownership check (membership + allocation range + allocation_status)
  const check = await validateSessionOwnership(instructorId, sessionId, db)
  if (!check.allowed) return null

  return { groupId, courseId, branchId }
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
  topic:            z.string()
    .min(1, 'Topic is required for academic sessions')
    .refine(t => t.trim().length > 0, { message: 'Topic cannot be blank' })
    .refine(t => t.trim().toLowerCase() !== 'no topic', { message: '"No topic" is not a valid topic' }),
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
    topic:            formData.get('topic'),
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

  const rangeCheck = await canInstructorCreateNextSession(instructor.id, d.group_course_id, db)
  if (!rangeCheck.allowed) {
    return { success: false, error: { code: 'FORBIDDEN', message: rangeCheck.reason ?? 'Outside your allocated session range.' } }
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
      topic:            d.topic.trim(),
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
  groupCourseId: string, _groupId: string, _branchId: string, topic: string,
  expectedSession?: string | null, expectedPrevious?: string | null,
): Promise<ActionResult<{ sessionId: string }>> {
  const user = await requirePermission('manage_attendance')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }
  if (!z.string().uuid().safeParse(groupCourseId).success || !validateAcademicTopic(topic)) {
    return { success: false, error: { code: 'VALIDATION', message: 'Valid group course and topic are required.' } }
  }
  if (expectedSession === undefined || expectedPrevious === undefined) return { success: false, error: { code: 'VALIDATION', message: 'Refresh the session list before starting a class.' } }
  const { data, error } = await createServiceClient().rpc('open_shared_instructor_session', {
    p_actor: user.id, p_instructor: instructor.id, p_course: groupCourseId, p_topic: topic,
    p_expected_session: expectedSession, p_expected_previous: expectedPrevious,
  })
  if (error || !data?.sessionId) return { success: false, error: {
    code: error?.code === '42501' ? 'FORBIDDEN' : error?.code === '22023' ? 'VALIDATION' : 'DB_ERROR',
    message: error && ['42501', '22023'].includes(error.code) ? error.message : 'Unable to start session. Please retry.',
  } }
  revalidatePath(`/portal/instructor/groups/${data.groupId}`)
  return { success: true, data: { sessionId: data.sessionId } }
}

const updateSessionSchema = z.object({
  session_id:       z.string().uuid(),
  group_id:         z.string().uuid(),
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

  const { data: session } = await db.from('schedules').select('status').eq('id', d.session_id).maybeSingle()
  if (!session || !canEditSessionContent((session as any).status)) {
    return { success: false, error: { code: 'VALIDATION', message: 'Cancelled sessions cannot be edited.' } }
  }

  const updates: Record<string, unknown> = {}
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

export async function startSession(sessionId: string, groupId: string): Promise<ActionResult<{ sessionId: string }>> {
  const user = await requirePermission('manage_attendance')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }
  const db = createServiceClient()
  const { data: session, error: readError } = await db.from('schedules')
    .select('id,group_course_id,topic,status,group_courses!schedules_group_course_id_fkey(group_id)').eq('id', sessionId).maybeSingle()
  if (readError || !session) return { success: false, error: { code: 'NOT_FOUND', message: 'Session not found.' } }
  const context = session.group_courses as unknown as { group_id: string }
  if (context?.group_id !== groupId) return { success: false, error: { code: 'FORBIDDEN', message: 'Session does not belong to this group.' } }
  if (!['scheduled', 'ongoing'].includes(session.status)) return { success: false, error: { code: 'VALIDATION', message: 'This class is no longer available to start. Review previous classes instead.' } }
  const { data, error } = await db.rpc('open_shared_instructor_session', {
    p_actor: user.id, p_instructor: instructor.id, p_course: session.group_course_id,
    p_expected_session: sessionId, p_expected_previous: null, p_topic: session.topic || 'Session',
  })
  if (error || !data?.sessionId) return { success: false, error: { code: 'VALIDATION',
    message: error && ['22023', '42501'].includes(error.code) ? error.message : 'Unable to open shared session. Please retry.' } }
  revalidatePath(`/portal/instructor/groups/${groupId}`)
  return { success: true, data: { sessionId: data.sessionId } }
}

// Legacy force is deliberately ignored by the common finalizer.
export async function endSession(sessionId: string, groupId: string, _force = false): Promise<ActionResult<{ attendanceRevision: number }>> {
  const formData = new FormData()
  formData.set('session_id', sessionId)
  formData.set('group_id', groupId)
  return persistInstructorSession(formData, true, false)
}

export async function saveAttendance(_prev: unknown, formData: FormData): Promise<ActionResult<{ attendanceRevision: number; alreadyCompleted?: boolean }>> {
  return persistInstructorSession(formData, false, true)
}

export async function saveAndEndSession(_prev: unknown, formData: FormData): Promise<ActionResult<{ attendanceRevision: number; alreadyCompleted?: boolean }>> {
  return persistInstructorSession(formData, true, true)
}

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

// Resolves every active student in a group to their own user_id plus their
// parents' user_ids — shared by any action that needs to notify "everyone in
// this group" (new homework, new session resources). Non-critical by design:
// callers fire this with `void` and swallow errors so a notification hiccup
// never blocks the actual homework/resource save.
async function notifyGroupAudience(
  groupId: string,
  db: ReturnType<typeof createServiceClient>,
  notify: (recipientUserId: string) => Promise<void>
): Promise<void> {
  try {
    const { data: gsRows } = await db
      .from('group_students')
      .select('student_id')
      .eq('group_id', groupId)
      .eq('status', 'active')
    const studentIds = [...new Set((gsRows ?? []).map((r: any) => r.student_id as string))]

    await Promise.all(studentIds.map(async (studentId) => {
      const [studentUserId, parentUserIds] = await Promise.all([
        getStudentUserId(studentId),
        getParentUserIdsForStudent(studentId),
      ])
      const recipients = [...(studentUserId ? [studentUserId] : []), ...parentUserIds]
      await Promise.all(recipients.map(notify))
    }))
  } catch {
    // non-critical
  }
}

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

  if (resources.length > 0) {
    void notifyGroupAudience(d.group_id, db, (recipientId) =>
      seedNewSessionResourcesNotification(recipientId, d.session_id)
    )
  }

  revalidatePath(`/portal/instructor/groups/${d.group_id}/sessions/${d.session_id}`)
  return { success: true, data: undefined }
}

// ── Session homework: full model ──────────────────────────────────────────────
// module_id is optional — session-only assignments allowed since migration 0043.

const homeworkSchema = z.object({
  session_id:           z.string().uuid(),
  group_id:             z.string().uuid(),
  module_id:            z.string().uuid().optional().or(z.literal('')),
  title:                z.string().min(1, 'Title is required').max(200),
  description:          z.string().max(5000).optional().or(z.literal('')),
  instructions:         z.string().max(5000).optional().or(z.literal('')),
  due_at:               z.string().optional().or(z.literal('')),
  type:                 z.enum(['homework', 'classwork', 'project', 'challenge']).default('homework'),
  submission_type:      z.enum(['text', 'drive_link', 'github_link', 'url', 'video_link', 'image', 'multiple']).default('text'),
  max_score:            z.coerce.number().int().min(1).max(10000).default(100),
  allow_late:           z.string().optional().transform((v) => v !== 'false' && v !== 'off'),
  resubmission_allowed: z.string().optional().transform((v) => v === 'true' || v === 'on'),
  max_resubmissions:    z.coerce.number().int().min(0).max(10).default(1),
  portfolio_eligible:   z.string().optional().transform((v) => v === 'true' || v === 'on'),
})

export async function createSessionHomework(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ assignmentId: string }>> {
  const user       = await requirePermission('manage_courses')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }

  const raw = {
    session_id:           formData.get('session_id'),
    group_id:             formData.get('group_id'),
    module_id:            formData.get('module_id') || undefined,
    title:                formData.get('title'),
    description:          formData.get('description') || undefined,
    instructions:         formData.get('instructions') || undefined,
    due_at:               formData.get('due_at') || undefined,
    type:                 formData.get('type') || 'homework',
    submission_type:      formData.get('submission_type') || 'text',
    max_score:            formData.get('max_score') || 100,
    allow_late:           formData.get('allow_late') ?? undefined,
    resubmission_allowed: formData.get('resubmission_allowed') ?? undefined,
    max_resubmissions:    formData.get('max_resubmissions') || 1,
    portfolio_eligible:   formData.get('portfolio_eligible') ?? undefined,
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
      module_id:            d.module_id || null,
      schedule_id:          d.session_id,
      title:                d.title,
      description:          d.description || null,
      instructions:         d.instructions || null,
      type:                 d.type,
      submission_type:      d.submission_type,
      max_score:            d.max_score,
      due_at:               d.due_at ? new Date(d.due_at).toISOString() : null,
      status:               'published',
      allow_late:           d.allow_late,
      resubmission_allowed: d.resubmission_allowed,
      max_resubmissions:    d.max_resubmissions,
      portfolio_eligible:   d.portfolio_eligible,
      rubric:               [],
      created_by:           user.id,
    })
    .select('id')
    .single()

  if (error || !assignment) return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to create homework.' } }

  const assignmentId = (assignment as any).id as string
  void notifyGroupAudience(d.group_id, db, (recipientId) =>
    seedNewHomeworkAssignedNotification(recipientId, assignmentId, d.title)
  )

  revalidatePath(`/portal/instructor/groups/${d.group_id}/sessions/${d.session_id}`)
  revalidatePath('/portal/instructor/homework')
  return { success: true, data: { assignmentId } }
}

const updateSessionHomeworkSchema = homeworkSchema.extend({ assignment_id: z.string().uuid() })

export async function updateSessionHomework(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_courses')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }

  const parsed = updateSessionHomeworkSchema.safeParse({
    assignment_id: formData.get('assignment_id'), session_id: formData.get('session_id'), group_id: formData.get('group_id'),
    module_id: formData.get('module_id') || undefined, title: formData.get('title'), description: formData.get('description') || undefined,
    instructions: formData.get('instructions') || undefined, due_at: formData.get('due_at') || undefined, type: formData.get('type') || 'homework',
    submission_type: formData.get('submission_type') || 'text', max_score: formData.get('max_score') || 100,
    allow_late: formData.get('allow_late') ?? undefined, resubmission_allowed: formData.get('resubmission_allowed') ?? undefined,
    max_resubmissions: formData.get('max_resubmissions') || 1, portfolio_eligible: formData.get('portfolio_eligible') ?? undefined,
  })
  if (!parsed.success) return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  const d = parsed.data
  const db = createServiceClient()
  const ctx = await getSessionAccessContext(d.session_id, instructor.id, db)
  if (!ctx) return { success: false, error: { code: 'FORBIDDEN', message: 'You are not assigned to this session.' } }
  const { data: session } = await db.from('schedules').select('status').eq('id', d.session_id).maybeSingle()
  if (!session || !canEditSessionContent((session as any).status)) return { success: false, error: { code: 'VALIDATION', message: 'Cancelled sessions cannot be edited.' } }
  const { error } = await db.from('assignments').update({
    module_id: d.module_id || null, title: d.title, description: d.description || null, instructions: d.instructions || null,
    type: d.type, submission_type: d.submission_type, max_score: d.max_score, due_at: d.due_at ? new Date(d.due_at).toISOString() : null,
    allow_late: d.allow_late, resubmission_allowed: d.resubmission_allowed, max_resubmissions: d.max_resubmissions,
    portfolio_eligible: d.portfolio_eligible,
  }).eq('id', d.assignment_id).eq('schedule_id', d.session_id).eq('created_by', user.id)
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  revalidatePath(`/portal/instructor/groups/${d.group_id}/sessions/${d.session_id}`)
  revalidatePath('/portal/instructor/homework')
  return { success: true, data: undefined }
}

// ── Cancel Session ────────────────────────────────────────────────────────────

const cancelSessionSchema = z.object({
  session_id:     z.string().uuid(),
  group_id:       z.string().uuid(),
  reason:         z.string().min(1, 'Cancellation reason is required').max(500),
  create_makeup:  z.string().optional().transform((v) => v === 'true' || v === 'on'),
  makeup_date:    z.string().optional().or(z.literal('')),
})

export async function cancelSession(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ makeupSessionId?: string }>> {
  const user       = await requirePermission('manage_attendance')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }
  }

  const raw = {
    session_id:    formData.get('session_id'),
    group_id:      formData.get('group_id'),
    reason:        formData.get('reason'),
    create_makeup: formData.get('create_makeup') ?? undefined,
    makeup_date:   formData.get('makeup_date') || undefined,
  }

  const parsed = cancelSessionSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d  = parsed.data
  const db = createServiceClient()

  const ctx = await getSessionAccessContext(d.session_id, instructor.id, db)
  if (!ctx) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You are not assigned to this session.' } }
  }

  const { data: sessRow } = await db
    .from('schedules')
    .select('id, status, session_number, group_course_id, scheduled_at, duration_minutes, type, delivery, meeting_url, room')
    .eq('id', d.session_id)
    .single()

  if (!sessRow) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Session not found.' } }
  }

  const currentStatus = (sessRow as any).status as string
  if (currentStatus === 'cancelled' || currentStatus === 'cancelled_with_makeup') {
    return { success: false, error: { code: 'VALIDATION', message: 'Session is already cancelled.' } }
  }
  if (currentStatus === 'completed') {
    return { success: false, error: { code: 'VALIDATION', message: 'Cannot cancel a completed session.' } }
  }

  const now = new Date().toISOString()
  let makeupSessionId: string | undefined

  if (d.create_makeup) {
    // Create a makeup session linked to this one
    const makeupDate = d.makeup_date
      ? new Date(d.makeup_date).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // +7 days default

    const { data: makeup, error: makeupErr } = await db
      .from('schedules')
      .insert({
        group_course_id:      (sessRow as any).group_course_id,
        branch_id:            ctx.branchId,
        scheduled_at:         makeupDate,
        duration_minutes:     (sessRow as any).duration_minutes,
        type:                 'makeup',
        delivery:             (sessRow as any).delivery ?? null,
        meeting_url:          (sessRow as any).meeting_url ?? null,
        room:                 (sessRow as any).room ?? null,
        status:               'scheduled',
        original_session_id:  d.session_id,
        makeup_of_session_nr: (sessRow as any).session_number ?? null,
        created_by:           user.id,
      })
      .select('id')
      .single()

    if (makeupErr || !makeup) {
      return { success: false, error: { code: 'DB_ERROR', message: makeupErr?.message ?? 'Failed to create makeup session.' } }
    }
    makeupSessionId = (makeup as any).id as string
  }

  const newStatus = d.create_makeup ? 'cancelled_with_makeup' : 'cancelled'

  const { error: updateErr } = await db
    .from('schedules')
    .update({
      status:               newStatus,
      cancellation_reason:  d.reason,
      cancelled_by:         user.id,
      cancelled_at:         now,
    })
    .eq('id', d.session_id)

  if (updateErr) {
    return { success: false, error: { code: 'DB_ERROR', message: updateErr.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'session.cancel',
    p_entity_type:  'schedule',
    p_entity_id:    d.session_id,
    p_new_values:   { status: newStatus, reason: d.reason, makeup_session_id: makeupSessionId },
    p_branch_id:    ctx.branchId,
  })

  // Remove SESSION_STARTING notification — cancelled session never happens (fire-and-forget)
  void deleteSessionStartingNotification(user.id, (sessRow as any).group_course_id as string).catch(() => { /* non-critical */ })

  revalidatePath(`/portal/instructor/groups/${d.group_id}`)
  revalidatePath(`/portal/instructor/groups/${d.group_id}/sessions/${d.session_id}`)
  return { success: true, data: { makeupSessionId } }
}

// ── Postpone Session ──────────────────────────────────────────────────────────

const postponeSessionSchema = z.object({
  session_id: z.string().uuid(),
  group_id:   z.string().uuid(),
  reason:     z.string().max(500).optional().or(z.literal('')),
  new_date:   z.string().optional().or(z.literal('')),
})

export async function postponeSession(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user       = await requirePermission('manage_attendance')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }
  }

  const raw = {
    session_id: formData.get('session_id'),
    group_id:   formData.get('group_id'),
    reason:     formData.get('reason') || undefined,
    new_date:   formData.get('new_date') || undefined,
  }

  const parsed = postponeSessionSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d  = parsed.data
  const db = createServiceClient()

  const ctx = await getSessionAccessContext(d.session_id, instructor.id, db)
  if (!ctx) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You are not assigned to this session.' } }
  }

  const { data: sessRow } = await db
    .from('schedules')
    .select('status, group_course_id')
    .eq('id', d.session_id)
    .maybeSingle()

  if ((sessRow as any)?.status === 'completed') {
    return { success: false, error: { code: 'VALIDATION', message: 'Completed sessions cannot be postponed.' } }
  }

  const updates: Record<string, unknown> = {
    status:           'postponed',
    postponed_reason: d.reason || null,
  }
  if (d.new_date) {
    updates.scheduled_at = new Date(d.new_date).toISOString()
  }

  const { error } = await db.from('schedules').update(updates).eq('id', d.session_id)
  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  // A postponed session never happened — purge attendance and participation records.
  await db.from('attendance_records').delete().eq('schedule_id', d.session_id)
  await db.from('session_instructors').delete().eq('session_id', d.session_id)

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'session.postpone',
    p_entity_type:  'schedule',
    p_entity_id:    d.session_id,
    p_new_values:   { reason: d.reason, new_date: d.new_date },
    p_branch_id:    ctx.branchId,
  })

  // Remove SESSION_STARTING notification — postponed session is no longer imminent (fire-and-forget)
  const pgcId = (sessRow as any)?.group_course_id as string | undefined
  if (pgcId) {
    void deleteSessionStartingNotification(user.id, pgcId).catch(() => { /* non-critical */ })
  }

  revalidatePath(`/portal/instructor/groups/${d.group_id}`)
  revalidatePath(`/portal/instructor/groups/${d.group_id}/sessions/${d.session_id}`)
  return { success: true, data: undefined }
}

// ── Student Notes ─────────────────────────────────────────────────────────────
// Relocated to modules/student-notes/ (shared across instructor/TL/student/parent
// portals). Wrapped (not bare re-exported — Next.js's server-action bundler
// requires actual function declarations in a 'use server' file) so existing
// imports (`@/modules/instructor-portal/actions`) in the instructor UI keep
// working unchanged.

export async function createStudentNote(
  prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ noteId: string }>> {
  return sharedCreateStudentNote(prevState, formData)
}

export async function updateStudentNote(
  prevState: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  return sharedUpdateStudentNote(prevState, formData)
}

export async function deleteStudentNote(formData: FormData): Promise<ActionResult<void>> {
  return sharedDeleteStudentNote(formData)
}

// ── Student Evaluations (instructor-authored) ───────────────────────────────────
// modules/student-evaluations/actions.ts only enforces a branch-scoped
// manage_evaluations permission — it has no concept of instructor/group
// ownership, so a caller with the permission could otherwise evaluate any
// student in the branch. This wrapper adds the same group_courses/
// group_instructors ownership check createStudentNote uses (student-notes/
// actions.ts) before delegating — all validation, timeline logging, and
// notification fan-out stays in the shared action, not duplicated here.

async function hasInstructorGroupAccess(
  groupId:      string,
  instructorId: string,
  db:           ReturnType<typeof createServiceClient>
): Promise<boolean> {
  const { data: gcRow } = await db
    .from('group_courses')
    .select('id')
    .eq('group_id', groupId)
    .eq('instructor_id', instructorId)
    .eq('status', 'active')
    .maybeSingle()
  if (gcRow) return true

  const { data: giRow } = await db
    .from('group_instructors')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('instructor_id', instructorId)
    .maybeSingle()
  return !!giRow
}

const evaluationFormSchema = z.object({
  student_id:         z.string().uuid(),
  group_id:           z.string().uuid(),
  criterion:          z.string().min(1),
  custom_label:       z.string().nullable().optional(),
  score:              z.string().nullable().optional(),
  rating:             z.string().nullable().optional(),
  feedback:           z.string().nullable().optional(),
  visible_to_student: z.string().nullable().optional(),
  visible_to_parent:  z.string().nullable().optional(),
})

export async function createInstructorEvaluation(
  _prevState: unknown,
  formData: FormData
): Promise<ActionResult<{ evaluationId: string }>> {
  const user = await requireAuth()

  const parsed = evaluationFormSchema.safeParse({
    student_id:         formData.get('student_id'),
    group_id:           formData.get('group_id'),
    criterion:          formData.get('criterion'),
    custom_label:       formData.get('custom_label') || undefined,
    score:              formData.get('score') || undefined,
    rating:             formData.get('rating') || undefined,
    feedback:           formData.get('feedback') || undefined,
    visible_to_student: formData.get('visible_to_student') as string | undefined,
    visible_to_parent:  formData.get('visible_to_parent')  as string | undefined,
  })
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }
  const d = parsed.data

  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }
  }

  const db = createServiceClient()
  const hasAccess = await hasInstructorGroupAccess(d.group_id, instructor.id, db)
  if (!hasAccess) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You are not assigned to this group.' } }
  }

  const { data: studentRow } = await db.from('students').select('branch_id').eq('id', d.student_id).maybeSingle()
  const branchId = (studentRow as any)?.branch_id as string | undefined
  if (!branchId) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Student not found.' } }
  }

  const result = await createStudentEvaluation({
    student_id:          d.student_id,
    branch_id:           branchId,
    criterion:            d.criterion as EvaluationCriterion,
    custom_label:         d.custom_label || null,
    score:                d.score  ? Number(d.score)  : null,
    rating:               d.rating ? Number(d.rating) : null,
    feedback:             d.feedback || null,
    visible_to_student:   d.visible_to_student === 'true',
    visible_to_parent:    d.visible_to_parent  === 'true',
  })

  if (result.success) {
    revalidatePath(`/portal/instructor/groups/${d.group_id}/students/${d.student_id}`)
  }
  return result
}
