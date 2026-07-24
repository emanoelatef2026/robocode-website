'use server'

// Historical Enrollment Reconciliation — the single reusable service behind
// every enrollment path in the app. When a student joins a group that already
// has completed sessions, this module is the ONLY place that decides what
// happens to those historical sessions: preview what's missing, and apply the
// staff's choice (all / manual / next-session-only, with insufficient-contract
// handling). No UI component or entry point may reimplement this logic.
//
// Types + the pure impact calculation live in ./historical-reconciliation-shared
// (importable from client components too) — a 'use server' file may only
// export async functions, so they can't live here alongside the actions below.
//
// Deliberately reuses, rather than duplicates:
//   - modules/academic/enrollment-integrity.ts   → findActiveEnrollmentForCourse
//   - modules/groups/actions/cohort-health.ts    → the "missing attendance" anti-join shape
//   - the `apply_historical_reconciliation_records` SQL RPC for the atomic
//     create-attendance + consume-session step (mirrors consume_attendance_sessions_batch)
//   - lib/timeline, modules/notifications, write_audit_log for downstream effects
//
// See docs: C:\Users\Emanoel\.claude\plans\peppy-toasting-thimble.md

import { revalidatePath }      from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission }   from '@/modules/rbac/guards'
import { findActiveEnrollmentForCourse } from '@/modules/academic/enrollment-integrity'
import { logTimelineEvents }   from '@/lib/timeline'
import { getParentUserIdsForStudent } from '@/modules/notifications/queries'
import { seedAttendanceRecordedNotification } from '@/modules/notifications/actions'
import { computeReconciliationImpact } from './historical-reconciliation-shared'
import type {
  HistoricalSessionRow,
  EnrollmentSummary,
  PreviewHistoricalReconciliationInput,
  PreviewHistoricalReconciliationResult,
  ReconciliationChoice,
  ShortfallResolution,
  ApplyHistoricalReconciliationInput,
  ApplyHistoricalReconciliationResult,
  ApplyHistoricalReconciliationActionInput,
} from './historical-reconciliation-shared'
import type { ActionResult } from '@/types/app'

export type {
  HistoricalSessionRow,
  EnrollmentSummary,
  ReconciliationImpact,
  PreviewHistoricalReconciliationInput,
  PreviewHistoricalReconciliationResult,
  ReconciliationChoice,
  ShortfallResolution,
  ApplyHistoricalReconciliationInput,
  ApplyHistoricalReconciliationResult,
  ApplyHistoricalReconciliationActionInput,
} from './historical-reconciliation-shared'

type Db = ReturnType<typeof createServiceClient>

// ── Core: compute what's missing + the enrollment context ─────────────────────
// Server-computed truth. Never derives eligibility from client-supplied counts.

async function _computePreview(
  db:    Db,
  input: PreviewHistoricalReconciliationInput
): Promise<PreviewHistoricalReconciliationResult> {
  const empty: PreviewHistoricalReconciliationResult = {
    sessions:       [],
    enrollment:     null,
    impactAll:      computeReconciliationImpact(0, 0, null),
    impactNextOnly: computeReconciliationImpact(0, 0, null),
  }

  // 1. Completed schedules for this group (same shape as cohort-health.ts's
  // "missing attendance" anti-join — reused, not reinvented).
  const { data: groupCourses } = await db
    .from('group_courses')
    .select('id, course_id')
    .eq('group_id', input.groupId)

  const groupCourseIds = (groupCourses ?? []).map((gc: any) => gc.id as string)
  if (!groupCourseIds.length) return empty

  const courseId = input.courseId ?? (groupCourses as any[])[0]?.course_id ?? null

  const { data: schedules } = await db
    .from('schedules')
    .select('id, session_number, topic, scheduled_at')
    .in('group_course_id', groupCourseIds)
    .eq('status', 'completed')
    .order('scheduled_at', { ascending: true })

  const scheduleRows = (schedules ?? []) as Array<{ id: string; session_number: number | null; topic: string | null; scheduled_at: string }>
  if (!scheduleRows.length) return empty

  // 2. Which of those does this student already have attendance for?
  // Keyed on (schedule_id, student_id) only — NOT on enrollment_id — so a
  // transferred-back or re-enrolled student's already-attended sessions
  // (any prior enrollment, any status, rows never deleted) never reappear.
  const { data: existingAttendance } = await db
    .from('attendance_records')
    .select('schedule_id')
    .eq('student_id', input.studentId)
    .in('schedule_id', scheduleRows.map(s => s.id))

  const alreadyHas = new Set((existingAttendance ?? []).map((r: any) => r.schedule_id as string))

  const sessions: HistoricalSessionRow[] = scheduleRows
    .filter(s => !alreadyHas.has(s.id))
    .map(s => ({
      schedule_id:    s.id,
      session_number: s.session_number,
      topic:          s.topic,
      scheduled_at:   s.scheduled_at,
    }))

  // 3. Resolve the enrollment to consume against.
  let enrollmentId = input.enrollmentId ?? null
  if (!enrollmentId) {
    const found = await findActiveEnrollmentForCourse(db, input.studentId, courseId)
    enrollmentId = found?.id ?? null
  }

  let enrollment: EnrollmentSummary | null = null
  if (enrollmentId) {
    const { data: enrRow } = await db
      .from('student_enrollments')
      .select('id, enrolled_sessions, consumed_sessions, remaining_sessions, allow_overdraft_sessions, net_amount')
      .eq('id', enrollmentId)
      .maybeSingle()
    if (enrRow) {
      const e = enrRow as any
      enrollment = {
        id:                       e.id,
        enrolled_sessions:        Number(e.enrolled_sessions ?? 0),
        consumed_sessions:        Number(e.consumed_sessions ?? 0),
        remaining_sessions:       Number(e.remaining_sessions ?? 0),
        allow_overdraft_sessions: Boolean(e.allow_overdraft_sessions),
        net_amount:               Number(e.net_amount ?? 0),
      }
    }
  }

  return {
    sessions,
    enrollment,
    impactAll:      computeReconciliationImpact(sessions.length, sessions.length, enrollment),
    impactNextOnly: computeReconciliationImpact(sessions.length, 0, enrollment),
  }
}

export async function previewHistoricalReconciliation(
  input: PreviewHistoricalReconciliationInput
): Promise<ActionResult<PreviewHistoricalReconciliationResult>> {
  const db = createServiceClient()
  try {
    return { success: true, data: await _computePreview(db, input) }
  } catch (err: any) {
    return { success: false, error: { code: 'PREVIEW_ERROR', message: err?.message ?? 'Unknown error' } }
  }
}

export async function previewHistoricalReconciliationAction(
  input: PreviewHistoricalReconciliationInput
): Promise<ActionResult<PreviewHistoricalReconciliationResult>> {
  await requirePermission('manage_attendance')
  return previewHistoricalReconciliation(input)
}

// ── Core: apply the staff's choice ─────────────────────────────────────────────
// Steps 1 (create attendance) + 2 (consume) run atomically inside the
// `apply_historical_reconciliation_records` SQL RPC — Supabase's JS client has
// no cross-call transaction, and this codebase's convention for atomic
// multi-row consumption is always a Postgres function (consume_attendance_
// sessions_batch is the precedent). Timeline/notification/audit are best-effort
// TypeScript side-effects after the RPC succeeds, same as recordAttendanceSession.

async function _applyInternal(
  db:    Db,
  input: ApplyHistoricalReconciliationInput
): Promise<ApplyHistoricalReconciliationResult> {
  if (input.choice.mode === 'NEXT_ONLY') {
    return { created: 0, consumed: 0, unfunded: 0, cancelled: false }
  }

  // Re-derive the missing-session set AND the enrollment to consume against —
  // server-side, always. Client selections are IDs only, never trusted for
  // eligibility, counts, or which contract applies.
  const preview = await _computePreview(db, {
    studentId:    input.studentId,
    groupId:      input.groupId,
    courseId:     input.courseId,
    enrollmentId: input.enrollmentId,
  })

  const missingIds = new Set(preview.sessions.map(s => s.schedule_id))
  let targetIds: string[]
  if (input.choice.mode === 'ALL') {
    targetIds = preview.sessions.map(s => s.schedule_id)
  } else {
    targetIds = input.choice.scheduleIds.filter(id => missingIds.has(id))
  }

  if (!targetIds.length) return { created: 0, consumed: 0, unfunded: 0, cancelled: false }

  // FIFO order — preview.sessions is already ascending by scheduled_at.
  const orderIndex = new Map(preview.sessions.map((s, i) => [s.schedule_id, i]))
  targetIds = [...targetIds].sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0))

  if (!preview.enrollment) throw new Error('No active contract for this course — cannot consume sessions.')
  const enrollmentId = preview.enrollment.id
  const remaining     = preview.enrollment.remaining_sessions
  const openEnded     = preview.enrollment.enrolled_sessions === 0
  const unlimited     = openEnded || preview.enrollment.allow_overdraft_sessions

  let fundedCount = targetIds.length

  if (!unlimited && targetIds.length > remaining) {
    const resolution = input.shortfallResolution ?? 'CANCEL'
    if (resolution === 'CANCEL') {
      return { created: 0, consumed: 0, unfunded: 0, cancelled: true }
    }
    if (resolution === 'CONSUME_WHAT_FITS') {
      targetIds   = targetIds.slice(0, remaining)
      fundedCount = targetIds.length
    } else {
      // UNPAID_PENDING — create attendance for the full selection, fund only
      // the first `remaining`. The rest are attendance-with-no-consumption
      // (UNFUNDED, per v_attendance_funding_status) — picked up automatically
      // by the existing reconcileEnrollment sweep once the contract is topped up.
      fundedCount = remaining
    }
  }

  if (!targetIds.length) return { created: 0, consumed: 0, unfunded: 0, cancelled: false }

  const { data: rpcData, error: rpcErr } = await db.rpc('apply_historical_reconciliation_records', {
    p_schedule_ids:  targetIds,
    p_funded_count:  fundedCount,
    p_student_id:    input.studentId,
    p_enrollment_id: enrollmentId,
    p_recorded_by:   input.performedBy,
  })
  if (rpcErr) throw new Error(rpcErr.message)

  const rows = (rpcData ?? []) as Array<{ attendance_record_id: string; schedule_id: string; funded: boolean }>
  const created  = rows.length
  const consumed = rows.filter(r => r.funded).length
  const unfunded = created - consumed

  // ── Non-fatal downstream effects — never fail the reconciliation over these ──
  try {
    await logTimelineEvents(rows.map(r => ({
      student_id:    input.studentId,
      enrollment_id: enrollmentId,
      schedule_id:   r.schedule_id,
      event_type:    'HISTORICAL_RECONCILIATION' as const,
      notes:         r.funded
        ? 'Historical session reconciled and consumed from contract.'
        : 'Historical session reconciled — unfunded, pending contract top-up.',
      created_by:    input.performedBy,
      branch_id:     input.branchId ?? null,
    })))
  } catch { /* non-fatal */ }

  try {
    const [{ data: groupRow }, parentUserIds] = await Promise.all([
      db.from('groups').select('name').eq('id', input.groupId).maybeSingle(),
      getParentUserIdsForStudent(input.studentId),
    ])
    const groupName = (groupRow as any)?.name ?? null
    for (const recordRow of rows) {
      for (const parentUserId of parentUserIds) {
        await seedAttendanceRecordedNotification(parentUserId, recordRow.attendance_record_id, 'present', groupName)
      }
    }
  } catch { /* non-fatal */ }

  try {
    await db.rpc('write_audit_log', {
      p_performed_by: input.performedBy,
      p_action:       'historical_enrollment_reconciliation',
      p_entity_type:  'student_enrollments',
      p_entity_id:    enrollmentId,
      p_new_values:   { mode: input.choice.mode, created, consumed, unfunded },
      p_branch_id:    input.branchId ?? null,
    })
  } catch { /* non-fatal */ }

  revalidatePath('/portal/team-leader/attendance')
  revalidatePath('/portal/team-leader/finance')
  revalidatePath('/portal/team-leader/groups')
  revalidatePath('/admin/attendance')
  revalidatePath('/admin/finance')
  revalidatePath('/portal/parent/finance')
  revalidatePath('/portal/parent/attendance')
  revalidatePath('/portal/student')

  return { created, consumed, unfunded, cancelled: false }
}

export async function applyHistoricalReconciliation(
  input: ApplyHistoricalReconciliationInput
): Promise<ActionResult<ApplyHistoricalReconciliationResult>> {
  const db = createServiceClient()
  try {
    return { success: true, data: await _applyInternal(db, input) }
  } catch (err: any) {
    return { success: false, error: { code: 'RECONCILE_ERROR', message: err?.message ?? 'Unknown error' } }
  }
}

// Client-callable wrapper. `performedBy` is NEVER taken from the caller here —
// a client component cannot be trusted to supply its own actor id — it is
// always overridden with the permission-checked session user.
export async function applyHistoricalReconciliationAction(
  input: ApplyHistoricalReconciliationActionInput
): Promise<ActionResult<ApplyHistoricalReconciliationResult>> {
  const user = await requirePermission('manage_attendance')
  return applyHistoricalReconciliation({ ...input, performedBy: user.id })
}

// ── Chokepoint helper: called from every enrollment entry point ──────────────
// No permission check (mirrors _internalReconcileEnrollment) — callers already
// hold their own permission. Two modes:
//   - `choice` provided (a UI dialog already ran) → applies it for real.
//   - `choice` omitted (server-only flow, no dialog) → never auto-consumes;
//     only flags (timeline + audit) that historical sessions are pending, so
//     nothing is silently created/consumed without staff confirmation.
// Always non-fatal to the caller — reconciliation issues must never break
// the enrollment write that already committed.
//
// Note: `db` in the input is not serializable, which is fine — this function
// is only ever imported and called from other server modules, never invoked
// as a client→server RPC (same pattern as _internalReconcileEnrollment in
// modules/attendance/reconciliation.ts, also a 'use server' export).

export interface ReconcileGroupJoinInput {
  db:           Db
  studentId:    string
  groupId:      string
  courseId?:    string | null
  branchId?:    string | null
  performedBy:  string
  enrollmentId?: string | null
  choice?:      ReconciliationChoice
  shortfallResolution?: ShortfallResolution
}

export async function reconcileGroupJoin(input: ReconcileGroupJoinInput): Promise<void> {
  try {
    const enrollmentId = input.enrollmentId ??
      (await findActiveEnrollmentForCourse(input.db, input.studentId, input.courseId ?? null))?.id ??
      null

    if (input.choice && input.choice.mode !== 'NEXT_ONLY') {
      if (!enrollmentId) return // nothing to consume against — surfaced by the dialog's own preview
      await _applyInternal(input.db, {
        studentId:    input.studentId,
        groupId:      input.groupId,
        enrollmentId,
        choice:       input.choice,
        shortfallResolution: input.shortfallResolution,
        performedBy:  input.performedBy,
        branchId:     input.branchId,
      })
      return
    }

    // No dialog ran (or it resolved to "start from next session") — flag only,
    // never auto-create/auto-consume.
    const preview = await _computePreview(input.db, {
      studentId:    input.studentId,
      groupId:      input.groupId,
      courseId:     input.courseId,
      enrollmentId,
    })
    if (preview.sessions.length === 0) return

    await logTimelineEvents([{
      student_id:    input.studentId,
      enrollment_id: enrollmentId,
      event_type:    'HISTORICAL_RECONCILIATION',
      severity:      'WARNING',
      notes:         `${preview.sessions.length} completed session(s) pending — reconcile via the Team Leader portal.`,
      created_by:    input.performedBy,
      branch_id:     input.branchId ?? null,
    }])

    await input.db.rpc('write_audit_log', {
      p_performed_by: input.performedBy,
      p_action:       'historical_enrollment_reconciliation_flagged',
      p_entity_type:  'group_students',
      p_entity_id:    input.groupId,
      p_new_values:   { student_id: input.studentId, pending_sessions: preview.sessions.length },
      p_branch_id:    input.branchId ?? null,
    })
  } catch {
    // Non-fatal — the enrollment write already committed.
  }
}
