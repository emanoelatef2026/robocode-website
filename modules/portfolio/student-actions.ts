'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePortalRole } from '@/modules/rbac/guards'
import { awardXP, XP_AWARDS } from '@/modules/gamification/xp-service'
import { checkAndUnlockAchievements } from '@/modules/gamification/achievement-service'
import { checkAndAwardBadges } from '@/modules/gamification/badge-service'
import type { ActionResult } from '@/types/app'

const CATEGORIES = ['Game', 'AI', 'Website', 'Robotics', 'Mobile App', 'Other'] as const

const uploadProjectSchema = z.object({
  title:        z.string().min(1, 'Title is required').max(200),
  description:  z.string().min(1, 'Description is required').max(2000),
  category:     z.enum(CATEGORIES),
  project_link: z.string().url('Enter a valid project URL'),
  video_url:    z.string().url('Enter a valid YouTube URL').optional().or(z.literal('')),
  thumbnail_url:z.string().url().optional().or(z.literal('')),
})

const editProjectSchema = uploadProjectSchema.extend({
  project_id: z.string().uuid(),
})

// ── Upload new portfolio project ───────────────────────────────────────────────

export async function submitPortfolioProject(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ projectId: string }>> {
  const user = await requirePortalRole('student')
  const db   = createServiceClient()

  // Resolve student_id
  const { data: studentRow } = await db
    .from('students')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!studentRow) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Student record not found.' } }
  }
  const studentId = (studentRow as any).id as string

  const raw = {
    title:         formData.get('title'),
    description:   formData.get('description'),
    category:      formData.get('category'),
    project_link:  formData.get('project_link'),
    video_url:     formData.get('video_url') || undefined,
    thumbnail_url: formData.get('thumbnail_url') || undefined,
  }

  const parsed = uploadProjectSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  // Get or create portfolio
  let portfolioId: string
  const { data: existing } = await db
    .from('student_portfolios')
    .select('id')
    .eq('student_id', studentId)
    .maybeSingle()

  if (existing) {
    portfolioId = (existing as any).id
  } else {
    const { data: created, error: createErr } = await db
      .from('student_portfolios')
      .insert({ student_id: studentId })
      .select('id')
      .single()
    if (createErr || !created) {
      return { success: false, error: { code: 'DB_ERROR', message: createErr?.message ?? 'Failed to create portfolio.' } }
    }
    portfolioId = (created as any).id
  }

  const { data: project, error } = await db
    .from('portfolio_projects')
    .insert({
      portfolio_id:  portfolioId,
      student_id:    studentId,
      title:         d.title,
      description:   d.description,
      category:      d.category,
      project_url:   d.project_link,
      video_url:     d.video_url || null,
      thumbnail_url: d.thumbnail_url || null,
      status:        'pending_review',
      is_featured:   false,
      is_public:     true,
      is_archived:   false,
      sort_order:    0,
      created_by:    user.id,
    })
    .select('id')
    .single()

  if (error || !project) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to create project.' } }
  }

  // ── XP for portfolio project + optional video challenge bonus ─────────────
  void (async () => {
    try {
      const hasVideo = !!(d.video_url)
      const baseXp   = hasVideo ? XP_AWARDS.VIDEO_CHALLENGE : XP_AWARDS.PORTFOLIO_PROJECT
      await awardXP(studentId, baseXp, false)
      await checkAndUnlockAchievements(studentId)
      await checkAndAwardBadges(studentId)
    } catch { /* XP is never critical */ }
  })()

  revalidatePath('/portal/student/portfolio')
  return { success: true, data: { projectId: (project as any).id } }
}

// ── Edit own portfolio project ─────────────────────────────────────────────────

export async function editPortfolioProject(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePortalRole('student')
  const db   = createServiceClient()

  const { data: studentRow } = await db
    .from('students')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!studentRow) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Student record not found.' } }
  }
  const studentId = (studentRow as any).id as string

  const raw = {
    project_id:    formData.get('project_id'),
    title:         formData.get('title'),
    description:   formData.get('description'),
    category:      formData.get('category'),
    project_link:  formData.get('project_link'),
    video_url:     formData.get('video_url') || undefined,
    thumbnail_url: formData.get('thumbnail_url') || undefined,
  }

  const parsed = editProjectSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  // Verify ownership
  const { data: proj } = await db
    .from('portfolio_projects')
    .select('student_id, status')
    .eq('id', d.project_id)
    .maybeSingle()

  if (!proj || (proj as any).student_id !== studentId) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'You cannot edit this project.' } }
  }

  // Allow edit only if pending_review or needs_improvement
  const currentStatus = (proj as any).status as string
  if (currentStatus === 'approved' || currentStatus === 'featured') {
    return { success: false, error: { code: 'VALIDATION', message: 'Approved projects cannot be edited.' } }
  }

  const { error } = await db
    .from('portfolio_projects')
    .update({
      title:         d.title,
      description:   d.description,
      category:      d.category,
      project_url:   d.project_link,
      video_url:     d.video_url || null,
      thumbnail_url: d.thumbnail_url || null,
      status:        'pending_review',
      updated_at:    new Date().toISOString(),
    })
    .eq('id', d.project_id)
    .eq('student_id', studentId)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  revalidatePath('/portal/student/portfolio')
  return { success: true, data: undefined }
}
