'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import {
  seedTrialSessionAssignedNotification,
  seedMakeupSessionAssignedNotification,
} from '@/modules/notifications/actions'
import type { ActionResult } from '@/types/app'

// ── Permission helpers ─────────────────────────────────────────────────────────
// Trial sessions: TL + Super Admin only (manage_schedule)
// Makeup sessions: TL + Super Admin only (manage_schedule)

// ── Create Trial Session ───────────────────────────────────────────────────────

const createTrialSchema = z.object({
  branch_id:        z.string().uuid(),
  instructor_id:    z.string().uuid(),
  scheduled_at:     z.string().min(1),
  duration_minutes: z.coerce.number().int().min(15).max(480).default(60),
  course_name:      z.string().max(200).optional().or(z.literal('')),
  notes:            z.string().max(1000).optional().or(z.literal('')),
})

export async function createTrialSession(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ sessionId: string }>> {
  const user = await requirePermission('manage_schedule')
  const db   = createServiceClient()

  const raw = {
    branch_id:        formData.get('branch_id'),
    instructor_id:    formData.get('instructor_id'),
    scheduled_at:     formData.get('scheduled_at'),
    duration_minutes: formData.get('duration_minutes') ?? 60,
    course_name:      formData.get('course_name') || undefined,
    notes:            formData.get('notes')        || undefined,
  }

  const parsed = createTrialSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  const { data: schedule, error: schedErr } = await db
    .from('schedules')
    .insert({
      group_course_id:  null,               // standalone — no group
      branch_id:        d.branch_id,
      scheduled_at:     new Date(d.scheduled_at).toISOString(),
      duration_minutes: d.duration_minutes,
      type:             'trial',
      status:           'scheduled',
      notes:            d.notes || null,
      created_by:       user.id,
    })
    .select('id')
    .single()

  if (schedErr || !schedule) {
    return { success: false, error: { code: 'DB_ERROR', message: schedErr?.message ?? 'Failed to create trial session.' } }
  }

  const sessionId = (schedule as any).id as string

  // Register instructor participation immediately (source of truth for payroll)
  await db.from('session_instructors').upsert({
    session_id:    sessionId,
    instructor_id: d.instructor_id,
    submitted_at:  null,              // not submitted yet — set on session end
  }, { onConflict: 'session_id,instructor_id', ignoreDuplicates: false })

  // Notify instructor
  const { data: instrUser } = await db
    .from('instructors')
    .select('user_id, users!instructors_user_id_fkey(email)')
    .eq('id', d.instructor_id)
    .maybeSingle()

  if (instrUser) {
    void seedTrialSessionAssignedNotification(
      (instrUser as any).user_id as string,
      sessionId,
      new Date(d.scheduled_at).toISOString()
    ).catch(() => { /* non-critical */ })
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'special_session.create_trial',
    p_entity_type:  'schedule',
    p_entity_id:    sessionId,
    p_new_values:   { branch_id: d.branch_id, instructor_id: d.instructor_id },
    p_branch_id:    d.branch_id,
  })

  revalidatePath('/portal/team-leader/special-sessions')
  revalidatePath('/portal/instructor/special-sessions')
  return { success: true, data: { sessionId } }
}

// ── Create Standalone Makeup Session ──────────────────────────────────────────

const createMakeupSchema = z.object({
  branch_id:        z.string().uuid(),
  instructor_id:    z.string().uuid(),
  scheduled_at:     z.string().min(1),
  duration_minutes: z.coerce.number().int().min(15).max(480).default(60),
  notes:            z.string().max(1000).optional().or(z.literal('')),
})

export async function createMakeupSession(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ sessionId: string }>> {
  // Makeup sessions are TL / Super Admin only
  const user = await requirePermission('manage_schedule')
  const db   = createServiceClient()

  const raw = {
    branch_id:        formData.get('branch_id'),
    instructor_id:    formData.get('instructor_id'),
    scheduled_at:     formData.get('scheduled_at'),
    duration_minutes: formData.get('duration_minutes') ?? 60,
    notes:            formData.get('notes') || undefined,
  }

  const parsed = createMakeupSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  const { data: schedule, error: schedErr } = await db
    .from('schedules')
    .insert({
      group_course_id:  null,
      branch_id:        d.branch_id,
      scheduled_at:     new Date(d.scheduled_at).toISOString(),
      duration_minutes: d.duration_minutes,
      type:             'makeup',
      status:           'scheduled',
      notes:            d.notes || null,
      created_by:       user.id,
    })
    .select('id')
    .single()

  if (schedErr || !schedule) {
    return { success: false, error: { code: 'DB_ERROR', message: schedErr?.message ?? 'Failed to create makeup session.' } }
  }

  const sessionId = (schedule as any).id as string

  await db.from('session_instructors').upsert({
    session_id:    sessionId,
    instructor_id: d.instructor_id,
    submitted_at:  null,
  }, { onConflict: 'session_id,instructor_id', ignoreDuplicates: false })

  // Notify instructor if different from current user
  const { data: instrUser } = await db
    .from('instructors')
    .select('user_id')
    .eq('id', d.instructor_id)
    .maybeSingle()

  if (instrUser && (instrUser as any).user_id !== user.id) {
    void seedMakeupSessionAssignedNotification(
      (instrUser as any).user_id as string,
      sessionId,
      new Date(d.scheduled_at).toISOString()
    ).catch(() => { /* non-critical */ })
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'special_session.create_makeup',
    p_entity_type:  'schedule',
    p_entity_id:    sessionId,
    p_new_values:   { branch_id: d.branch_id, instructor_id: d.instructor_id },
    p_branch_id:    d.branch_id,
  })

  revalidatePath('/portal/team-leader/special-sessions')
  revalidatePath('/portal/instructor/special-sessions')
  return { success: true, data: { sessionId } }
}

// ── Add Trial Student (Option A: existing lead) ────────────────────────────────

const addTrialStudentFromLeadSchema = z.object({
  schedule_id: z.string().uuid(),
  lead_id:     z.string().uuid(),
})

export async function addTrialStudentFromLead(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ studentId: string }>> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  const parsed = addTrialStudentFromLeadSchema.safeParse({
    schedule_id: formData.get('schedule_id'),
    lead_id:     formData.get('lead_id'),
  })
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  // Verify it's a trial session
  const { data: sess } = await db
    .from('schedules')
    .select('type')
    .eq('id', d.schedule_id)
    .maybeSingle()
  if (!sess || (sess as any).type !== 'trial') {
    return { success: false, error: { code: 'VALIDATION', message: 'Session is not a trial session.' } }
  }

  // Fetch lead details
  const { data: lead } = await db
    .from('leads')
    .select('id, child_name, phone, whatsapp')
    .eq('id', d.lead_id)
    .maybeSingle()
  if (!lead) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Lead not found.' } }
  }

  const { data: inserted, error } = await db
    .from('trial_session_students')
    .insert({
      schedule_id:  d.schedule_id,
      lead_id:      d.lead_id,
      student_name: (lead as any).child_name,
      parent_phone: (lead as any).phone ?? (lead as any).whatsapp ?? null,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to add student.' } }
  }

  // Update lead status to TRIAL_BOOKED
  await db.from('leads').update({ status: 'TRIAL_BOOKED' }).eq('id', d.lead_id)

  revalidatePath('/portal/team-leader/special-sessions')
  revalidatePath('/portal/instructor/special-sessions')
  return { success: true, data: { studentId: (inserted as any).id } }
}

// ── Add Trial Student (Option B: new ad-hoc student) ──────────────────────────

const addTrialStudentNewSchema = z.object({
  schedule_id:   z.string().uuid(),
  student_name:  z.string().min(1, 'Student name is required'),
  student_phone: z.string().optional().or(z.literal('')),
  parent_phone:  z.string().min(1, 'Parent phone is required'),
  notes:         z.string().optional().or(z.literal('')),
})

export async function addTrialStudentNew(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ studentId: string }>> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  const parsed = addTrialStudentNewSchema.safeParse({
    schedule_id:   formData.get('schedule_id'),
    student_name:  formData.get('student_name'),
    student_phone: formData.get('student_phone') || undefined,
    parent_phone:  formData.get('parent_phone'),
    notes:         formData.get('notes') || undefined,
  })
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  const { data: inserted, error } = await db
    .from('trial_session_students')
    .insert({
      schedule_id:   d.schedule_id,
      lead_id:       null,
      student_name:  d.student_name,
      student_phone: d.student_phone || null,
      parent_phone:  d.parent_phone,
      notes:         d.notes || null,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to add student.' } }
  }

  revalidatePath('/portal/team-leader/special-sessions')
  revalidatePath('/portal/instructor/special-sessions')
  return { success: true, data: { studentId: (inserted as any).id } }
}

// ── Add Student to Makeup Session ─────────────────────────────────────────────

const addMakeupStudentSchema = z.object({
  schedule_id:          z.string().uuid(),
  student_id:           z.string().uuid(),
  mode:                 z.enum(['EXTRA', 'REPLACE_MISSED']),
  replaced_session_id:  z.string().uuid().optional().or(z.literal('')),
})

export async function addMakeupStudent(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ studentId: string }>> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  const parsed = addMakeupStudentSchema.safeParse({
    schedule_id:         formData.get('schedule_id'),
    student_id:          formData.get('student_id'),
    mode:                formData.get('mode'),
    replaced_session_id: formData.get('replaced_session_id') || undefined,
  })
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  if (d.mode === 'REPLACE_MISSED' && !d.replaced_session_id) {
    return { success: false, error: { code: 'VALIDATION', message: 'A missed session must be selected for REPLACE_MISSED mode.' } }
  }

  // Block duplicate replacement: one absence can only be replaced once
  if (d.mode === 'REPLACE_MISSED' && d.replaced_session_id) {
    const { data: existing } = await db
      .from('makeup_session_students')
      .select('id')
      .eq('student_id', d.student_id)
      .eq('replaced_session_id', d.replaced_session_id)
      .eq('mode', 'REPLACE_MISSED')
      .maybeSingle()

    if (existing) {
      return { success: false, error: { code: 'DUPLICATE', message: 'This absence has already been replaced by a makeup session.' } }
    }
  }

  const { data: inserted, error } = await db
    .from('makeup_session_students')
    .upsert({
      schedule_id:          d.schedule_id,
      student_id:           d.student_id,
      mode:                 d.mode,
      replaced_session_id:  d.replaced_session_id || null,
    }, { onConflict: 'schedule_id,student_id' })
    .select('id')
    .single()

  if (error || !inserted) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to add student.' } }
  }

  revalidatePath('/portal/team-leader/special-sessions')
  revalidatePath('/portal/instructor/special-sessions')
  return { success: true, data: { studentId: (inserted as any).id } }
}

// ── Save Trial Attendance ──────────────────────────────────────────────────────

const saveTrialAttendanceSchema = z.object({
  schedule_id: z.string().uuid(),
})

export async function saveTrialAttendance(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  const scheduleId = formData.get('schedule_id') as string
  if (!scheduleId) {
    return { success: false, error: { code: 'VALIDATION', message: 'Session ID is required.' } }
  }

  const { data: students } = await db
    .from('trial_session_students')
    .select('id')
    .eq('schedule_id', scheduleId)

  const updates = (students ?? []).map((s: any) => ({
    id:                s.id,
    attendance_status: (formData.get(`status_${s.id}`) as string) || 'absent',
  }))

  for (const upd of updates) {
    await db.from('trial_session_students').update({ attendance_status: upd.attendance_status }).eq('id', upd.id)
  }

  revalidatePath('/portal/team-leader/special-sessions')
  revalidatePath('/portal/instructor/special-sessions')
  return { success: true, data: undefined }
}

// ── Save Makeup Attendance ────────────────────────────────────────────────────

export async function saveMakeupAttendance(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  const scheduleId = formData.get('schedule_id') as string
  if (!scheduleId) {
    return { success: false, error: { code: 'VALIDATION', message: 'Session ID is required.' } }
  }

  const { data: students } = await db
    .from('makeup_session_students')
    .select('id')
    .eq('schedule_id', scheduleId)

  const updates = (students ?? []).map((s: any) => ({
    id:                s.id,
    attendance_status: (formData.get(`status_${s.id}`) as string) || 'absent',
  }))

  for (const upd of updates) {
    await db.from('makeup_session_students').update({ attendance_status: upd.attendance_status }).eq('id', upd.id)
  }

  revalidatePath('/portal/team-leader/special-sessions')
  revalidatePath('/portal/instructor/special-sessions')
  return { success: true, data: undefined }
}

// ── Start Special Session ─────────────────────────────────────────────────────

export async function startSpecialSession(sessionId: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_attendance')
  const db   = createServiceClient()

  const { data: sess } = await db
    .from('schedules')
    .select('status, type')
    .eq('id', sessionId)
    .is('group_course_id', null)
    .maybeSingle()

  if (!sess) return { success: false, error: { code: 'NOT_FOUND', message: 'Special session not found.' } }
  if ((sess as any).status === 'ongoing')   return { success: false, error: { code: 'VALIDATION', message: 'Session already in progress.' } }
  if ((sess as any).status === 'completed') return { success: false, error: { code: 'VALIDATION', message: 'Session is already completed.' } }

  const { error } = await db
    .from('schedules')
    .update({ status: 'ongoing', started_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath('/portal/instructor/special-sessions')
  revalidatePath('/portal/team-leader/special-sessions')
  return { success: true, data: undefined }
}

// ── End Trial Session ─────────────────────────────────────────────────────────
// Business rules:
//   - No session consumption, no XP, no attendance rate impact for students
//   - Instructor: session counted in payroll (via session_instructors.submitted_at)
//   - Update lead statuses to TRIAL_ATTENDED for present students

export async function endTrialSession(sessionId: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_attendance')
  const db   = createServiceClient()

  const { data: sess } = await db
    .from('schedules')
    .select('status, branch_id')
    .eq('id', sessionId)
    .eq('type', 'trial')
    .is('group_course_id', null)
    .maybeSingle()

  if (!sess) return { success: false, error: { code: 'NOT_FOUND', message: 'Trial session not found.' } }
  if ((sess as any).status === 'completed') return { success: false, error: { code: 'VALIDATION', message: 'Session already completed.' } }

  const now = new Date().toISOString()

  await db.from('schedules').update({ status: 'completed', ended_at: now }).eq('id', sessionId)

  // Mark instructor participation (stamps submitted_at for payroll)
  const { data: siRow } = await db
    .from('session_instructors')
    .select('instructor_id')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (siRow) {
    await db.from('session_instructors').update({ submitted_at: now }).eq('session_id', sessionId)
  }

  // Update present trial students' leads to TRIAL_ATTENDED
  const { data: presentStudents } = await db
    .from('trial_session_students')
    .select('lead_id')
    .eq('schedule_id', sessionId)
    .eq('attendance_status', 'present')
    .not('lead_id', 'is', null)

  const leadIds = (presentStudents ?? []).map((s: any) => s.lead_id as string).filter(Boolean)
  if (leadIds.length > 0) {
    await db.from('leads').update({ status: 'TRIAL_ATTENDED' }).in('id', leadIds)
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'special_session.end_trial',
    p_entity_type:  'schedule',
    p_entity_id:    sessionId,
    p_new_values:   { ended_at: now },
    p_branch_id:    (sess as any).branch_id,
  })

  revalidatePath('/portal/instructor/special-sessions')
  revalidatePath('/portal/team-leader/special-sessions')
  return { success: true, data: undefined }
}

// ── End Makeup Session ────────────────────────────────────────────────────────
// Business rules per student:
//   EXTRA:          consume 1 session from enrollment
//   REPLACE_MISSED: update absence on replaced_session_id to 'makeup' (no consumption)
// Instructor: 1 full payroll session regardless of student count.

export async function endMakeupSession(sessionId: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_attendance')
  const db   = createServiceClient()

  const { data: sess } = await db
    .from('schedules')
    .select('status, branch_id, scheduled_at')
    .eq('id', sessionId)
    .eq('type', 'makeup')
    .is('group_course_id', null)
    .maybeSingle()

  if (!sess) return { success: false, error: { code: 'NOT_FOUND', message: 'Makeup session not found.' } }
  if ((sess as any).status === 'completed') return { success: false, error: { code: 'VALIDATION', message: 'Session already completed.' } }

  const now            = new Date().toISOString()
  const sessionDateISO = (sess as any).scheduled_at as string

  await db.from('schedules').update({ status: 'completed', ended_at: now }).eq('id', sessionId)

  // Mark instructor participation
  await db.from('session_instructors').update({ submitted_at: now }).eq('session_id', sessionId)

  // Fetch all students who attended
  const { data: students } = await db
    .from('makeup_session_students')
    .select('id, student_id, mode, replaced_session_id, attendance_status')
    .eq('schedule_id', sessionId)

  const presentStudents = (students ?? []).filter(
    (s: any) => s.attendance_status === 'present' || s.attendance_status === 'late'
  )

  // ── REPLACE_MISSED: update existing absence → 'makeup' ──────────────────
  const replaceStudents = presentStudents.filter((s: any) => s.mode === 'REPLACE_MISSED' && s.replaced_session_id)

  for (const s of replaceStudents as any[]) {
    await db
      .from('attendance_records')
      .update({ status: 'makeup', makeup_schedule_id: sessionId })
      .eq('schedule_id', s.replaced_session_id)
      .eq('student_id', s.student_id)
      .eq('status', 'absent')
  }

  // ── EXTRA: consume 1 session from enrollment ────────────────────────────
  const extraStudents = presentStudents.filter((s: any) => s.mode === 'EXTRA')

  if (extraStudents.length > 0) {
    const extraStudentIds = (extraStudents as any[]).map((s) => s.student_id as string)

    const { data: enrollRows } = await db
      .from('student_enrollments')
      .select('id, student_id, remaining_sessions, allow_overdraft_sessions, enrolled_sessions, start_date, end_date')
      .eq('status', 'ACTIVE')
      .in('student_id', extraStudentIds)
      .order('start_date', { ascending: true })

    // Insert fake attendance record to feed into the consumption RPC
    // We reuse attendance_records with schedule_id=sessionId for ledger consistency
    const user_id_fallback = user.id
    for (const s of extraStudents as any[]) {
      // Insert/upsert an attendance_records row so the consumption RPC can reference it
      const { data: attRec } = await db
        .from('attendance_records')
        .upsert({
          schedule_id:  sessionId,
          student_id:   s.student_id,
          status:       'present',
          recorded_by:  user_id_fallback,
          recorded_at:  now,
          notes:        'Standalone makeup session (EXTRA)',
        }, { onConflict: 'schedule_id,student_id' })
        .select('id')
        .single()

      if (!attRec) continue

      // Find the applicable enrollment for this student
      const allEnrolls = (enrollRows ?? []).filter((e: any) => e.student_id === s.student_id)
      if (allEnrolls.length === 0) continue

      // Use earliest applicable enrollment (FIFO by start_date)
      const enrollment = allEnrolls.find((e: any) => {
        const start = e.start_date ?? sessionDateISO.slice(0, 10)
        const end   = e.end_date ?? null
        const date  = sessionDateISO.slice(0, 10)
        return date >= start && (end === null || date <= end)
      }) ?? allEnrolls[0]

      await db.rpc('consume_attendance_sessions_batch', {
        p_record_ids:     [(attRec as any).id],
        p_enrollment_ids: [enrollment.id],
        p_student_ids:    [s.student_id],
      })
    }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'special_session.end_makeup',
    p_entity_type:  'schedule',
    p_entity_id:    sessionId,
    p_new_values:   { ended_at: now },
    p_branch_id:    (sess as any).branch_id,
  })

  revalidatePath('/portal/instructor/special-sessions')
  revalidatePath('/portal/team-leader/special-sessions')
  return { success: true, data: undefined }
}

// ── Book Trial Session From Lead (create session + add lead in one step) ─────

const bookTrialFromLeadSchema = z.object({
  lead_id:          z.string().uuid(),
  instructor_id:    z.string().uuid(),
  scheduled_at:     z.string().min(1),
  duration_minutes: z.coerce.number().int().min(15).max(480).default(60),
  course_name:      z.string().max(200).optional().or(z.literal('')),
  notes:            z.string().max(1000).optional().or(z.literal('')),
})

export async function bookTrialFromLead(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ sessionId: string }>> {
  const user = await requirePermission('manage_schedule')
  const db   = createServiceClient()

  const parsed = bookTrialFromLeadSchema.safeParse({
    lead_id:          formData.get('lead_id'),
    instructor_id:    formData.get('instructor_id'),
    scheduled_at:     formData.get('scheduled_at'),
    duration_minutes: formData.get('duration_minutes') ?? 60,
    course_name:      formData.get('course_name') || undefined,
    notes:            formData.get('notes') || undefined,
  })
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  const { data: lead } = await db
    .from('leads')
    .select('id, child_name, phone, whatsapp, branch_id')
    .eq('id', d.lead_id)
    .maybeSingle()

  if (!lead) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Lead not found.' } }
  }

  const branchId = (lead as any).branch_id as string

  const notesValue = [
    d.course_name ? `Course: ${d.course_name}` : null,
    d.notes || null,
  ].filter(Boolean).join('\n') || null

  const { data: schedule, error: schedErr } = await db
    .from('schedules')
    .insert({
      group_course_id:  null,
      branch_id:        branchId,
      scheduled_at:     new Date(d.scheduled_at).toISOString(),
      duration_minutes: d.duration_minutes,
      type:             'trial',
      status:           'scheduled',
      notes:            notesValue,
      created_by:       user.id,
    })
    .select('id')
    .single()

  if (schedErr || !schedule) {
    return { success: false, error: { code: 'DB_ERROR', message: schedErr?.message ?? 'Failed to create trial session.' } }
  }

  const sessionId = (schedule as any).id as string

  await db.from('session_instructors').upsert({
    session_id:    sessionId,
    instructor_id: d.instructor_id,
    submitted_at:  null,
  }, { onConflict: 'session_id,instructor_id', ignoreDuplicates: false })

  await db.from('trial_session_students').insert({
    schedule_id:  sessionId,
    lead_id:      d.lead_id,
    student_name: (lead as any).child_name,
    parent_phone: (lead as any).phone ?? (lead as any).whatsapp ?? null,
  })

  await db.from('leads').update({ status: 'TRIAL_BOOKED' }).eq('id', d.lead_id)

  const { data: instrUser } = await db
    .from('instructors')
    .select('user_id')
    .eq('id', d.instructor_id)
    .maybeSingle()

  if (instrUser) {
    void seedTrialSessionAssignedNotification(
      (instrUser as any).user_id as string,
      sessionId,
      new Date(d.scheduled_at).toISOString()
    ).catch(() => { /* non-critical */ })
  }

  revalidatePath('/portal/team-leader/leads')
  revalidatePath('/portal/team-leader/special-sessions')
  revalidatePath('/portal/instructor/special-sessions')
  return { success: true, data: { sessionId } }
}

// ── Update Trial Session Student data ────────────────────────────────────────
// Instructor or TL can fix name / phone / notes on any trial_session_students row.

const updateTrialStudentSchema = z.object({
  student_id:    z.string().uuid(),
  student_name:  z.string().min(1, 'Name is required'),
  parent_phone:  z.string().max(30).optional().or(z.literal('')),
  student_phone: z.string().max(30).optional().or(z.literal('')),
  notes:         z.string().max(500).optional().or(z.literal('')),
})

export async function updateTrialStudent(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  const parsed = updateTrialStudentSchema.safeParse({
    student_id:    formData.get('student_id'),
    student_name:  formData.get('student_name'),
    parent_phone:  formData.get('parent_phone')  || undefined,
    student_phone: formData.get('student_phone') || undefined,
    notes:         formData.get('notes')         || undefined,
  })
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data
  const { error } = await db
    .from('trial_session_students')
    .update({
      student_name:  d.student_name,
      parent_phone:  d.parent_phone  || null,
      student_phone: d.student_phone || null,
      notes:         d.notes         || null,
    })
    .eq('id', d.student_id)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath('/portal/team-leader/special-sessions')
  revalidatePath('/portal/instructor/special-sessions')
  return { success: true, data: undefined }
}

// ── Postpone Special Session ──────────────────────────────────────────────────

const postponeSpecialSchema = z.object({
  session_id: z.string().uuid(),
  reason:     z.string().max(500).optional().or(z.literal('')),
  new_date:   z.string().optional().or(z.literal('')),
})

export async function postponeSpecialSession(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_attendance')
  const db   = createServiceClient()

  const parsed = postponeSpecialSchema.safeParse({
    session_id: formData.get('session_id'),
    reason:     formData.get('reason') || undefined,
    new_date:   formData.get('new_date') || undefined,
  })
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  const { data: sess } = await db
    .from('schedules')
    .select('status, branch_id')
    .eq('id', d.session_id)
    .is('group_course_id', null)
    .maybeSingle()

  if (!sess) return { success: false, error: { code: 'NOT_FOUND', message: 'Session not found.' } }
  if ((sess as any).status === 'completed') {
    return { success: false, error: { code: 'VALIDATION', message: 'Cannot postpone a completed session.' } }
  }

  const updates: Record<string, unknown> = {
    status:           'postponed',
    postponed_reason: d.reason || null,
  }
  if (d.new_date) updates.scheduled_at = new Date(d.new_date).toISOString()

  await db.from('schedules').update(updates).eq('id', d.session_id)

  // Rollback trial attendance on postpone (same behavior as primary sessions)
  await db.from('trial_session_students').update({ attendance_status: null }).eq('schedule_id', d.session_id)
  await db.from('makeup_session_students').update({ attendance_status: null }).eq('schedule_id', d.session_id)

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'special_session.postpone',
    p_entity_type:  'schedule',
    p_entity_id:    d.session_id,
    p_new_values:   { reason: d.reason, new_date: d.new_date },
    p_branch_id:    (sess as any).branch_id,
  })

  revalidatePath('/portal/instructor/special-sessions')
  revalidatePath('/portal/team-leader/special-sessions')
  return { success: true, data: undefined }
}

// ── Bulk Book Trial Session From Leads ────────────────────────────────────────
// Creates one trial session and attaches multiple leads in a single operation.

const bulkBookTrialSchema = z.object({
  instructor_id:    z.string().uuid(),
  scheduled_at:     z.string().min(1),
  duration_minutes: z.coerce.number().int().min(15).max(480).default(60),
  branch_id:        z.string().uuid(),
  notes:            z.string().max(1000).optional().or(z.literal('')),
  lead_ids:         z.string().min(1),
})

export async function bulkBookTrialFromLeads(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ sessionId: string; attachedCount: number }>> {
  const user = await requirePermission('manage_schedule')
  const db   = createServiceClient()

  let rawLeadIds: unknown
  try {
    rawLeadIds = JSON.parse(formData.get('lead_ids') as string ?? '[]')
  } catch {
    rawLeadIds = []
  }
  const leadIds = Array.isArray(rawLeadIds) ? rawLeadIds.filter((x): x is string => typeof x === 'string') : []

  if (leadIds.length === 0) {
    return { success: false, error: { code: 'VALIDATION', message: 'Select at least one lead.' } }
  }

  const parsed = bulkBookTrialSchema.safeParse({
    instructor_id:    formData.get('instructor_id'),
    scheduled_at:     formData.get('scheduled_at'),
    duration_minutes: formData.get('duration_minutes') ?? 60,
    branch_id:        formData.get('branch_id'),
    notes:            formData.get('notes') || undefined,
    lead_ids:         formData.get('lead_ids'),
  })
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  const { data: schedule, error: schedErr } = await db
    .from('schedules')
    .insert({
      group_course_id:  null,
      branch_id:        d.branch_id,
      scheduled_at:     new Date(d.scheduled_at).toISOString(),
      duration_minutes: d.duration_minutes,
      type:             'trial',
      status:           'scheduled',
      notes:            d.notes || null,
      created_by:       user.id,
    })
    .select('id')
    .single()

  if (schedErr || !schedule) {
    return { success: false, error: { code: 'DB_ERROR', message: schedErr?.message ?? 'Failed to create trial session.' } }
  }

  const sessionId = (schedule as any).id as string

  await db.from('session_instructors').upsert({
    session_id:    sessionId,
    instructor_id: d.instructor_id,
    submitted_at:  null,
  }, { onConflict: 'session_id,instructor_id', ignoreDuplicates: false })

  // Fetch all selected leads and attach them
  const { data: leads } = await db
    .from('leads')
    .select('id, child_name, phone, whatsapp')
    .in('id', leadIds)

  let attachedCount = 0
  for (const lead of (leads ?? []) as any[]) {
    const { error } = await db.from('trial_session_students').insert({
      schedule_id:  sessionId,
      lead_id:      lead.id,
      student_name: lead.child_name,
      parent_phone: lead.phone ?? lead.whatsapp ?? null,
    })
    if (!error) {
      attachedCount++
      await db.from('leads').update({ status: 'TRIAL_BOOKED' }).eq('id', lead.id)
    }
  }

  // Notify instructor
  const { data: instrUser } = await db
    .from('instructors')
    .select('user_id')
    .eq('id', d.instructor_id)
    .maybeSingle()

  if (instrUser) {
    void seedTrialSessionAssignedNotification(
      (instrUser as any).user_id as string,
      sessionId,
      new Date(d.scheduled_at).toISOString()
    ).catch(() => { /* non-critical */ })
  }

  revalidatePath('/portal/team-leader/leads')
  revalidatePath('/portal/team-leader/special-sessions')
  revalidatePath('/portal/instructor/special-sessions')
  return { success: true, data: { sessionId, attachedCount } }
}
