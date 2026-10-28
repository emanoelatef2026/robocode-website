import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export interface SharedSessionItem {
  id: string; group_course_id: string; session_number: number | null; scheduled_at: string;
  status: string; topic: string | null; attendance_revision: number; ended_at: string | null;
  participants: { instructor_id: string; name: string; state: string; joined_at: string | null }[];
  myState: string | null; joined: boolean;
  leadInstructorId?: string | null; isLead?: boolean; myRole?: 'lead' | 'assistant' | null;
}
// Called only AFTER the page's group/session access check. Never a Server Action.
export async function loadSharedSessions(groupId: string, instructorId: string): Promise<SharedSessionItem[]> {
  return (await loadSharedSessionSnapshot(groupId, instructorId)).sessions
}

export async function loadSharedSessionSnapshot(groupId: string, instructorId: string): Promise<{ sessions: SharedSessionItem[]; workflowReady: boolean }> {
  const db = createServiceClient()
  const courses = await db.from('group_courses').select('id').eq('group_id', groupId)
  if (courses.error) throw new Error('Unable to load group courses. Please retry.')
  const fields = 'id,group_course_id,session_number,scheduled_at,status,topic,attendance_revision,ended_at'
  const courseIds = (courses.data ?? []).map(c => c.id)
  let workflowReady = true
  let sessions = await db.from('schedules').select(`${fields},lead_instructor_id`)
    .in('group_course_id', courseIds).order('scheduled_at', { ascending: false })
  // A code preview can run against the previous schema. Preserve read access,
  // but never fall back to legacy writes that bypass the new role safeguards.
  if (sessions.error?.code === '42703' && sessions.error.message.includes('lead_instructor_id')) {
    workflowReady = false
    const legacySessions = await db.from('schedules').select(fields)
      .in('group_course_id', courseIds).order('scheduled_at', { ascending: false })
    sessions = { ...legacySessions, data: legacySessions.data?.map(row => ({ ...row, lead_instructor_id: null })) ?? null } as typeof sessions
  }
  if (sessions.error) throw new Error('Unable to load shared sessions. Please retry.')
  if (!sessions.data?.length) return { sessions: [], workflowReady }
  const ids = sessions.data.map(s => s.id)
  const [participants, legacy] = await Promise.all([
    db.from('session_participations').select('session_id,instructor_id,state,joined_at').in('session_id', ids),
    db.from('session_instructors').select('session_id,instructor_id,submitted_at').in('session_id', ids),
  ])
  if (participants.error || legacy.error) throw new Error('Unable to load teaching participation. Please retry.')
  const instructorIds = [...new Set([...(participants.data ?? []), ...(legacy.data ?? [])].map(p => p.instructor_id))]
  const names = new Map<string, string>()
  if (instructorIds.length) {
    const instructors = await db.from('instructors').select('id,users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name,last_name))').in('id', instructorIds)
    if (instructors.error) throw new Error('Unable to load participating instructors.')
    for (const i of instructors.data ?? []) {
      const profile = (i.users as unknown as { profiles: { first_name: string; last_name: string } | null })?.profiles
      names.set(i.id, [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Instructor')
    }
  }
  const rows = sessions.data.map<SharedSessionItem>(s => {
    const people = (participants.data ?? []).filter(p => p.session_id === s.id).map(p => ({ ...p, name: names.get(p.instructor_id) ?? 'Instructor' }))
    for (const p of legacy.data ?? []) if (p.session_id === s.id && p.submitted_at && !people.some(x => x.instructor_id === p.instructor_id)) people.push({ ...p, joined_at: null, state: 'confirmed', name: names.get(p.instructor_id) ?? 'Instructor' })
    const mine = people.find(p => p.instructor_id === instructorId)
    return { ...s, participants: people, myState: mine?.state ?? null, joined: !!mine?.joined_at, leadInstructorId: s.lead_instructor_id, isLead: s.lead_instructor_id === instructorId, myRole: s.lead_instructor_id === instructorId ? 'lead' : mine ? 'assistant' : null }
  })
  return { sessions: rows, workflowReady }
}
