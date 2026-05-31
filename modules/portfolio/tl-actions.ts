'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import type { ActionResult } from '@/types/app'

const BADGE_TYPES = [
  'Featured Project',
  'Best Project Video',
  'Best Game Project',
  'Best AI Project',
  'Best Robotics Project',
  'Best Website Project',
] as const

const tlReviewSchema = z.object({
  project_id:          z.string().uuid(),
  status:              z.enum(['approved', 'needs_improvement', 'featured']),
  instructor_feedback: z.string().max(2000).optional().or(z.literal('')),
  final_score:         z.coerce.number().min(0).max(100).optional().nullable().or(z.literal('')),
})

const tlBadgeSchema = z.object({
  project_id:  z.string().uuid(),
  student_id:  z.string().uuid(),
  badge_name:  z.enum(BADGE_TYPES),
  description: z.string().max(500).optional().or(z.literal('')),
})

// ── Team Leader: review (approve / feature / request changes) ─────────────────
// Requires manage_portfolio permission which team_leader has by default.

export async function tlReviewProject(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  await requirePermission('manage_portfolio')
  const db = createServiceClient()

  const raw = {
    project_id:          formData.get('project_id'),
    status:              formData.get('status'),
    instructor_feedback: formData.get('instructor_feedback') || undefined,
    final_score:         formData.get('final_score') || undefined,
  }

  const parsed = tlReviewSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  const { data: projRow } = await db
    .from('portfolio_projects')
    .select('id')
    .eq('id', d.project_id)
    .maybeSingle()
  if (!projRow) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Project not found.' } }
  }

  const updates: Record<string, unknown> = {
    status:      d.status,
    is_featured: d.status === 'featured',
    updated_at:  new Date().toISOString(),
  }
  if (d.instructor_feedback !== undefined) {
    updates.instructor_feedback = d.instructor_feedback || null
  }
  if (d.final_score !== undefined && d.final_score !== '' && d.final_score !== null) {
    updates.final_score = Number(d.final_score)
  }

  const { error } = await db
    .from('portfolio_projects')
    .update(updates)
    .eq('id', d.project_id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  revalidatePath('/portal/team-leader/portfolio')
  return { success: true, data: undefined }
}

// ── Team Leader: assign badge ─────────────────────────────────────────────────

export async function tlAssignBadge(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  await requirePermission('manage_portfolio')
  const db = createServiceClient()

  const raw = {
    project_id:  formData.get('project_id'),
    student_id:  formData.get('student_id'),
    badge_name:  formData.get('badge_name'),
    description: formData.get('description') || undefined,
  }

  const parsed = tlBadgeSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data

  const { data: existing } = await db
    .from('student_badges')
    .select('id')
    .eq('student_id', d.student_id)
    .eq('badge_name', d.badge_name)
    .maybeSingle()

  if (existing) {
    return { success: false, error: { code: 'DUPLICATE', message: 'This badge has already been awarded.' } }
  }

  const { error } = await db
    .from('student_badges')
    .insert({
      student_id:  d.student_id,
      badge_name:  d.badge_name,
      description: d.description || null,
    })

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  revalidatePath('/portal/team-leader/portfolio')
  return { success: true, data: undefined }
}
