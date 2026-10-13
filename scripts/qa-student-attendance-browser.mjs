// Read-only schema/data check. No attendance, contracts, or balances are changed.
// Usage: node scripts/qa-student-attendance-browser.mjs STU-000097
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

nextEnv.loadEnvConfig(process.cwd())
const code = process.argv[2]
if (!code) throw new Error('Provide a student code')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
async function checked(query) {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}
const student = await checked(db.from('students').select('id, branch_id').eq('student_code', code).is('deleted_at', null).single())
const [contracts, records, ledger] = await Promise.all([
  checked(db.from('student_enrollments').select('id, contract_code, course_id, course_name_snapshot, group_name_snapshot, start_date, status, enrolled_sessions, consumed_sessions, remaining_sessions').eq('student_id', student.id).order('created_at', { ascending: false }).order('id')),
  checked(db.from('attendance_records').select('id, status, schedule_id, recorded_at, group_name_snapshot, course_name_snapshot, instructor_name_snapshot').eq('student_id', student.id).is('invalidated_at', null).order('id')),
  checked(db.from('attendance_consumptions').select('attendance_record_id, enrollment_id').eq('student_id', student.id).order('id')),
])
const scheduleIds = [...new Set(records.map(row => row.schedule_id).filter(Boolean))]
const schedules = scheduleIds.length ? await checked(db.from('schedules').select('id, scheduled_at, topic, group_course_id').in('id', scheduleIds)) : []
const groupCourseIds = [...new Set(schedules.map(row => row.group_course_id).filter(Boolean))]
const groupCourses = groupCourseIds.length ? await checked(db.from('group_courses').select('id, course_id, groups!group_courses_group_id_fkey(name), instructors!group_courses_instructor_id_fkey(users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name)))').in('id', groupCourseIds)) : []
const courseIds = [...new Set([...contracts, ...groupCourses].map(row => row.course_id).filter(Boolean))]
if (courseIds.length) await checked(db.from('courses').select('id, title').in('id', courseIds))
const validRecords = new Set(records.map(row => row.id))
console.log(JSON.stringify({
  code, ok: true, records: records.length, courses: courseIds.length,
  contracts: contracts.map(contract => ({
    code: contract.contract_code, status: contract.status,
    valid_attendance: ledger.filter(row => row.enrollment_id === contract.id && validRecords.has(row.attendance_record_id)).length,
    used: contract.consumed_sessions, remaining: contract.remaining_sessions,
  })),
  uncharged_records: records.filter(record => !ledger.some(row => row.attendance_record_id === record.id)).length,
}))
