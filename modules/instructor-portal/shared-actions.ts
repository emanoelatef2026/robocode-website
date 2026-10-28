'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstructorByUserId } from './queries'
import type { ActionResult } from '@/types/app'

type SharedResult = { sessionId: string; groupId: string; state?: string }
function invalidate(data: SharedResult) {
  revalidatePath(`/portal/instructor/groups/${data.groupId}`)
  revalidatePath(`/portal/instructor/groups/${data.groupId}/sessions/${data.sessionId}`)
  revalidatePath('/admin/instructors')
  revalidatePath('/portal/team-leader/instructors')
  revalidatePath('/admin/staff-finance')
  revalidatePath('/portal/instructor/history')
  revalidatePath('/portal/instructor/payments')
  revalidatePath('/portal/instructor/homework')
}
function failure(error: { code?: string; message: string } | null): ActionResult<SharedResult> {
  return { success: false, error: {
    code: error?.code === '42501' ? 'FORBIDDEN' : 'VALIDATION',
    message: error && ['42501', '22023'].includes(error.code ?? '') ? error.message : 'Unable to save participation. Please retry.',
  } }
}
export async function changeParticipation(sessionId: string, mode: 'join' | 'confirm' | 'request', reason?: string): Promise<ActionResult<SharedResult>> {
  const user = await requirePermission('manage_attendance')
  if (!z.string().uuid().safeParse(sessionId).success || !['join', 'confirm', 'request'].includes(mode)) return failure(null)
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) return failure(null)
  const { data, error } = await createServiceClient().rpc('record_session_participation', {
    p_actor: user.id, p_instructor: instructor.id, p_session: sessionId, p_mode: mode, p_reason: reason ?? null,
  })
  if (error || !data?.sessionId) return failure(error)
  invalidate(data)
  return { success: true, data }
}
export async function openSharedSession(courseId: string, expectedSession: string | null, expectedPrevious: string | null, topic: string, role: 'lead' | 'assistant' = 'lead'): Promise<ActionResult<SharedResult>> {
  const user = await requirePermission('manage_attendance')
  const uuid = z.string().uuid()
  if (!uuid.safeParse(courseId).success || !uuid.nullable().safeParse(expectedSession).success || !uuid.nullable().safeParse(expectedPrevious).success || !['lead','assistant'].includes(role) || !topic.trim() || topic.trim().toLowerCase() === 'no topic') return failure(null)
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) return failure(null)
  const { data, error } = await createServiceClient().rpc('open_role_instructor_session', {
    p_actor: user.id, p_instructor: instructor.id, p_course: courseId,
    p_expected_session: expectedSession, p_expected_previous: expectedPrevious, p_topic: topic.trim(), p_role: role,
  })
  if (error || !data?.sessionId) return failure(error)
  invalidate(data)
  return { success: true, data }
}
export async function reviewSessionChange(requestId: string, approve: boolean): Promise<ActionResult<SharedResult>> {
  const user = await requirePermission('manage_attendance')
  if (!z.string().uuid().safeParse(requestId).success || typeof approve !== 'boolean') return failure(null)
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) return failure(null)
  const { data, error } = await createServiceClient().rpc('review_session_change', { p_actor: user.id, p_instructor: instructor.id, p_request: requestId, p_approve: approve })
  if (error || !data?.sessionId) return failure(error)
  invalidate(data)
  return { success: true, data }
}
export async function reviewParticipation(sessionId: string, instructorId: string, approve: boolean): Promise<ActionResult<SharedResult>> {
  const user = await requirePermission('manage_instructors')
  if (!['super_admin', 'team_leader'].includes(user.globalRole) || !z.string().uuid().safeParse(sessionId).success || !z.string().uuid().safeParse(instructorId).success || typeof approve !== 'boolean') return failure(null)
  const { data, error } = await createServiceClient().rpc('review_session_participation', {
    p_actor: user.id, p_session: sessionId, p_instructor: instructorId, p_approve: approve,
  })
  if (error || !data?.sessionId) return failure(error)
  invalidate(data)
  return { success: true, data }
}
