'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import { getOrCreateGroupCourse } from './queries'
import { resolveGroupProgressContext } from '@/modules/progress/resolve'
import { safeRecalcProgressBatch, buildBatchTuples } from '@/modules/progress/safe-recalc'
import { SLOT_CONSUMING_STATUSES } from './constants'
import { validateAcademicTopic } from '@/modules/academic/constants'
import {
  checkConsumptionEligibility,
  resolveFifoEnrollment,
  type EnrollmentForConsumption,
  type StudentConsumptionResult,
} from '@/modules/academic/contract-consumption'
import { awardXP, XP_AWARDS } from '@/modules/gamification/xp-service'
import { checkAndUnlockAchievements } from '@/modules/gamification/achievement-service'
import { checkAndAwardBadges } from '@/modules/gamification/badge-service'
import type { ActionResult } from '@/types/app'
import type { AttendanceStatus } from '@/types/enums'

// ── Return type ────────────────────────────────────────────────────────────────

export interface SessionAttendanceResult {
  scheduleId:         string
  consumptionResults: StudentConsumptionResult[]
}

// ── Action ─────────────────────────────────────────────────────────────────────

export async function recordAttendanceSession(
  formData: FormData
): Promise<ActionResult<SessionAttendanceResult>> {
  const user = await requirePermission('manage_attendance')
  const db   = createServiceClient()

  const group_id         = formData.get('group_id')         as string
  const branch_id        = formData.get('branch_id')        as string
  const session_date     = formData.get('session_date')     as string
  const duration_minutes = Number(formData.get('duration_minutes') ?? 60)
  const delivery         = (formData.get('delivery') ?? 'offline') as string
  const topic_raw        = formData.get('topic') as string | null

  if (!group_id || !branch_id || !session_date) {
    return { success: false, error: { code: 'VALIDATION', message: 'Group, branch, and session date are required.' } }
  }

  // Topic is required for every academically recorded session
  const validatedTopic = validateAcademicTopic(topic_raw)
  if (!validatedTopic) {
    return { success: false, error: { code: 'VALIDATION', message: 'Session topic is required. Enter a short description of what was taught.' } }
  }

  if (!isBranchAccessible(user, branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this branch.' } }
  }

  const studentIds = formData.getAll('student_ids[]') as string[]
  if (studentIds.length === 0) {
    return { success: false, error: { code: 'VALIDATION', message: 'No students selected.' } }
  }

  // Validate student IDs against actual group membership (injection guard)
  const { data: validMembers, error: memberError } = await db
    .from('group_students')
    .select('student_id')
    .eq('group_id', group_id)
    .eq('status', 'active')
    .in('student_id', studentIds)

  if (memberError) {
    return { success: false, error: { code: 'DB_ERROR', message: memberError.message } }
  }

  const validSet       = new Set((validMembers ?? []).map((m: { student_id: string }) => m.student_id))
  const safeStudentIds = studentIds.filter((sid) => validSet.has(sid))

  if (safeStudentIds.length === 0) {
    return { success: false, error: { code: 'VALIDATION', message: 'No valid group members found in submission.' } }
  }

  const groupCourseId = await getOrCreateGroupCourse(group_id, branch_id)
  if (!groupCourseId) {
    return { success: false, error: { code: 'DB_ERROR', message: 'Failed to initialize course for this group.' } }
  }

  const sessionDateISO  = new Date(session_date).toISOString()
  const sessionDatePart = sessionDateISO.slice(0, 10)  // 'YYYY-MM-DD' for enrollment window

  // ── Parallel: snapshot data + enrollments ─────────────────────────────────────
  const [
    { data: allEnrollRows },
    { data: gcSnap },
    { data: groupSnap },
    { data: branchSnap },
  ] = await Promise.all([
    // Fetch ALL ACTIVE enrollments — we apply the start_date window in JS
    // so we can show 'pre_enrollment' reason even for future-starting contracts.
    db.from('student_enrollments')
      .select('id, student_id, remaining_sessions, allow_overdraft_sessions, enrolled_sessions, start_date, end_date')
      .eq('status', 'ACTIVE')
      .in('student_id', safeStudentIds)
      .order('start_date', { ascending: true })
      .order('created_at', { ascending: true }),

    db.from('group_courses')
      .select(`
        courses(title),
        instructors!group_courses_instructor_id_fkey(
          users!instructors_user_id_fkey(
            profiles!profiles_user_id_fkey(first_name, last_name)
          )
        )
      `)
      .eq('id', groupCourseId)
      .maybeSingle(),

    db.from('groups').select('name').eq('id', group_id).maybeSingle(),
    db.from('branches').select('name').eq('id', branch_id).maybeSingle(),
  ])

  // Extract snapshot values for attendance_records denormalised columns
  const courseName = (gcSnap as any)?.courses?.title ?? null
  const instrProf  = (gcSnap as any)?.instructors?.users?.profiles
  const instrName  = instrProf
    ? ([instrProf.first_name, instrProf.last_name].filter(Boolean).join(' ') || null)
    : null
  const groupName  = (groupSnap as any)?.name ?? null
  const branchName = (branchSnap as any)?.name ?? null

  // ── Build per-student enrollment map (FIFO + pre_enrollment support) ──────────
  // Group all ACTIVE enrollments by student, ordered already by start_date ASC.
  const allEnrollsByStudent = new Map<string, EnrollmentForConsumption[]>()

  for (const e of (allEnrollRows ?? []) as any[]) {
    const sid     = e.student_id as string
    const entry: EnrollmentForConsumption = {
      id:                 e.id,
      start_date:         e.start_date ?? sessionDatePart,  // fallback to session date if missing
      end_date:           (e.end_date as string | null) ?? null,
      enrolled_sessions:  Number(e.enrolled_sessions  ?? 0),
      remaining_sessions: Number(e.remaining_sessions ?? 0),
      allow_overdraft:    Boolean(e.allow_overdraft_sessions),
    }
    const list = allEnrollsByStudent.get(sid) ?? []
    list.push(entry)
    allEnrollsByStudent.set(sid, list)
  }

  // For each student, resolve the FIFO enrollment applicable to sessionDate
  const enrollForSession = new Map<string, EnrollmentForConsumption | null>()
  for (const sid of safeStudentIds) {
    const enrollments = allEnrollsByStudent.get(sid) ?? []
    enrollForSession.set(sid, resolveFifoEnrollment(enrollments, sessionDateISO))
  }

  // ── Session upsert: reuse existing schedule at exact same datetime ─────────────
  // This prevents duplicate schedule rows when TL re-records or corrects attendance.
  const { data: existingSchedule } = await db
    .from('schedules')
    .select('id, topic, status')
    .eq('group_course_id', groupCourseId)
    .eq('scheduled_at', sessionDateISO)
    .maybeSingle()

  let scheduleId: string

  if (existingSchedule) {
    scheduleId = (existingSchedule as any).id as string
    // Ensure status is completed and topic is set (update if needed)
    const existingTopic = validateAcademicTopic((existingSchedule as any).topic)
    const needsUpdate   = !existingTopic || (existingSchedule as any).status !== 'completed'
    if (needsUpdate) {
      const { error: updateErr } = await db
        .from('schedules')
        .update({
          status:           'completed',
          topic:            validatedTopic,
          duration_minutes,
          delivery,
        })
        .eq('id', scheduleId)
      if (updateErr) {
        return { success: false, error: { code: 'DB_ERROR', message: updateErr.message } }
      }
    }
  } else {
    // Create new schedule row
    const { data: newSchedule, error: scheduleError } = await db
      .from('schedules')
      .insert({
        group_course_id:  groupCourseId,
        branch_id,
        scheduled_at:     sessionDateISO,
        duration_minutes,
        delivery,
        status:           'completed',
        topic:            validatedTopic,
        created_by:       user.id,
      })
      .select('id')
      .single()

    if (scheduleError || !newSchedule) {
      return { success: false, error: { code: 'DB_ERROR', message: scheduleError?.message ?? 'Failed to create schedule.' } }
    }
    scheduleId = (newSchedule as any).id as string
  }

  // ── Pre-fetch which students already have attendance for this schedule ────────
  // Used below to guard XP from firing again on re-recording (upsert updates, not inserts).
  let existingAttendanceStudentIds = new Set<string>()
  if (existingSchedule) {
    const { data: existingAtts } = await db
      .from('attendance_records')
      .select('student_id')
      .eq('schedule_id', scheduleId)
    existingAttendanceStudentIds = new Set(
      (existingAtts ?? []).map((r: any) => r.student_id as string)
    )
  }

  // ── Insert attendance records (upsert on schedule_id + student_id) ────────────
  const records = safeStudentIds.map((sid) => ({
    schedule_id:               scheduleId,
    student_id:                sid,
    status:                    (formData.get(`status_${sid}`) ?? 'present') as AttendanceStatus,
    notes:                     (formData.get(`notes_${sid}`) as string | null) || null,
    recorded_by:               user.id,
    group_name_snapshot:       groupName,
    course_name_snapshot:      courseName,
    instructor_name_snapshot:  instrName,
    branch_name_snapshot:      branchName,
  }))

  // Upsert: if the student already has an attendance record for this schedule, update it
  const { data: insertedRecords, error: insertError } = await db
    .from('attendance_records')
    .upsert(records, { onConflict: 'schedule_id,student_id', ignoreDuplicates: false })
    .select('id, student_id, status')

  if (insertError) {
    return { success: false, error: { code: 'DB_ERROR', message: insertError.message } }
  }

  // ── Run canonical consumption check per student ───────────────────────────────
  const p_record_ids:     string[] = []
  const p_enrollment_ids: string[] = []
  const p_student_ids:    string[] = []

  // Track which students are being consumed for post-RPC remaining fetch
  const consumedEnrollmentIds = new Set<string>()

  // Pre-compute per-student checks from inserted records
  const checkByStudentId = new Map<string, ReturnType<typeof checkConsumptionEligibility>>()

  for (const rec of (insertedRecords ?? []) as any[]) {
    const sid        = rec.student_id as string
    const enrollment = enrollForSession.get(sid) ?? null
    const check      = checkConsumptionEligibility(
      rec.status as string,
      sessionDateISO,
      enrollment,
      SLOT_CONSUMING_STATUSES
    )
    checkByStudentId.set(sid, check)

    if (check.shouldConsume && enrollment) {
      p_record_ids.push(rec.id)
      p_enrollment_ids.push(enrollment.id)
      p_student_ids.push(sid)
      consumedEnrollmentIds.add(enrollment.id)
    }
  }

  // ── Idempotent batch consumption via ledger ───────────────────────────────────
  // consume_attendance_sessions_batch inserts into attendance_consumptions
  // (UNIQUE on attendance_record_id) and increments consumed_sessions.
  // ON CONFLICT DO NOTHING — safe to retry.
  let updatedRemainingMap = new Map<string, number>()

  if (p_record_ids.length > 0) {
    await db.rpc('consume_attendance_sessions_batch', {
      p_record_ids,
      p_enrollment_ids,
      p_student_ids,
    })

    // Fetch post-consumption remaining_sessions for accurate result display
    const { data: updatedEnrolls } = await db
      .from('student_enrollments')
      .select('id, remaining_sessions')
      .in('id', [...consumedEnrollmentIds])

    updatedRemainingMap = new Map(
      (updatedEnrolls ?? []).map((e: any) => [e.id as string, Number(e.remaining_sessions ?? 0)])
    )
  }

  // ── Build per-student results for UI ─────────────────────────────────────────
  const consumptionResults: StudentConsumptionResult[] = safeStudentIds.map((sid) => {
    const check      = checkByStudentId.get(sid)
    const enrollment = enrollForSession.get(sid) ?? null

    if (!check) {
      // Student had no attendance record (shouldn't happen in normal flow)
      return {
        student_id:            sid,
        consumed:              false,
        reason:                enrollment ? 'no_slot_status' : 'no_contract',
        sessions_remaining:    enrollment?.remaining_sessions ?? null,
        enrollment_start_date: enrollment?.start_date ?? null,
      }
    }

    const remaining = check.shouldConsume && check.enrollmentId
      ? (updatedRemainingMap.get(check.enrollmentId) ?? check.sessionsRemaining)
      : check.sessionsRemaining

    return {
      student_id:            sid,
      consumed:              check.shouldConsume,
      reason:                check.reason,
      sessions_remaining:    remaining,
      enrollment_start_date: check.enrollmentStartDate,
    }
  })

  // ── Record instructor participation (if submitter is an instructor) ──────────
  // Upsert is idempotent — re-submitting attendance won't create duplicates.
  {
    const { data: instrRow } = await db
      .from('instructors')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (instrRow) {
      await db.from('session_instructors').upsert({
        session_id:    scheduleId,
        instructor_id: (instrRow as any).id,
        submitted_at:  new Date().toISOString(),
      }, { onConflict: 'session_id,instructor_id', ignoreDuplicates: false })
    }
  }

  // ── Overdraft timeline events (non-fatal) ─────────────────────────────────────
  const overdraftGrantedIds = consumptionResults
    .filter(r => r.reason === 'overdraft_allowed')
    .map(r => r.student_id)

  if (overdraftGrantedIds.length > 0) {
    const overdraftEvents = overdraftGrantedIds.map(sid => ({
      student_id:  sid,
      schedule_id: scheduleId,
      event_type:  'OVERDRAFT_GRANTED',
      notes:       'Session recorded past package limit (overdraft enabled)',
      created_by:  user.id,
      branch_id,
    }))
    try { await db.from('student_timeline_events').insert(overdraftEvents) } catch { /* table may not exist yet */ }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'record_attendance',
    p_entity_type:  'schedule',
    p_entity_id:    scheduleId,
    p_new_values:   { group_id, session_date, topic: validatedTopic, student_count: records.length },
    p_branch_id:    branch_id,
  })

  const contexts = await resolveGroupProgressContext(group_id)
  if (contexts.length > 0) {
    await safeRecalcProgressBatch(
      buildBatchTuples(safeStudentIds, contexts),
      'recordAttendanceSession'
    )
  }

  // ── XP awards + achievements (fire-and-forget — never blocks the main flow) ──
  // Only award XP for NEW attendance records — skip if TL is correcting an existing record.
  void (async () => {
    try {
      for (const rec of (insertedRecords ?? []) as any[]) {
        const sid    = rec.student_id as string
        const status = rec.status as string
        if (existingAttendanceStudentIds.has(sid)) continue
        if (status === 'present' || status === 'makeup') {
          await awardXP(sid, XP_AWARDS.ATTENDANCE_PRESENT, true)
        } else if (status === 'late') {
          await awardXP(sid, XP_AWARDS.ATTENDANCE_LATE, true)
        } else {
          continue
        }
        await checkAndUnlockAchievements(sid)
        await checkAndAwardBadges(sid)
      }
    } catch { /* XP is never critical — swallow errors */ }
  })()

  revalidatePath('/admin/attendance')
  revalidatePath('/portal/team-leader/attendance')
  revalidatePath('/portal/team-leader/groups')
  revalidatePath('/portal/instructor', 'layout')
  revalidatePath('/portal/student', 'layout')

  return { success: true, data: { scheduleId, consumptionResults } }
}
