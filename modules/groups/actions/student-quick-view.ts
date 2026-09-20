'use server'

import { getStudentPortalCredentials }        from '@/modules/students/portal-credentials'
import { getParentPortalCredentialsForStudent } from '@/modules/parents/portal-credentials'
import { createServiceClient }         from '@/lib/supabase/service'
import { requirePermission }           from '@/modules/rbac/guards'
import type { StudentAttendanceSummary } from './types'

export { getStudentPortalCredentials }
export { getParentPortalCredentialsForStudent }

// Backward-compat alias — callers that import getStudentAuthDataAction continue to work.
export const getStudentAuthDataAction = getStudentPortalCredentials

// Client-callable wrapper for the student's primary parent portal credentials.
export const getParentAuthDataAction = getParentPortalCredentialsForStudent

// ── Attendance summary (live from attendance_records) ─────────────────────────

export async function getStudentAttendanceSummaryAction(
  studentId: string,
  enrollmentId?: string | null,
): Promise<StudentAttendanceSummary> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  // A contract view is financial/package-scoped, not the student's lifetime
  // academic history. The ledger is the single source of truth for that scope.
  let attendanceRecordIds: string[] | null = null
  if (enrollmentId) {
    const { data: consumptions } = await db
      .from('attendance_consumptions')
      .select('attendance_record_id')
      .eq('student_id', studentId)
      .eq('enrollment_id', enrollmentId)
    attendanceRecordIds = (consumptions ?? []).map((row: any) => row.attendance_record_id as string)
    if (attendanceRecordIds.length === 0) {
      return emptyAttendanceSummary()
    }
  }

  let query = db
    .from('attendance_records')
    .select('status')
    .eq('student_id', studentId)
    .is('invalidated_at', null)

  if (attendanceRecordIds) query = query.in('id', attendanceRecordIds)
  const { data } = await query

  const rows = (data ?? []) as Array<{ status: string }>

  let present   = 0
  let absent    = 0
  let late      = 0
  let excused   = 0
  let makeup    = 0
  let cancelled = 0

  for (const r of rows) {
    switch (r.status) {
      case 'present':   present++;   break
      case 'absent':    absent++;    break
      case 'late':      late++;      break
      case 'excused':   excused++;   break
      case 'makeup':    makeup++;    break
      case 'cancelled': cancelled++; break
    }
  }

  const consumed    = present + absent + late + excused + makeup
  const denominator = present + absent + late
  const pct = denominator > 0 ? Math.round((present / denominator) * 100) : 0

  return {
    present_count:   present,
    absent_count:    absent,
    late_count:      late,
    excused_count:   excused,
    makeup_count:    makeup,
    cancelled_count: cancelled,
    consumed_count:  consumed,
    total_records:   rows.length,
    attendance_pct:  pct,
  }
}

function emptyAttendanceSummary(): StudentAttendanceSummary {
  return {
    present_count: 0, absent_count: 0, late_count: 0, excused_count: 0,
    makeup_count: 0, cancelled_count: 0, consumed_count: 0,
    total_records: 0, attendance_pct: 0,
  }
}
