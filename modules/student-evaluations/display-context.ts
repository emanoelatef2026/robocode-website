import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { StudentEvaluation } from './types'

export async function evaluationContextLabels(evaluations: StudentEvaluation[]): Promise<Record<string, string>> {
  const db = createServiceClient()
  const ids = (kind: 'schedule_id' | 'source_id' | 'group_id', type?: string) => [...new Set(evaluations.filter(e => !type || e.source_type === type).map(e => e[kind]).filter((x): x is string => !!x))]
  const scheduleIds = ids('schedule_id'), groupIds = ids('group_id')
  const assignmentIds = ids('source_id', 'assignment'), videoIds = ids('source_id', 'video'), projectIds = ids('source_id', 'project')
  const [scheduleRes, groupRes, assignmentRes, videoRes, projectRes] = await Promise.all([
    scheduleIds.length ? db.from('schedules').select('id, topic, session_number').in('id', scheduleIds) : Promise.resolve({ data: [] }),
    groupIds.length ? db.from('groups').select('id, name').in('id', groupIds) : Promise.resolve({ data: [] }),
    assignmentIds.length ? db.from('submissions').select('id, assignments!submissions_assignment_id_fkey(title)').in('id', assignmentIds) : Promise.resolve({ data: [] }),
    videoIds.length ? db.from('student_videos').select('id, title').in('id', videoIds) : Promise.resolve({ data: [] }),
    projectIds.length ? db.from('portfolio_projects').select('id, title').in('id', projectIds) : Promise.resolve({ data: [] }),
  ])
  const map: Record<string, string> = {}
  for (const s of scheduleRes.data ?? []) map[s.id] = `Session ${s.session_number ?? ''}${s.topic ? ` · ${s.topic}` : ''}`.trim()
  for (const g of groupRes.data ?? []) map[g.id] = g.name
  for (const a of assignmentRes.data ?? []) map[a.id] = `Assignment · ${(Array.isArray(a.assignments) ? a.assignments[0] : a.assignments)?.title ?? 'Work'}`
  for (const v of videoRes.data ?? []) map[v.id] = `Video · ${v.title}`
  for (const p of projectRes.data ?? []) map[p.id] = `Project · ${p.title}`
  return map
}
