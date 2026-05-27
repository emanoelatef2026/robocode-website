import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { CertificateEligibilityResult, CertificateThresholds } from './types'

const DEFAULT_THRESHOLDS: CertificateThresholds = {
  min_attendance: 75,
  min_assignment: 60,
  min_overall:    70,
}

export async function checkCertificateEligibility(
  studentId:  string,
  semesterId: string,
  thresholds: Partial<CertificateThresholds> = {}
): Promise<CertificateEligibilityResult> {
  const db = createServiceClient()
  const t: CertificateThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds }

  const { data: rows } = await db
    .from('student_course_progress')
    .select('attendance_score, assignment_score, portfolio_score, completion_percentage, course_id, courses!student_course_progress_course_id_fkey(title)')
    .eq('student_id', studentId)
    .eq('semester_id', semesterId)

  if (!rows?.length) {
    return {
      student_id:         studentId,
      semester_id:        semesterId,
      is_eligible:        false,
      overall_percentage: 0,
      attendance_score:   0,
      assignment_score:   0,
      portfolio_score:    0,
      courses_evaluated:  0,
      failed_thresholds:  ['no_progress_data'],
      thresholds:         t,
    }
  }

  const avgAttendance = rows.reduce((s, r: any) => s + Number(r.attendance_score), 0) / rows.length
  const avgAssignment = rows.reduce((s, r: any) => s + Number(r.assignment_score), 0) / rows.length
  const avgPortfolio  = rows.reduce((s, r: any) => s + Number(r.portfolio_score),  0) / rows.length
  const avgOverall    = rows.reduce((s, r: any) => s + Number(r.completion_percentage), 0) / rows.length

  const failedThresholds: string[] = []
  if (avgAttendance < t.min_attendance) failedThresholds.push('attendance')
  if (avgAssignment < t.min_assignment) failedThresholds.push('assignments')
  if (avgOverall    < t.min_overall)    failedThresholds.push('overall')

  // Any individual course that fails overall threshold counts as a failed course
  const failedCourses = rows
    .filter((r: any) => Number(r.completion_percentage) < t.min_overall)
    .map((r: any) => (r as any).courses?.title ?? r.course_id)

  return {
    student_id:         studentId,
    semester_id:        semesterId,
    is_eligible:        failedThresholds.length === 0,
    overall_percentage: Math.round(avgOverall    * 100) / 100,
    attendance_score:   Math.round(avgAttendance * 100) / 100,
    assignment_score:   Math.round(avgAssignment * 100) / 100,
    portfolio_score:    Math.round(avgPortfolio  * 100) / 100,
    courses_evaluated:  rows.length,
    failed_thresholds:  failedThresholds,
    thresholds:         t,
  }
}
