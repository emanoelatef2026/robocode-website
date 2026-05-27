'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  PromoteSubmissionSchema,
  ReorderProjectsSchema,
  CreateAchievementSchema,
  UpdateAchievementSchema,
  CreateBadgeSchema,
  UpdatePortfolioSchema,
} from './schemas'
import { getOrCreatePortfolio } from './queries'
import { resolveProgressFromPortfolioProject } from '@/modules/progress/resolve'
import { safeRecalcProgress } from '@/modules/progress/safe-recalc'
import type { ActionResult } from '@/types/app'

// ─── Portfolio ─────────────────────────────────────────────────────────────────

export async function updatePortfolio(
  portfolioId: string,
  input: unknown
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_portfolio')
  const parsed = UpdatePortfolioSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const db = createServiceClient()
  const { error } = await db
    .from('student_portfolios')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', portfolioId)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath('/admin/portfolio')
  return { success: true, data: undefined }
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function createProject(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_portfolio')
  const db   = createServiceClient()

  const raw = {
    portfolio_id:        formData.get('portfolio_id'),
    student_id:          formData.get('student_id'),
    title:               formData.get('title'),
    description:         formData.get('description') || undefined,
    thumbnail_url:       formData.get('thumbnail_url') || undefined,
    github_url:          formData.get('github_url') || undefined,
    drive_url:           formData.get('drive_url') || undefined,
    video_url:           formData.get('video_url') || undefined,
    project_url:         formData.get('project_url') || undefined,
    instructor_feedback: formData.get('instructor_feedback') || undefined,
    final_score:         formData.get('final_score') ? Number(formData.get('final_score')) : undefined,
    semester_id:         formData.get('semester_id') || undefined,
    course_id:           formData.get('course_id') || undefined,
    is_featured:         formData.get('is_featured') === 'true',
    is_public:           formData.get('is_public') === 'true',
    sort_order:          formData.get('sort_order') ? Number(formData.get('sort_order')) : 0,
  }

  const parsed = CreateProjectSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data
  const { data, error } = await db
    .from('portfolio_projects')
    .insert({
      portfolio_id:        d.portfolio_id,
      student_id:          d.student_id,
      title:               d.title,
      description:         d.description ?? null,
      thumbnail_url:       d.thumbnail_url || null,
      github_url:          d.github_url || null,
      drive_url:           d.drive_url || null,
      video_url:           d.video_url || null,
      project_url:         d.project_url || null,
      instructor_feedback: d.instructor_feedback ?? null,
      final_score:         d.final_score ?? null,
      semester_id:         d.semester_id ?? null,
      course_id:           d.course_id ?? null,
      is_featured:         d.is_featured ?? false,
      is_public:           d.is_public ?? false,
      sort_order:          d.sort_order ?? 0,
      created_by:          user.id,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to create project' } }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'create',
    p_entity_type:  'portfolio_project',
    p_entity_id:    data.id,
    p_new_values:   d,
  })

  const tuple = await resolveProgressFromPortfolioProject(data.id)
  await safeRecalcProgress(tuple, 'createProject')

  revalidatePath(`/admin/portfolio/${d.student_id}`)
  return { success: true, data: { id: data.id } }
}

export async function promoteSubmission(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_portfolio')
  const db   = createServiceClient()

  const raw = {
    student_id:    formData.get('student_id'),
    submission_id: formData.get('submission_id'),
    title:         formData.get('title'),
    description:   formData.get('description') || undefined,
    is_featured:   formData.get('is_featured') === 'true',
    is_public:     formData.get('is_public') === 'true',
  }

  const parsed = PromoteSubmissionSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  // Fetch the submission for context
  const { data: sub } = await db
    .from('submissions')
    .select('score, public_feedback, drive_url, github_url, project_url, video_url, assignment_id')
    .eq('id', d.submission_id)
    .single()

  // Get (or create) portfolio
  const portfolio = await getOrCreatePortfolio(d.student_id)

  // Resolve assignment's course via module
  let course_id: string | null = null
  if (sub?.assignment_id) {
    const { data: asgn } = await db
      .from('assignments')
      .select('course_modules!assignments_module_id_fkey(course_id)')
      .eq('id', sub.assignment_id)
      .single()
    const mod = (asgn as any)?.course_modules
    course_id = mod?.course_id ?? null
  }

  const { data, error } = await db
    .from('portfolio_projects')
    .insert({
      portfolio_id:        portfolio.id,
      student_id:          d.student_id,
      submission_id:       d.submission_id,
      title:               d.title,
      description:         d.description ?? null,
      course_id,
      final_score:         sub?.score ?? null,
      instructor_feedback: sub?.public_feedback ?? null,
      drive_url:           sub?.drive_url ?? null,
      github_url:          sub?.github_url ?? null,
      project_url:         sub?.project_url ?? null,
      video_url:           sub?.video_url ?? null,
      is_featured:         d.is_featured ?? false,
      is_public:           d.is_public ?? false,
      created_by:          user.id,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to promote submission' } }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'promote_submission',
    p_entity_type:  'portfolio_project',
    p_entity_id:    data.id,
    p_new_values:   { submission_id: d.submission_id, student_id: d.student_id },
  })

  const tuple = await resolveProgressFromPortfolioProject(data.id)
  await safeRecalcProgress(tuple, 'promoteSubmission')

  revalidatePath(`/admin/portfolio/${d.student_id}`)
  return { success: true, data: { id: data.id } }
}

export async function updateProject(
  projectId: string,
  input: unknown
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_portfolio')

  const parsed = UpdateProjectSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const db = createServiceClient()

  const { data: existing } = await db
    .from('portfolio_projects')
    .select('student_id')
    .eq('id', projectId)
    .single()

  const { error } = await db
    .from('portfolio_projects')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', projectId)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'portfolio_project',
    p_entity_id:    projectId,
    p_new_values:   parsed.data,
  })

  if (parsed.data.final_score !== undefined) {
    const tuple = await resolveProgressFromPortfolioProject(projectId)
    await safeRecalcProgress(tuple, 'updateProject')
  }

  if (existing?.student_id) revalidatePath(`/admin/portfolio/${existing.student_id}`)
  return { success: true, data: undefined }
}

export async function archiveProject(projectId: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_portfolio')
  const db   = createServiceClient()

  const { data: existing } = await db
    .from('portfolio_projects')
    .select('student_id')
    .eq('id', projectId)
    .single()

  const { error } = await db
    .from('portfolio_projects')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', projectId)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  const tuple = await resolveProgressFromPortfolioProject(projectId)
  await safeRecalcProgress(tuple, 'archiveProject')

  if (existing?.student_id) revalidatePath(`/admin/portfolio/${existing.student_id}`)
  return { success: true, data: undefined }
}

export async function reorderProjects(
  studentId: string,
  items: { id: string; sort_order: number }[]
): Promise<ActionResult<void>> {
  await requirePermission('manage_portfolio')

  const parsed = ReorderProjectsSchema.safeParse({ items })
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const db = createServiceClient()

  await Promise.all(
    parsed.data.items.map(({ id, sort_order }) =>
      db.from('portfolio_projects').update({ sort_order }).eq('id', id)
    )
  )

  revalidatePath(`/admin/portfolio/${studentId}`)
  return { success: true, data: undefined }
}

// ─── Achievements ──────────────────────────────────────────────────────────────

export async function createAchievement(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_portfolio')

  const raw = {
    student_id:       formData.get('student_id'),
    portfolio_id:     formData.get('portfolio_id') || undefined,
    title:            formData.get('title'),
    description:      formData.get('description') || undefined,
    achievement_type: formData.get('achievement_type'),
    date_awarded:     formData.get('date_awarded'),
    image_url:        formData.get('image_url') || undefined,
    sort_order:       formData.get('sort_order') ? Number(formData.get('sort_order')) : 0,
  }

  const parsed = CreateAchievementSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('student_achievements')
    .insert({ ...parsed.data, created_by: user.id })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to create achievement' } }

  revalidatePath(`/admin/portfolio/${parsed.data.student_id}`)
  return { success: true, data: { id: data.id } }
}

export async function updateAchievement(
  achievementId: string,
  studentId: string,
  input: unknown
): Promise<ActionResult<void>> {
  await requirePermission('manage_portfolio')

  const parsed = UpdateAchievementSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const db = createServiceClient()
  const { error } = await db
    .from('student_achievements')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', achievementId)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath(`/admin/portfolio/${studentId}`)
  return { success: true, data: undefined }
}

export async function deleteAchievement(
  achievementId: string,
  studentId: string
): Promise<ActionResult<void>> {
  await requirePermission('manage_portfolio')
  const db = createServiceClient()

  const { error } = await db
    .from('student_achievements')
    .delete()
    .eq('id', achievementId)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath(`/admin/portfolio/${studentId}`)
  return { success: true, data: undefined }
}

// ─── Badges ───────────────────────────────────────────────────────────────────

export async function createBadge(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission('manage_portfolio')

  const raw = {
    student_id:   formData.get('student_id'),
    portfolio_id: formData.get('portfolio_id') || undefined,
    badge_name:   formData.get('badge_name'),
    badge_image:  formData.get('badge_image') || undefined,
    description:  formData.get('description') || undefined,
    awarded_at:   formData.get('awarded_at') || undefined,
  }

  const parsed = CreateBadgeSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('student_badges')
    .insert({ ...parsed.data, created_by: user.id })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to create badge' } }

  revalidatePath(`/admin/portfolio/${parsed.data.student_id}`)
  return { success: true, data: { id: data.id } }
}

export async function deleteBadge(
  badgeId: string,
  studentId: string
): Promise<ActionResult<void>> {
  await requirePermission('manage_portfolio')
  const db = createServiceClient()

  const { error } = await db
    .from('student_badges')
    .delete()
    .eq('id', badgeId)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath(`/admin/portfolio/${studentId}`)
  return { success: true, data: undefined }
}
