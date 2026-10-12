import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId, resolveGcContext } from '@/modules/instructor-portal/queries'
import type { GroupEvaluationData, CenterItem } from './center'

function first<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

// The same ownership gate is used by reads and writes. Service-role queries
// must never use a client-provided group ID without this check.
export async function requireEvaluationGroup(groupId: string) {
  const user = await requirePortalRole('instructor')
  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) throw new Error('Instructor record not found.')
  const context = await resolveGcContext(instructor.id)
  if (!context.groupIds.includes(groupId)) throw new Error('You are not assigned to this group.')
  return { user, instructor, context }
}

export async function groupAssignmentIds(courseIds: string[], scheduleIds: string[]) {
  const db = createServiceClient()
  const ids = new Set<string>()
  if (courseIds.length) {
    const { data: modules } = await db.from('course_modules').select('id').in('course_id', courseIds).is('deleted_at', null)
    const moduleIds = (modules ?? []).map(m => m.id as string)
    if (moduleIds.length) {
      const { data: lessons } = await db.from('lessons').select('id').in('module_id', moduleIds).is('deleted_at', null)
      const parts = [`module_id.in.(${moduleIds.join(',')})`]
      if (lessons?.length) parts.push(`lesson_id.in.(${lessons.map(l => l.id).join(',')})`)
      const { data } = await db.from('assignments').select('id').or(parts.join(',')).is('deleted_at', null)
      for (const a of data ?? []) ids.add(a.id)
    }
  }
  if (scheduleIds.length) {
    const { data } = await db.from('assignments').select('id').in('schedule_id', scheduleIds).is('deleted_at', null)
    for (const a of data ?? []) ids.add(a.id)
  }
  return [...ids]
}

export async function getGroupEvaluationData(groupId: string): Promise<GroupEvaluationData> {
  const { context, user } = await requireEvaluationGroup(groupId)
  const db = createServiceClient()
  const { data: group, error: groupError } = await db.from('groups').select('id, name').eq('id', groupId).single()
  if (groupError || !group) throw new Error('Group not found.')
  const { data: gcRows, error: gcError } = await db.from('group_courses').select('id, course_id').eq('group_id', groupId)
  if (gcError) throw new Error(gcError.message)
  const gcIds = (gcRows ?? []).map(r => r.id as string)
  const courseIds = [...new Set((gcRows ?? []).map(r => r.course_id as string).filter(Boolean))]

  const [membersRes, sessionsRes] = await Promise.all([
    db.from('group_students').select('student_id, students!group_students_student_id_fkey(users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name)))').eq('group_id', groupId).eq('status', 'active'),
    gcIds.length ? db.from('schedules').select('id, scheduled_at, status, topic, session_number, group_course_id').in('group_course_id', gcIds).neq('status', 'cancelled').order('scheduled_at', { ascending: false }).limit(200) : Promise.resolve({ data: [], error: null }),
  ])
  if (membersRes.error || sessionsRes.error) throw new Error(membersRes.error?.message ?? sessionsRes.error?.message)
  const students = (membersRes.data ?? []).map(r => {
    const profile = first(first(first(r.students)?.users)?.profiles)
    return { id: r.student_id as string, name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Student' }
  })
  const studentIds = students.map(s => s.id)
  const sessions = (sessionsRes.data ?? []).filter(s => context.gcToGroupId.get(s.group_course_id) === groupId).map(s => ({
    id: s.id as string,
    title: `${s.session_number ? `Session ${s.session_number}` : 'Session'}${s.topic ? ` · ${s.topic}` : ''}`,
    scheduled_at: s.scheduled_at as string,
    status: s.status as string,
  }))
  if (!studentIds.length) return { group_id: groupId, group_name: group.name, students, sessions, assignments: [], videos: [], projects: [], evaluations: [] }

  const assignmentIds = await groupAssignmentIds(courseIds, sessions.map(s => s.id))
  const [evaluationRes, submissionRes, videoRes, projectRes] = await Promise.all([
    db.from('student_evaluations').select('id, student_id, criterion, score, rating, feedback, next_goal, visible_to_student, visible_to_parent, published_at, schedule_id, source_type, source_id, updated_at').eq('group_id', groupId).eq('author_id', user.id).in('student_id', studentIds).is('deleted_at', null).order('updated_at', { ascending: false }),
    assignmentIds.length ? db.from('submissions').select('id, student_id, assignment_id, status, score, submitted_at, assignments!submissions_assignment_id_fkey(title, max_score)').in('student_id', studentIds).in('assignment_id', assignmentIds).order('submitted_at', { ascending: false }).limit(300) : Promise.resolve({ data: [], error: null }),
    db.from('student_videos').select('id, student_id, title, description, youtube_url, created_at').in('student_id', studentIds).order('created_at', { ascending: false }).limit(300),
    db.from('portfolio_projects').select('id, student_id, title, description, project_url, final_score, created_at').in('student_id', studentIds).eq('is_archived', false).order('created_at', { ascending: false }).limit(300),
  ])
  const error = evaluationRes.error ?? submissionRes.error ?? videoRes.error ?? projectRes.error
  if (error) throw new Error(error.message)

  const assignments: CenterItem[] = (submissionRes.data ?? []).map(r => { const assignment = first(r.assignments); return { id: r.id, student_id: r.student_id, title: assignment?.title ?? 'Assignment', subtitle: `Submitted · ${new Date(r.submitted_at).toLocaleDateString('en-GB')}`, url: null, score: r.score == null ? null : Number(r.score), max_score: assignment?.max_score == null ? null : Number(assignment.max_score) } })
  const videos: CenterItem[] = (videoRes.data ?? []).map(r => ({ id: r.id, student_id: r.student_id, title: r.title, subtitle: r.description ?? 'Student video', url: r.youtube_url }))
  const projects: CenterItem[] = (projectRes.data ?? []).map(r => ({ id: r.id, student_id: r.student_id, title: r.title, subtitle: r.description ?? 'Portfolio project', url: r.project_url, score: r.final_score == null ? null : Number(r.final_score) }))
  return { group_id: groupId, group_name: group.name, students, sessions, assignments, videos, projects, evaluations: (evaluationRes.data ?? []) as GroupEvaluationData['evaluations'] }
}
