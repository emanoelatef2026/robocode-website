'use server'

import { getStudentPortalCredentials } from '@/modules/students/portal-credentials'
import { createServiceClient }         from '@/lib/supabase/service'
import { requirePermission }           from '@/modules/rbac/guards'
import type { StudentAttendanceSummary } from './types'

export { getStudentPortalCredentials }

// Backward-compat alias — callers that import getStudentAuthDataAction continue to work.
export const getStudentAuthDataAction = getStudentPortalCredentials

// ── Attendance summary (live from attendance_records) ─────────────────────────

export async function getStudentAttendanceSummaryAction(
  studentId: string,
): Promise<StudentAttendanceSummary> {
  await requirePermission('manage_attendance')
  const db = createServiceClient()

  const { data } = await db
    .from('attendance_records')
    .select('status')
    .eq('student_id', studentId)

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
