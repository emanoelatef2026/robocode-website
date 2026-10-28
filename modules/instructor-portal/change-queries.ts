import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { SessionChangeKind } from './session-changes'
export interface SessionChangeRequest {
  id: string; instructor_id: string; kind: SessionChangeKind; payload: Record<string, unknown>; status: string; created_at: string;
}
// Caller must first verify access to this session. Assistants see only their own drafts.
export async function getSessionChangeRequests(sessionId: string, instructorId: string, isLead: boolean): Promise<SessionChangeRequest[]> {
  let query = createServiceClient().from('session_change_requests').select('id,instructor_id,kind,payload,status,created_at').eq('session_id',sessionId).order('created_at',{ ascending: false }).limit(100)
  if (!isLead) query = query.eq('instructor_id',instructorId)
  const { data, error } = await query
  if (error) throw new Error('Unable to load class change requests. The teaching-workflow migration may be missing.')
  return (data ?? []) as SessionChangeRequest[]
}
