'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { SLOT_CONSUMING_STATUSES } from '@/modules/attendance/constants'
import type { AttendanceStatus } from '@/types/enums'

export interface RecordContractAttendanceInput {
  studentId: string
  enrollmentId: string
  occurredAt: string
  topic: string
  status: AttendanceStatus
  durationMinutes?: number
  delivery?: 'online' | 'offline' | 'hybrid'
  notes?: string
}

/**
 * Records an individual makeup/manual session and attributes it to exactly one
 * contract. It intentionally creates a standalone makeup schedule (no group
 * roster), so it never appears as an attendance session for every student in a
 * group. The consumption row is written explicitly to the selected contract.
 */
export async function recordContractAttendanceAction(
  input: RecordContractAttendanceInput,
): Promise<{ ok: true; consumed: boolean } | { error: string }> {
  const user = await requirePermission('manage_attendance')
  const db = createServiceClient()

  const occurredAt = new Date(input.occurredAt)
  const topic = input.topic.trim()
  const notes = input.notes?.trim() || null
  const duration = Math.floor(input.durationMinutes ?? 60)

  if (!input.studentId || !input.enrollmentId || Number.isNaN(occurredAt.getTime())) {
    return { error: 'Choose a valid student, contract, and attendance date.' }
  }
  if (!topic || topic.length > 200) return { error: 'Enter an attendance topic (up to 200 characters).' }
  if (duration < 15 || duration > 480) return { error: 'Duration must be between 15 and 480 minutes.' }
  if (!['present', 'absent', 'late', 'excused', 'makeup'].includes(input.status)) {
    return { error: 'Choose a valid attendance status.' }
  }

  const { data: enrollment, error: enrollmentError } = await db
    .from('student_enrollments')
    .select(`
      id, student_id, branch_id, status, start_date, end_date,
      enrolled_sessions, remaining_sessions, allow_overdraft_sessions,
      group_name_snapshot, course_name_snapshot, instructor_name_snapshot, branch_name_snapshot
    `)
    .eq('id', input.enrollmentId)
    .maybeSingle()

  if (enrollmentError || !enrollment) return { error: 'Contract not found.' }
  const contract = enrollment as any
  if (contract.student_id !== input.studentId) return { error: 'This contract does not belong to the selected student.' }
  if (contract.status !== 'ACTIVE') return { error: 'Only an active contract can receive attendance.' }
  if (Number(contract.enrolled_sessions ?? 0) <= 0) return { error: 'This contract has no session package to consume.' }

  const day = occurredAt.toISOString().slice(0, 10)
  if (day < String(contract.start_date).slice(0, 10)) {
    return { error: 'For attendance before the contract start, use “Apply completed group sessions” so it is reviewed explicitly.' }
  }
  if (contract.end_date && day > String(contract.end_date).slice(0, 10)) {
    return { error: 'This attendance date is after the contract end date.' }
  }

  const consumes = SLOT_CONSUMING_STATUSES.has(input.status)
  if (consumes && Number(contract.remaining_sessions ?? 0) <= 0 && !contract.allow_overdraft_sessions) {
    return { error: 'This contract has no remaining sessions.' }
  }

  let scheduleId: string | null = null
  const cleanUpUnlinkedSchedule = async () => {
    if (scheduleId) await db.from('schedules').delete().eq('id', scheduleId)
  }
  {
    // Standalone makeup schedule: valid academic history, but no fake group-wide
    // session and no need for the student to be a member of another group.
    const { data: schedule, error: scheduleError } = await db
      .from('schedules')
      .insert({
        group_course_id: null,
        branch_id: contract.branch_id,
        scheduled_at: occurredAt.toISOString(),
        duration_minutes: duration,
        type: 'makeup',
        delivery: input.delivery ?? 'offline',
        status: 'completed',
        topic,
        notes: notes ?? 'Manual contract attendance',
        created_by: user.id,
      })
      .select('id')
      .single()
    if (scheduleError || !schedule) return { error: scheduleError?.message ?? 'Could not create the attendance session.' }
    scheduleId = (schedule as any).id as string

    const { data: attendance, error: attendanceError } = await db
      .from('attendance_records')
      .insert({
        schedule_id: scheduleId,
        student_id: input.studentId,
        status: input.status,
        recorded_by: user.id,
        notes: notes ?? 'Manual contract attendance',
        group_name_snapshot: contract.group_name_snapshot ?? 'Individual makeup session',
        course_name_snapshot: contract.course_name_snapshot ?? null,
        instructor_name_snapshot: contract.instructor_name_snapshot ?? null,
        branch_name_snapshot: contract.branch_name_snapshot ?? null,
      })
      .select('id')
      .single()
    if (attendanceError || !attendance) {
      await cleanUpUnlinkedSchedule()
      return { error: attendanceError?.message ?? 'Could not save attendance.' }
    }

    if (consumes) {
      const { error: consumptionError } = await db
        .from('attendance_consumptions')
        .insert({
          attendance_record_id: (attendance as any).id,
          enrollment_id: input.enrollmentId,
          student_id: input.studentId,
        })
      if (consumptionError) {
        await cleanUpUnlinkedSchedule()
        return { error: consumptionError.message }
      }

      const { error: recomputeError } = await db.rpc('recompute_session_consumption', {
        p_enrollment_id: input.enrollmentId,
      })
      // The ledger row is already the source of truth. Keep the valid record
      // and let the existing repair tooling recompute the cached counter.
      void recomputeError
    }
  }

  revalidatePath('/portal/team-leader/groups')
  revalidatePath('/portal/team-leader/attendance')
  revalidatePath('/portal/team-leader/finance')
  revalidatePath('/admin/groups')
  revalidatePath('/admin/attendance')
  return { ok: true, consumed: consumes }
}
