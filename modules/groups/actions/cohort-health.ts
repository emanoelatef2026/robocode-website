import 'server-only'

// Shared cohort-health checks — extracted from validateCohortArchival
// (Phase 1) so Phase 2's validateCohortGraduation can reuse the exact same
// queries instead of duplicating them. Read-only, never mutates. Takes a `db`
// client (not serializable) so this is an internal helper, never a Server
// Action itself — no 'use server' directive (see db-ops.ts for the same
// convention).
// See docs/DOMAIN_RULES.md Rules 1, 6, 7, 8, 11.

import { createServiceClient } from '@/lib/supabase/service'

type DB = ReturnType<typeof createServiceClient>

export interface CohortHealthWarning {
  code:           string
  message:        string
  recommendation: string
}

export async function computeCohortHealthWarnings(db: DB, groupId: string): Promise<CohortHealthWarning[]> {
  const warnings: CohortHealthWarning[] = []

  const { data: groupCourses } = await db
    .from('group_courses')
    .select('id, course_id')
    .eq('group_id', groupId)

  const groupCourseIds = (groupCourses ?? []).map(gc => gc.id)

  if (groupCourseIds.length) {
    const { data: schedules } = await db
      .from('schedules')
      .select('id, status')
      .in('group_course_id', groupCourseIds)

    const unfinished = (schedules ?? []).filter(s => s.status !== 'completed' && s.status !== 'cancelled')
    if (unfinished.length) {
      warnings.push({
        code:           'unfinished_sessions',
        message:        `${unfinished.length} session(s) are not marked completed or cancelled.`,
        recommendation: 'Mark each remaining session as Completed or Cancelled before proceeding.',
      })
    }

    const completedScheduleIds = (schedules ?? []).filter(s => s.status === 'completed').map(s => s.id)
    if (completedScheduleIds.length) {
      const { data: attendanceRows } = await db
        .from('attendance_records')
        .select('schedule_id')
        .in('schedule_id', completedScheduleIds)
      const withAttendance = new Set((attendanceRows ?? []).map(a => a.schedule_id))
      const missing = completedScheduleIds.filter(id => !withAttendance.has(id))
      if (missing.length) {
        warnings.push({
          code:           'missing_attendance',
          message:        `${missing.length} completed session(s) have no attendance recorded.`,
          recommendation: 'Record attendance for these sessions so the cohort\'s history is complete.',
        })
      }
    }
  }

  const { data: financeAccounts } = await db
    .from('student_financial_accounts')
    .select('id, remaining_amount')
    .eq('group_id', groupId)
    .gt('remaining_amount', 0)

  if (financeAccounts?.length) {
    warnings.push({
      code:           'outstanding_balance',
      message:        `${financeAccounts.length} student(s) have an outstanding balance for this cohort.`,
      recommendation: 'Collect or write off the remaining balance, or proceed and follow up separately — this does not block graduation.',
    })
  }

  const { data: activeStudents } = await db
    .from('group_students')
    .select('student_id')
    .eq('group_id', groupId)
    .eq('status', 'active')

  const courseIds = [...new Set((groupCourses ?? []).map(gc => gc.course_id).filter(Boolean))]
  if (activeStudents?.length && courseIds.length) {
    const studentIds = activeStudents.map(s => s.student_id)
    const { data: certs } = await db
      .from('certificates')
      .select('student_id')
      .in('student_id', studentIds)
      .in('course_id', courseIds)
    const withCert = new Set((certs ?? []).map(c => c.student_id))
    const missingCert = studentIds.filter(id => !withCert.has(id))
    if (missingCert.length) {
      warnings.push({
        code:           'missing_certificate',
        message:        `${missingCert.length} student(s) have no certificate on file for this cohort's course.`,
        recommendation: 'Issue certificates for these students (individually or via Issue Group Certificates) before or after graduating — this does not block graduation.',
      })
    }
  }

  return warnings
}
