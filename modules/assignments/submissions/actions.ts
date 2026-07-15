'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, requirePortalRole, isBranchAccessible } from '@/modules/rbac/guards'
import { resolveProgressFromSubmission, resolveProgressFromAssignment } from '@/modules/progress/resolve'
import { safeRecalcProgress } from '@/modules/progress/safe-recalc'
import { awardXP, XP_AWARDS } from '@/modules/gamification/xp-service'
import { checkAndUnlockAchievements } from '@/modules/gamification/achievement-service'
import { checkAndAwardBadges } from '@/modules/gamification/badge-service'
import type { ActionResult } from '@/types/app'

const gradeSchema = z.object({
  submission_id:   z.string().uuid(),
  assignment_id:   z.string().uuid(),
  score:           z.coerce.number().min(0).max(10000).optional(),
  feedback:        z.string().optional().or(z.literal('')),
  public_feedback: z.string().optional().or(z.literal('')),
  status:          z.enum(['submitted', 'under_review', 'graded', 'returned', 'resubmission_requested', 'resubmitted']),
  rubric_scores:   z.string().optional().or(z.literal('')),
  portfolio_visible: z.string().optional().transform((v) => v === 'on' || v === 'true'),
})

export async function gradeSubmission(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePermission('grade_assignments')
  const db   = createServiceClient()

  const raw = {
    submission_id:    formData.get('submission_id'),
    assignment_id:    formData.get('assignment_id'),
    score:            formData.get('score') || undefined,
    feedback:         formData.get('feedback') || undefined,
    public_feedback:  formData.get('public_feedback') || undefined,
    status:           formData.get('status'),
    rubric_scores:    formData.get('rubric_scores') || undefined,
    portfolio_visible: formData.get('portfolio_visible'),
  }

  const parsed = gradeSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  // ── Group/branch-level scope enforcement ──────────────────────────────────────
  // super_admin can grade any submission. Instructors may only grade submissions
  // belonging to students in their own groups; team_leaders are branch-scoped.
  if (user.globalRole === 'instructor') {
    const { data: sub } = await db
      .from('submissions')
      .select('student_id')
      .eq('id', d.submission_id)
      .single()

    if (!sub) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Submission not found.' } }
    }

    const { data: instRow } = await db
      .from('instructors')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!instRow) {
      return { success: false, error: { code: 'FORBIDDEN', message: 'Instructor record not found.' } }
    }

    const { data: gi } = await db
      .from('group_instructors')
      .select('group_id')
      .eq('instructor_id', (instRow as any).id)

    const instructorGroupIds = (gi ?? []).map((r: any) => r.group_id as string)

    if (instructorGroupIds.length > 0) {
      const { data: gs } = await db
        .from('group_students')
        .select('student_id')
        .in('group_id', instructorGroupIds)
        .eq('student_id', (sub as any).student_id)
        .eq('status', 'active')
        .limit(1)

      if (!gs?.length) {
        return { success: false, error: { code: 'FORBIDDEN', message: 'Not authorized to grade this submission.' } }
      }
    } else {
      return { success: false, error: { code: 'FORBIDDEN', message: 'You have no assigned groups.' } }
    }
  } else if (user.globalRole === 'team_leader') {
    // TLs are branch-scoped everywhere else in the codebase (isBranchAccessible) —
    // grading must not be the one place a TL can reach across branches.
    const { data: sub } = await db
      .from('submissions')
      .select('student_id')
      .eq('id', d.submission_id)
      .single()

    if (!sub) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Submission not found.' } }
    }

    const { data: gs } = await db
      .from('group_students')
      .select('groups!group_students_group_id_fkey(branch_id)')
      .eq('student_id', (sub as any).student_id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    const branchId = (gs as any)?.groups?.branch_id ?? null

    if (!isBranchAccessible(user, branchId)) {
      return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  let rubric_scores: Record<string, number> = {}
  if (d.rubric_scores) {
    try { rubric_scores = JSON.parse(d.rubric_scores) } catch { /* keep empty */ }
  }

  // Fetch previous status to guard against awarding XP on re-grading
  const { data: prevSub } = await db
    .from('submissions')
    .select('status, student_id')
    .eq('id', d.submission_id)
    .maybeSingle()
  const wasAlreadyGraded = (prevSub as any)?.status === 'graded'

  const { error } = await db
    .from('submissions')
    .update({
      score:             d.score ?? null,
      feedback:          d.feedback || null,
      public_feedback:   d.public_feedback || null,
      status:            d.status,
      rubric_scores,
      graded_by:         user.id,
      graded_at:         new Date().toISOString(),
      portfolio_visible: d.portfolio_visible,
    })
    .eq('id', d.submission_id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'grade',
    p_entity_type:  'submission',
    p_entity_id:    d.submission_id,
    p_new_values:   { score: d.score, status: d.status },
  })

  // Grading updates student_grade_summaries via DB trigger (0019).
  // Here we push that change forward into student_course_progress.
  const tuple = await resolveProgressFromSubmission(d.submission_id)
  await safeRecalcProgress(tuple, 'gradeSubmission')

  // ── XP for graded status (fire-and-forget) ────────────────────────────────
  // Only award on first grading (wasAlreadyGraded prevents re-grading from doubling XP).
  if (d.status === 'graded' && !wasAlreadyGraded) {
    void (async () => {
      try {
        const db2 = createServiceClient()
        const { data: subRow } = await db2
          .from('submissions')
          .select('student_id, score, assignments!submissions_assignment_id_fkey(max_score)')
          .eq('id', d.submission_id)
          .maybeSingle()
        if (!subRow) return
        const sid      = (subRow as any).student_id as string
        const score    = Number((subRow as any).score ?? 0)
        const maxScore = Number((subRow as any).assignments?.max_score ?? 0)
        const isExcellent = maxScore > 0 && score / maxScore >= 0.9
        await awardXP(sid, isExcellent ? XP_AWARDS.ASSIGNMENT_EXCELLENT : XP_AWARDS.ASSIGNMENT_SUBMITTED, true)
        await checkAndUnlockAchievements(sid)
        await checkAndAwardBadges(sid)
      } catch { /* XP is never critical */ }
    })()
  }

  revalidatePath(`/admin/assignments/${d.assignment_id}`)
  revalidatePath(`/admin/assignments/${d.assignment_id}/submissions/${d.submission_id}`)
  return { success: true, data: undefined }
}

// ── Student submit action ─────────────────────────────────────────────────────

const submitSchema = z.object({
  assignment_id: z.string().uuid(),
  content:       z.string().optional().or(z.literal('')),
  drive_url:     z.string().url().optional().or(z.literal('')),
  github_url:    z.string().url().optional().or(z.literal('')),
  project_url:   z.string().url().optional().or(z.literal('')),
  video_url:     z.string().url().optional().or(z.literal('')),
})

export async function submitAssignment(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ submission_id: string }>> {
  const user = await requirePortalRole('student')
  const db   = createServiceClient()

  const raw = {
    assignment_id: formData.get('assignment_id'),
    content:       formData.get('content')     || undefined,
    drive_url:     formData.get('drive_url')   || undefined,
    github_url:    formData.get('github_url')  || undefined,
    project_url:   formData.get('project_url') || undefined,
    video_url:     formData.get('video_url')   || undefined,
  }

  const parsed = submitSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  // Collect uploaded image URLs (already uploaded client-side to /api/uploads/submission-image)
  const imageUrls = (formData.getAll('image_urls[]') as string[]).filter((u) => {
    try { new URL(u); return true } catch { return false }
  }).slice(0, 5)

  // Resolve student_id
  const { data: studentRow } = await db
    .from('students')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!studentRow) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Student record not found.' } }
  }

  // Verify the assignment is published and reachable
  const { data: assignment } = await db
    .from('assignments')
    .select('id, due_at, allow_late, resubmission_allowed, max_resubmissions, submission_type')
    .eq('id', d.assignment_id)
    .eq('status', 'published')
    .is('deleted_at', null)
    .single()

  if (!assignment) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found or not available.' } }
  }

  // Validate at least one content field is provided
  const hasContent =
    (d.content?.trim()     ?? '').length > 0 ||
    (d.drive_url   ?? '').length > 0 ||
    (d.github_url  ?? '').length > 0 ||
    (d.project_url ?? '').length > 0 ||
    (d.video_url   ?? '').length > 0 ||
    imageUrls.length > 0

  if (!hasContent) {
    return { success: false, error: { code: 'VALIDATION', message: 'At least one content field is required.' } }
  }

  // Check for existing submission
  const { data: existing } = await db
    .from('submissions')
    .select('id, status, resubmission_count')
    .eq('assignment_id', d.assignment_id)
    .eq('student_id', studentRow.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    const canResubmit =
      (assignment as any).resubmission_allowed &&
      (existing.status === 'resubmission_requested' || existing.status === 'returned') &&
      existing.resubmission_count < ((assignment as any).max_resubmissions ?? 0)

    if (!canResubmit) {
      return {
        success: false,
        error: { code: 'DUPLICATE', message: 'You have already submitted this assignment.' },
      }
    }

    // Update existing submission as resubmission
    const { error: updateErr } = await db
      .from('submissions')
      .update({
        content:            d.content     || null,
        drive_url:          d.drive_url   || null,
        github_url:         d.github_url  || null,
        project_url:        d.project_url || null,
        video_url:          d.video_url   || null,
        image_urls:         imageUrls,
        status:             'resubmitted',
        submitted_at:       new Date().toISOString(),
        resubmission_count: (existing.resubmission_count ?? 0) + 1,
        score:              null,
        graded_by:          null,
        graded_at:          null,
        feedback:           null,
      })
      .eq('id', existing.id)

    if (updateErr) {
      return { success: false, error: { code: 'DB_ERROR', message: updateErr.message } }
    }

    // Resubmission recorded — recalculate (grade summary trigger already fired)
    const reTuple = await resolveProgressFromAssignment(studentRow.id, d.assignment_id)
    await safeRecalcProgress(reTuple, 'submitAssignment:resubmit')

    revalidatePath('/portal/student/assignments')
    revalidatePath(`/portal/student/assignments/${d.assignment_id}`)
    return { success: true, data: { submission_id: existing.id } }
  }

  // Determine if late
  const isLate =
    (assignment as any).due_at != null &&
    new Date() > new Date((assignment as any).due_at)

  if (isLate && !(assignment as any).allow_late) {
    return { success: false, error: { code: 'DEADLINE_PASSED', message: 'The submission deadline has passed.' } }
  }

  const { data: newSub, error: insertErr } = await db
    .from('submissions')
    .insert({
      assignment_id:      d.assignment_id,
      student_id:         studentRow.id,
      content:            d.content     || null,
      drive_url:          d.drive_url   || null,
      github_url:         d.github_url  || null,
      project_url:        d.project_url || null,
      video_url:          d.video_url   || null,
      image_urls:         imageUrls,
      submission_type:    (assignment as any).submission_type,
      status:             'submitted',
      submitted_at:       new Date().toISOString(),
      is_late:            isLate,
      resubmission_count: 0,
      file_keys:          [],
      rubric_scores:      {},
      portfolio_visible:  false,
    })
    .select('id')
    .single()

  if (insertErr || !newSub) {
    return { success: false, error: { code: 'DB_ERROR', message: insertErr?.message ?? 'Insert failed.' } }
  }

  // New submission — grade summary trigger fires on the DB side; pull it into
  // student_course_progress so the portal reflects the change immediately.
  const newTuple = await resolveProgressFromAssignment(studentRow.id, d.assignment_id)
  await safeRecalcProgress(newTuple, 'submitAssignment')

  revalidatePath('/portal/student/assignments')
  revalidatePath(`/portal/student/assignments/${d.assignment_id}`)
  return { success: true, data: { submission_id: newSub.id } }
}
