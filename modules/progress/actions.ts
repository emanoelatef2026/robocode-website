'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth }         from '@/modules/rbac/guards'
import type { ActionResult } from '@/types/app'

// Upserts one row in student_course_progress.
// Call after any attendance, grade, or portfolio event for a student.
export async function calculateStudentProgress(
  studentId:  string,
  courseId:   string,
  semesterId: string,
  groupId:    string
): Promise<ActionResult<void>> {
  await requireAuth()
  const db = createServiceClient()

  // ── 1. Resolve group_course_id ──────────────────────────────────────────────
  const { data: gcRow } = await db
    .from('group_courses')
    .select('id')
    .eq('group_id', groupId)
    .eq('course_id', courseId)
    .maybeSingle()

  const groupCourseId: string | null = gcRow?.id ?? null

  // ── 2. Attendance score ─────────────────────────────────────────────────────
  let attendanceScore = 0

  if (groupCourseId) {
    const { data: scheduleRows } = await db
      .from('schedules')
      .select('id')
      .eq('group_course_id', groupCourseId)
      .eq('status', 'completed')

    const scheduleIds = (scheduleRows ?? []).map((s: any) => s.id)

    if (scheduleIds.length > 0) {
      const { count: attended } = await db
        .from('attendance_records')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .in('status', ['present', 'late', 'makeup'])
        .in('schedule_id', scheduleIds)

      attendanceScore = Math.min(
        Math.round(((attended ?? 0) / scheduleIds.length) * 10000) / 100,
        100
      )
    }
  }

  // ── 3. Assignment score (from auto-maintained grade summaries) ──────────────
  let assignmentScore = 0

  if (groupCourseId) {
    const { data: gradeSummary } = await db
      .from('student_grade_summaries')
      .select('grade_percentage')
      .eq('student_id', studentId)
      .eq('group_course_id', groupCourseId)
      .maybeSingle()

    if (gradeSummary?.grade_percentage != null) {
      assignmentScore = Math.min(Math.round(Number(gradeSummary.grade_percentage) * 100) / 100, 100)
    }
  }

  // ── 4. Portfolio score ──────────────────────────────────────────────────────
  let portfolioScore = 0

  const { data: portfolioProjects } = await db
    .from('portfolio_projects')
    .select('final_score')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .eq('semester_id', semesterId)
    .eq('is_archived', false)

  if (portfolioProjects?.length) {
    const scored = portfolioProjects.filter((p: any) => p.final_score != null)
    if (scored.length > 0) {
      const avg = scored.reduce((s: number, p: any) => s + Number(p.final_score), 0) / scored.length
      portfolioScore = Math.min(Math.round(avg * 100) / 100, 100)
    } else {
      portfolioScore = 50
    }
  } else {
    // Fallback: portfolio_visible submissions for this course
    const { data: moduleRows } = await db
      .from('course_modules')
      .select('id')
      .eq('course_id', courseId)
      .is('deleted_at', null)

    const moduleIds = (moduleRows ?? []).map((m: any) => m.id)

    if (moduleIds.length > 0) {
      const { data: assignmentRows } = await db
        .from('assignments')
        .select('id')
        .in('module_id', moduleIds)
        .eq('status', 'published')
        .is('deleted_at', null)

      const assignmentIds = (assignmentRows ?? []).map((a: any) => a.id)

      if (assignmentIds.length > 0) {
        const { count: visibleSubs } = await db
          .from('submissions')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', studentId)
          .eq('portfolio_visible', true)
          .in('assignment_id', assignmentIds)

        if (visibleSubs && visibleSubs > 0) portfolioScore = 30
      }
    }
  }

  // ── 5. Weighted completion percentage ───────────────────────────────────────
  const completionPercentage =
    Math.round((attendanceScore * 0.4 + assignmentScore * 0.4 + portfolioScore * 0.2) * 100) / 100

  // ── 6. Upsert ────────────────────────────────────────────────────────────────
  const { error } = await db
    .from('student_course_progress')
    .upsert(
      {
        student_id:            studentId,
        course_id:             courseId,
        semester_id:           semesterId,
        group_id:              groupId,
        attendance_score:      attendanceScore,
        assignment_score:      assignmentScore,
        portfolio_score:       portfolioScore,
        completion_percentage: completionPercentage,
        last_calculated_at:    new Date().toISOString(),
      },
      { onConflict: 'student_id,course_id,semester_id' }
    )

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  revalidatePath('/portal/student/assignments')
  revalidatePath('/portal/parent/progress')
  return { success: true, data: undefined }
}
