'use server'

import { revalidatePath }      from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission }   from '@/modules/rbac/guards'
import { SLOT_CONSUMING_STATUSES } from './constants'
import type { ActionResult }   from '@/types/app'
import type { AttendanceStatus } from '@/types/enums'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReconciliationStudentResult {
  student_id:      string
  matched:         number
  unresolvable:    number
}

export interface ReconciliationSummary {
  students_processed: number
  total_matched:      number
  total_unresolvable: number
  errors:             number
}

interface UnlinkedRecord {
  record_id:    string
  student_id:   string
  session_date: string
  status:       AttendanceStatus
}

interface EnrollmentBucket {
  enrollment_id: string
  start_date:    string
  end_date:      string | null
  capacity:      number    // remaining after previous assignments in this run
}

// ── Core: reconcile one student ───────────────────────────────────────────────
//
// Algorithm:
//   1. Load all attendance_records for student that have NO consumption entry
//      and whose status is slot-consuming (present / absent / late / makeup / excused)
//   2. Load all enrollments (with enrolled_sessions > 0) ordered FIFO by start_date
//   3. For each unlinked record (ascending session_date):
//      - Find the oldest enrollment where:
//          a) session_date >= enrollment.start_date
//          b) enrollment.end_date IS NULL OR session_date <= enrollment.end_date
//          c) enrollment has remaining capacity (enrolled - consumed - already assigned)
//   4. Insert attendance_consumptions entries (ON CONFLICT DO NOTHING = idempotent)
//   5. Call recompute_session_consumption() to sync consumed_sessions counters

export async function reconcileStudentAttendance(
  studentId: string
): Promise<ActionResult<ReconciliationStudentResult>> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  try {
    const result = await _doReconcileStudent(db, studentId)
    revalidatePath('/portal/team-leader/attendance')
    revalidatePath('/admin/attendance')
    return { success: true, data: result }
  } catch (err: any) {
    return { success: false, error: { code: 'RECONCILE_ERROR', message: err?.message ?? 'Unknown error' } }
  }
}

// ── Core: reconcile all students with unlinked attendance ─────────────────────

export async function reconcileAllAttendance(): Promise<ActionResult<ReconciliationSummary>> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  // Find all students with at least one unlinked, slot-consuming attendance record
  const { data: studentRows, error: studentError } = await db
    .from('attendance_records')
    .select('student_id')
    .not('id', 'in', '(SELECT attendance_record_id FROM attendance_consumptions)')
    .in('status', [...SLOT_CONSUMING_STATUSES])

  if (studentError) {
    return { success: false, error: { code: 'DB_ERROR', message: studentError.message } }
  }

  const studentIds = [...new Set((studentRows ?? []).map((r: any) => r.student_id as string))]

  let totalMatched     = 0
  let totalUnresolvable = 0
  let errors           = 0

  for (const sid of studentIds) {
    try {
      const res = await _doReconcileStudent(db, sid)
      totalMatched      += res.matched
      totalUnresolvable += res.unresolvable
    } catch {
      errors++
    }
  }

  revalidatePath('/portal/team-leader/attendance')
  revalidatePath('/admin/attendance')

  return {
    success: true,
    data: {
      students_processed: studentIds.length,
      total_matched:      totalMatched,
      total_unresolvable: totalUnresolvable,
      errors,
    },
  }
}

// ── Internal helper ───────────────────────────────────────────────────────────

async function _doReconcileStudent(
  db: ReturnType<typeof createServiceClient>,
  studentId: string
): Promise<ReconciliationStudentResult> {

  // 1. Unlinked slot-consuming attendance records with session dates
  const { data: arRows, error: arError } = await db
    .from('attendance_records')
    .select(`
      id,
      student_id,
      status,
      schedules!attendance_records_schedule_id_fkey(scheduled_at)
    `)
    .eq('student_id', studentId)
    .not('id', 'in', '(SELECT attendance_record_id FROM attendance_consumptions)')
    .in('status', [...SLOT_CONSUMING_STATUSES])
    .order('recorded_at', { ascending: true })

  if (arError) throw new Error(arError.message)

  const unlinked: UnlinkedRecord[] = (arRows ?? []).map((r: any) => ({
    record_id:    r.id as string,
    student_id:   r.student_id as string,
    session_date: (r.schedules?.scheduled_at as string | null) ?? '',
    status:       r.status as AttendanceStatus,
  })).filter(r => r.session_date)  // skip records with no schedule date

  if (unlinked.length === 0) {
    return { student_id: studentId, matched: 0, unresolvable: 0 }
  }

  // Sort ascending by session_date for FIFO attribution
  unlinked.sort((a, b) => a.session_date.localeCompare(b.session_date))

  // 2. All eligible enrollments for student ordered FIFO
  const { data: enrRows, error: enrError } = await db
    .from('student_enrollments')
    .select(`
      id,
      start_date,
      end_date,
      enrolled_sessions,
      consumed_sessions
    `)
    .eq('student_id', studentId)
    .gt('enrolled_sessions', 0)
    .in('status', ['ACTIVE', 'COMPLETED', 'TRANSFERRED', 'DROPPED', 'CANCELLED', 'PAUSED'])
    .order('start_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (enrError) throw new Error(enrError.message)

  // 3. Build capacity buckets — track how many we assign during this run
  const buckets: EnrollmentBucket[] = (enrRows ?? []).map((e: any) => ({
    enrollment_id: e.id as string,
    start_date:    e.start_date as string,
    end_date:      (e.end_date as string | null) ?? null,
    // remaining capacity = enrolled − already-consumed (from DB)
    // We'll decrement as we assign in this run
    capacity: Math.max(0, Number(e.enrolled_sessions ?? 0) - Number(e.consumed_sessions ?? 0)),
  }))

  // 4. FIFO date-based matching
  const toInsert: Array<{ attendance_record_id: string; enrollment_id: string; student_id: string }> = []
  let unresolvable = 0

  for (const rec of unlinked) {
    // Find oldest eligible bucket
    let assigned = false
    for (const bucket of buckets) {
      if (rec.session_date < bucket.start_date) continue
      if (bucket.end_date && rec.session_date > bucket.end_date) continue
      if (bucket.capacity <= 0) continue

      toInsert.push({
        attendance_record_id: rec.record_id,
        enrollment_id:        bucket.enrollment_id,
        student_id:           studentId,
      })
      bucket.capacity--
      assigned = true
      break
    }
    if (!assigned) unresolvable++
  }

  // 5. Bulk insert consumption entries (ON CONFLICT DO NOTHING = idempotent)
  if (toInsert.length > 0) {
    const insertResult = await db
      .from('attendance_consumptions')
      .insert(toInsert)

    if (insertResult.error) throw new Error((insertResult.error as any).message ?? 'Insert failed')
  }

  // 6. Recompute consumed_sessions counters from ledger for all affected enrollments
  const affectedEnrollmentIds = [...new Set(toInsert.map((r) => r.enrollment_id))]
  for (const enrollmentId of affectedEnrollmentIds) {
    await db.rpc('recompute_session_consumption', { p_enrollment_id: enrollmentId })
  }

  return {
    student_id:   studentId,
    matched:      toInsert.length,
    unresolvable,
  }
}

// ── reconcileAttendanceRecord — link a single record to an enrollment ─────────
//
// Used when a record was created without an enrollment (no-contract path) and
// a contract was later added. Finds the oldest eligible enrollment for that
// record's student + session_date and creates the consumption entry.

export async function reconcileAttendanceRecord(
  attendanceRecordId: string
): Promise<ActionResult<ReconciliationStudentResult>> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  try {
    // Already linked? Return early.
    const { data: existing } = await db
      .from('attendance_consumptions')
      .select('id')
      .eq('attendance_record_id', attendanceRecordId)
      .maybeSingle()

    if (existing) {
      return { success: true, data: { student_id: '', matched: 0, unresolvable: 0 } }
    }

    // Load the record (need student_id + session_date + status)
    const { data: rec, error: recError } = await db
      .from('attendance_records')
      .select(`
        id,
        student_id,
        status,
        schedules!attendance_records_schedule_id_fkey(scheduled_at)
      `)
      .eq('id', attendanceRecordId)
      .single()

    if (recError || !rec) {
      return { success: false, error: { code: 'NOT_FOUND', message: recError?.message ?? 'Record not found.' } }
    }

    const studentId   = (rec as any).student_id as string
    const sessionDate = ((rec as any).schedules?.scheduled_at as string | null) ?? ''
    const status      = (rec as any).status as AttendanceStatus

    if (!SLOT_CONSUMING_STATUSES.has(status)) {
      return { success: true, data: { student_id: studentId, matched: 0, unresolvable: 0 } }
    }
    if (!sessionDate) {
      return { success: false, error: { code: 'VALIDATION', message: 'Attendance record has no schedule date.' } }
    }

    // Find oldest eligible enrollment with remaining capacity
    const { data: enrRows, error: enrError } = await db
      .from('student_enrollments')
      .select('id, start_date, end_date, enrolled_sessions, consumed_sessions')
      .eq('student_id', studentId)
      .gt('enrolled_sessions', 0)
      .in('status', ['ACTIVE', 'COMPLETED', 'TRANSFERRED', 'DROPPED', 'CANCELLED', 'PAUSED'])
      .order('start_date', { ascending: true })
      .order('created_at', { ascending: true })

    if (enrError) {
      return { success: false, error: { code: 'DB_ERROR', message: enrError.message } }
    }

    let matchedEnrollmentId: string | null = null
    for (const e of (enrRows ?? []) as any[]) {
      if (sessionDate < (e.start_date as string)) continue
      if (e.end_date && sessionDate > (e.end_date as string)) continue
      const remaining = Number(e.enrolled_sessions ?? 0) - Number(e.consumed_sessions ?? 0)
      if (remaining <= 0) continue
      matchedEnrollmentId = e.id as string
      break
    }

    if (!matchedEnrollmentId) {
      return { success: true, data: { student_id: studentId, matched: 0, unresolvable: 1 } }
    }

    const insertResult = await db
      .from('attendance_consumptions')
      .insert({ attendance_record_id: attendanceRecordId, enrollment_id: matchedEnrollmentId, student_id: studentId })

    if (insertResult.error) {
      // ON CONFLICT means already linked — not a real error
      if (!(insertResult.error as any).code?.includes('23505')) {
        return { success: false, error: { code: 'DB_ERROR', message: (insertResult.error as any).message ?? 'Insert failed' } }
      }
    }

    await db.rpc('recompute_session_consumption', { p_enrollment_id: matchedEnrollmentId })

    revalidatePath('/portal/team-leader/attendance')
    revalidatePath('/admin/attendance')

    return { success: true, data: { student_id: studentId, matched: 1, unresolvable: 0 } }
  } catch (err: any) {
    return { success: false, error: { code: 'RECONCILE_ERROR', message: err?.message ?? 'Unknown error' } }
  }
}

// ── reconcileEnrollment — link historical attendance to a new enrollment ──────
//
// Called after a contract is created for a student who already has attendance.
// Finds all their unlinked slot-consuming records within the enrollment window
// and attributes them FIFO up to the enrollment's capacity.

// ── Internal helper: reconcile one enrollment (no permission check) ───────────
// Callable from other server actions that already hold a permission.

export async function _internalReconcileEnrollment(
  db: ReturnType<typeof createServiceClient>,
  enrollmentId: string
): Promise<{ matched: number; already_linked: number }> {
  const { data: enr, error: enrError } = await db
    .from('student_enrollments')
    .select('id, student_id, start_date, end_date, enrolled_sessions, consumed_sessions, status')
    .eq('id', enrollmentId)
    .single()

  if (enrError || !enr) return { matched: 0, already_linked: 0 }

  const studentId    = (enr as any).student_id as string
  const startDate    = (enr as any).start_date as string
  const endDate      = ((enr as any).end_date as string | null) ?? null
  const enrolledSess = Number((enr as any).enrolled_sessions ?? 0)
  const consumedSess = Number((enr as any).consumed_sessions ?? 0)

  if (enrolledSess === 0) return { matched: 0, already_linked: 0 }

  const { count: alreadyLinked } = await db
    .from('attendance_consumptions')
    .select('id', { count: 'exact', head: true })
    .eq('enrollment_id', enrollmentId)

  const available = Math.max(0, enrolledSess - consumedSess)
  if (available === 0) return { matched: 0, already_linked: alreadyLinked ?? 0 }

  const { data: arRows, error: arError } = await db
    .from('attendance_records')
    .select(`
      id,
      status,
      schedules!attendance_records_schedule_id_fkey(scheduled_at)
    `)
    .eq('student_id', studentId)
    .not('id', 'in', '(SELECT attendance_record_id FROM attendance_consumptions)')
    .in('status', [...SLOT_CONSUMING_STATUSES])
    .order('recorded_at', { ascending: true })

  if (arError) return { matched: 0, already_linked: alreadyLinked ?? 0 }

  const eligible = (arRows ?? [])
    .map((r: any) => ({
      id:          r.id as string,
      sessionDate: (r.schedules?.scheduled_at as string | null) ?? '',
    }))
    .filter(r => {
      if (!r.sessionDate) return false
      if (r.sessionDate < startDate) return false
      if (endDate && r.sessionDate > endDate) return false
      return true
    })
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))
    .slice(0, available)

  if (eligible.length === 0) return { matched: 0, already_linked: alreadyLinked ?? 0 }

  const toInsert = eligible.map(r => ({
    attendance_record_id: r.id,
    enrollment_id:        enrollmentId,
    student_id:           studentId,
  }))

  const insertResult = await db.from('attendance_consumptions').insert(toInsert)
  if (!insertResult.error) {
    await db.rpc('recompute_session_consumption', { p_enrollment_id: enrollmentId })
  }

  return { matched: eligible.length, already_linked: alreadyLinked ?? 0 }
}

// ── Public action: reconcile one enrollment ───────────────────────────────────

export async function reconcileEnrollment(
  enrollmentId: string
): Promise<ActionResult<{ matched: number; already_linked: number }>> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  try {
    const result = await _internalReconcileEnrollment(db, enrollmentId)
    revalidatePath('/portal/team-leader/attendance')
    revalidatePath('/admin/attendance')
    return { success: true, data: result }
  } catch (err: any) {
    return { success: false, error: { code: 'RECONCILE_ERROR', message: err?.message ?? 'Unknown error' } }
  }
}
