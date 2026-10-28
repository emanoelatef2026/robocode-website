import 'server-only'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import type { ActionResult } from '@/types/app'

export type SessionChangeKind = 'attendance' | 'session_details' | 'resources' | 'recording_add' | 'recording_remove' | 'homework_create' | 'homework_update' | 'evaluation' | 'student_note'
export async function queueSessionChange(actor: string, instructor: string, session: string, group: string, kind: SessionChangeKind, payload: unknown): Promise<ActionResult<{ changeId: string }> | null> {
  const { data, error } = await createServiceClient().rpc('stage_session_change', { p_actor: actor, p_instructor: instructor, p_session: session, p_group: group, p_kind: kind, p_payload: payload })
  if (error || !data) return { success: false, error: { code: error?.code === '42501' ? 'FORBIDDEN' : 'VALIDATION', message: error && ['42501', '22023'].includes(error.code) ? error.message : 'The teaching-workflow database update is required or unavailable. Your changes were not published.' } }
  if (data.direct === true) return null
  revalidatePath(`/portal/instructor/groups/${group}/sessions/${session}`)
  return { success: true, data: { changeId: data.changeId } }
}

export async function assertSessionLead(actor: string, instructor: string, session: string, group: string): Promise<ActionResult<void>> {
  const { data, error } = await createServiceClient().rpc('assert_session_lead', { p_actor: actor, p_instructor: instructor, p_session: session, p_group: group })
  if (error || data !== true) return { success: false, error: { code: 'FORBIDDEN', message: error && ['42501','22023'].includes(error.code) ? error.message : 'Only the lead instructor may perform this action.' } }
  return { success: true, data: undefined }
}
