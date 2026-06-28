'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, requireAuth } from '@/modules/rbac/guards'
import { getInstructorByUserId } from './queries'
import { resolveGroupProgressContext } from '@/modules/progress/resolve'
import { safeRecalcProgressBatch, buildBatchTuples } from '@/modules/progress/safe-recalc'
import {
  validateSessionOwnership,
  canInstructorCreateNextSession,
  completeInstructorAllocation,
} from '@/modules/academic/session-ownership'
import { validateAcademicTopic } from '@/modules/academic/constants'
import { SLOT_CONSUMING_STATUSES } from '@/modules/attendance/constants'
import {
  checkConsumptionEligibility,
  resolveFifoEnrollment,
  type EnrollmentForConsumption,
} from '@/modules/academic/contract-consumption'
import { awardXP, XP_AWARDS } from '@/modules/gamification/xp-service'
import { checkAndUnlockAchievements } from '@/modules/gamification/achievement-service'
import { checkAndAwardBadges } from '@/modules/gamification/badge-service'
import type { ActionResult } from '@/types/app'

// Statuses that count toward student attendance (XP, achievements).
// Distinct from SLOT_CONSUMING_STATUSES (enrollment billing) — excused/absent do not award XP.
const ATTENDANCE_PRESENCE_STATUSES = new Set(['present', 'late', 'makeup'])

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
): Promise<{ groupId: string; branchId: string } | null> {
  // Fetch branch_id in the same query (needed for audit logs)
  const { data: sessRow } = await db
    .from('schedules')
    .select('branch_id, group_courses!schedules_group_course_id_fkey(group_id)')
    .eq('id', sessionId)
    .maybeSingle()

  if (!sessRow) return null
  const branchId = (sessRow as any).branch_id as string
  const groupId  = (sessRow as any).group_courses?.group_id as string | undefined
  if (!groupId) return null

  // Ownership check (membership + allocation range + allocation_status)
  const check = await validateSessionOwnership(instructorId, sessionId, db)
  if (!check.allowed) return null

  return { groupId, branchId }
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
  groupCourseId: string,
  groupId:       string,
  branchId:      string,
  topic:         string
): Promise<ActionResult<{ sessionId: string }>> {
  const validTopic = validateAcademicTopic(topic)
  if (!validTopic) {
    return { success: false, error: { code: 'VALIDATION', message: 'Topic is required to start a session.' } }
  }

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

  // Range guard: is the instructor allowed to create the next session?
  const rangeCheck = await canInstructorCreateNextSession(instructor.id, groupCourseId, db)
  if (!rangeCheck.allowed) {
    return { success: false, error: { code: 'FORBIDDEN', message: rangeCheck.reason ?? 'Outside your allocated session range.' } }
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
      topic:            validTopic,
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
  status:           z.enum(['scheduled', 'ongoing', 'completed', 'cancelled', 'cancelled_with_makeup', 'postponed']),
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
    .select('id, status, topic, notes, branch_id, scheduled_at, group_courses!schedules_group_course_id_fkey(group_id)')
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
    const topicMissing = !validateAcademicTopic((sessRow as any).topic as string | null)

    if (attendanceMissing > 0 || topicMissing) {
      return {
        success: false,
        error: {
          code:    'VALIDATION',
          message: [
            attendanceMissing > 0 ? `${attendanceMissing} student${attendanceMissing > 1 ? 's' : ''} without attendance.` : '',
            topicMissing ? 'Session topic is required before ending the session.' : '',
          ].filter(Boolean).join(' '),
        },
      }
    }
  }

  const now = new Date().toISOString()

  const { error } = await db
    .from('schedules')
    .update({ status: 'completed', ended_at: now })
    .eq('id', sessionId)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  // ── 1. Record instructor participation ────────────────────────────────────────
  await db.from('session_instructors').upsert({
    session_id:    sessionId,
    instructor_id: instructor.id,
    submitted_at:  now,
  }, { onConflict: 'session_id,instructor_id', ignoreDuplicates: false })

  // ── 2. Read finalized attendance records ──────────────────────────────────────
  const { data: attRows } = await db
    .from('attendance_records')
    .select('id, student_id, status')
    .eq('schedule_id', sessionId)

  const sessionDateISO = (sessRow as any).scheduled_at as string | null
  const safeStudents   = [...new Set((attRows ?? []).map((r: any) => r.student_id as string))]

  // ── 3. Contract consumption (enrollment ledger) ────────────────────────────────
  if (sessionDateISO && attRows && attRows.length > 0) {
    const { data: enrollRows } = await db
      .from('student_enrollments')
      .select('id, student_id, remaining_sessions, allow_overdraft_sessions, enrolled_sessions, start_date, end_date')
      .eq('status', 'ACTIVE')
      .in('student_id', safeStudents)
      .order('start_date', { ascending: true })
      .order('created_at', { ascending: true })

    const allEnrollsByStudent = new Map<string, EnrollmentForConsumption[]>()
    for (const e of (enrollRows ?? []) as any[]) {
      const sid   = e.student_id as string
      const entry: EnrollmentForConsumption = {
        id:                 e.id,
        start_date:         e.start_date ?? sessionDateISO.slice(0, 10),
        end_date:           (e.end_date as string | null) ?? null,
        enrolled_sessions:  Number(e.enrolled_sessions  ?? 0),
        remaining_sessions: Number(e.remaining_sessions ?? 0),
        allow_overdraft:    Boolean(e.allow_overdraft_sessions),
      }
      const list = allEnrollsByStudent.get(sid) ?? []
      list.push(entry)
      allEnrollsByStudent.set(sid, list)
    }

    const p_record_ids:     string[] = []
    const p_enrollment_ids: string[] = []
    const p_student_ids:    string[] = []

    for (const rec of (attRows as any[])) {
      const sid        = rec.student_id as string
      const enrollment = resolveFifoEnrollment(allEnrollsByStudent.get(sid) ?? [], sessionDateISO)
      const check      = checkConsumptionEligibility(rec.status as string, sessionDateISO, enrollment, SLOT_CONSUMING_STATUSES)
      if (check.shouldConsume && enrollment) {
        p_record_ids.push(rec.id as string)
        p_enrollment_ids.push(enrollment.id)
        p_student_ids.push(sid)
      }
    }

    if (p_record_ids.length > 0) {
      await db.rpc('consume_attendance_sessions_batch', { p_record_ids, p_enrollment_ids, p_student_ids })
    }
  }

  // ── 4. Progress recalculation ─────────────────────────────────────────────────
  if (safeStudents.length > 0) {
    const contexts = await resolveGroupProgressContext(ctx.groupId)
    if (contexts.length > 0) {
      await safeRecalcProgressBatch(buildBatchTuples(safeStudents, contexts), 'endSession')
    }
  }

  // ── 5. Gamification (XP for attending students) ────────────────────────────────
  for (const rec of (attRows ?? []) as any[]) {
    if (!ATTENDANCE_PRESENCE_STATUSES.has(rec.status as string)) continue
    const xp = rec.status === 'present' ? XP_AWARDS.ATTENDANCE_PRESENT : XP_AWARDS.ATTENDANCE_LATE
    await awardXP(rec.student_id as string, xp, true)
    await checkAndUnlockAchievements(rec.student_id as string)
    await checkAndAwardBadges(rec.student_id as string)
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'session.end',
    p_entity_type:  'schedule',
    p_entity_id:    sessionId,
    p_new_values:   { ended_at: now, force },
    p_branch_id:    ctx.branchId,
  })

  // ── 6. Auto-complete instructor allocation if this was their last session ──────
  const { data: completedSess } = await db
    .from('schedules')
    .select('session_number')
    .eq('id', sessionId)
    .maybeSingle()

  const sessionNumber = (completedSess as any)?.session_number as number | null

  if (sessionNumber != null) {
    const { data: allocRow } = await db
      .from('group_instructors')
      .select('to_session')
      .eq('group_id', ctx.groupId)
      .eq('instructor_id', instructor.id)
      .eq('allocation_status', 'active')
      .maybeSingle()

    if (allocRow && (allocRow as any).to_session === sessionNumber) {
      await completeInstructorAllocation(instructor.id, ctx.groupId, db)
    }
  }

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

  // Server-side guard: fetch session status + topic + scheduled_at together.
  const { data: sessStatusRow } = await db
    .from('schedules')
    .select('status, topic, scheduled_at')
    .eq('id', sessionId)
    .maybeSingle()

  if (sessStatusRow) {
    const st = (sessStatusRow as any).status as string
    if (st === 'cancelled' || st === 'cancelled_with_makeup') {
      return {
        success: false,
        error: { code: 'VALIDATION', message: 'Cannot record attendance for a cancelled session. Cancelled sessions are not academically counted.' },
      }
    }
  }

  // Topic integrity: every academically consuming session must have a valid topic.
  // The instructor can provide / correct the topic in the attendance form.
  const topicFromForm  = validateAcademicTopic(formData.get('topic') as string | null)
  const existingTopic  = validateAcademicTopic((sessStatusRow as any)?.topic as string | null)

  if (!existingTopic && !topicFromForm) {
    return {
      success: false,
      error: { code: 'VALIDATION', message: 'Topic is required before saving attendance. Please enter the session topic.' },
    }
  }

  // Persist a new or corrected topic if supplied in this submission.
  if (topicFromForm && topicFromForm !== existingTopic) {
    await db.from('schedules').update({ topic: topicFromForm }).eq('id', sessionId)
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

  revalidatePath(`/portal/instructor/groups/${d.group_id}/sessions/${d.session_id}`)
  revalidatePath('/portal/instructor/homework')
  return { success: true, data: { assignmentId: (assignment as any).id } }
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
    .select('status')
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

  revalidatePath(`/portal/instructor/groups/${d.group_id}`)
  revalidatePath(`/portal/instructor/groups/${d.group_id}/sessions/${d.session_id}`)
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
