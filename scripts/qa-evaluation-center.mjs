// Read-only smoke check against the configured Supabase project.
// Usage: node scripts/qa-evaluation-center.mjs GRP-000082
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())
const code = process.argv[2]
if (!code) throw new Error('Provide a group code, e.g. GRP-000082')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const checked = async (name, request) => {
  const { data, error } = await request
  if (error) throw new Error(`${name}: ${error.message}`)
  return data
}

const group = await checked('group', db.from('groups').select('id').eq('code', code).single())
const groupCourses = await checked('group courses', db.from('group_courses').select('id, course_id').eq('group_id', group.id))
const memberships = await checked('memberships', db.from('group_students')
  .select('student_id, students!group_students_student_id_fkey(users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name)))')
  .eq('group_id', group.id).eq('status', 'active'))
const courseIds = groupCourses.map(row => row.id)
const studentIds = memberships.map(row => row.student_id)
const schedules = courseIds.length ? await checked('sessions', db.from('schedules')
  .select('id, scheduled_at, status, topic, session_number, group_course_id')
  .in('group_course_id', courseIds).neq('status', 'cancelled').order('scheduled_at', { ascending: false }).limit(200)) : []
const curriculumIds = [...new Set(groupCourses.map(row => row.course_id).filter(Boolean))]
const modules = curriculumIds.length ? await checked('modules', db.from('course_modules').select('id').in('course_id', curriculumIds).is('deleted_at', null)) : []
const moduleIds = modules.map(row => row.id)
const lessons = moduleIds.length ? await checked('lessons', db.from('lessons').select('id').in('module_id', moduleIds).is('deleted_at', null)) : []
const assignmentIds = new Set()
if (moduleIds.length) {
  const predicates = [`module_id.in.(${moduleIds.join(',')})`]
  if (lessons.length) predicates.push(`lesson_id.in.(${lessons.map(row => row.id).join(',')})`)
  const rows = await checked('curriculum assignments', db.from('assignments').select('id').or(predicates.join(',')).is('deleted_at', null))
  for (const row of rows) assignmentIds.add(row.id)
}
if (schedules.length) {
  const rows = await checked('session assignments', db.from('assignments').select('id').in('schedule_id', schedules.map(row => row.id)).is('deleted_at', null))
  for (const row of rows) assignmentIds.add(row.id)
}
const submissions = assignmentIds.size && studentIds.length ? await checked('submissions', db.from('submissions')
  .select('id, student_id, assignment_id, status, score, submitted_at, assignments!submissions_assignment_id_fkey(title, max_score)')
  .in('student_id', studentIds).in('assignment_id', [...assignmentIds]).limit(300)) : []
const evaluations = studentIds.length ? await checked('evaluations', db.from('student_evaluations')
  .select('id, student_id, criterion, score, rating, feedback, next_goal, visible_to_student, visible_to_parent, published_at, schedule_id, source_type, source_id, updated_at')
  .eq('group_id', group.id).in('student_id', studentIds).is('deleted_at', null).limit(1000)) : []
const videos = studentIds.length ? await checked('videos', db.from('student_videos')
  .select('id, student_id, title, description, youtube_url, created_at')
  .in('student_id', studentIds).limit(300)) : []
const projects = studentIds.length ? await checked('projects', db.from('portfolio_projects')
  .select('id, student_id, title, description, project_url, final_score, created_at')
  .in('student_id', studentIds).eq('is_archived', false).limit(300)) : []

console.log(JSON.stringify({ code, students: memberships.length, sessions: schedules.length, assignments: assignmentIds.size, submissions: submissions.length, evaluations: evaluations.length, videos: videos.length, projects: projects.length, ok: true }))
