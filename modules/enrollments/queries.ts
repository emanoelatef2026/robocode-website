import 'server-only'
import { createServiceClient }    from '@/lib/supabase/service'
import type {
  StudentEnrollment,
  EnrollmentListItem,
  EnrollmentStatus,
} from './types'

// ── List enrollments for a student ───────────────────────────────────────────

export async function listStudentEnrollments(
  studentId: string
): Promise<EnrollmentListItem[]> {
  const db = createServiceClient()

  const { data, error } = await db
    .from('student_enrollments')
    .select(`
      *,
      branches!student_enrollments_branch_id_fkey(name),
      groups!student_enrollments_group_id_fkey(name),
      group_courses!student_enrollments_group_course_id_fkey(
        courses!group_courses_course_id_fkey(title),
        instructors!group_courses_instructor_id_fkey(
          users!instructors_user_id_fkey(
            profiles!profiles_user_id_fkey(first_name, last_name)
          )
        )
      )
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const student = await db
    .from('students')
    .select(`
      student_code, emergency_contact,
      users!students_user_id_fkey(email, phone, profiles!profiles_user_id_fkey(first_name, last_name))
    `)
    .eq('id', studentId)
    .maybeSingle()

  const s   = (student.data as any) ?? {}
  const u   = s.users ?? {}
  const p   = u.profiles ?? {}
  const ec  = (s.emergency_contact ?? {}) as Record<string, string>

  return ((data ?? []) as any[]).map(row => {
    const gc   = row.group_courses ?? null
    const instrP = gc?.instructors?.users?.profiles

    return {
      ...mapEnrollment(row),
      student_name:   [p.first_name, p.last_name].filter(Boolean).join(' ') || u.email || 'Unknown',
      student_code:   s.student_code ?? null,
      student_email:  u.email ?? '',
      student_phone:  u.phone ?? null,
      parent_name:    ec.name   ?? null,
      parent_phone_1: ec.phone1 ?? null,
      parent_phone_2: ec.phone2 ?? null,
      branch_name:    (row.branches as any)?.name ?? '',
      group_name:     (row.groups   as any)?.name ?? null,
      instructor_name: instrP ? [instrP.first_name, instrP.last_name].filter(Boolean).join(' ') || null : null,
      course_title:   gc?.courses?.title ?? null,
      // Snapshot fields — populated by sprint42 migration
      group_name_snapshot:      row.group_name_snapshot      ?? null,
      course_name_snapshot:     row.course_name_snapshot     ?? null,
      instructor_name_snapshot: row.instructor_name_snapshot ?? null,
      branch_name_snapshot:     row.branch_name_snapshot     ?? null,
    } satisfies EnrollmentListItem
  })
}

// ── Get single enrollment by ID ────────────────────────────────────────────────

export async function getEnrollmentById(enrollmentId: string): Promise<StudentEnrollment | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('student_enrollments')
    .select('*')
    .eq('id', enrollmentId)
    .maybeSingle()
  if (error || !data) return null
  return mapEnrollment(data as any)
}

// ── Get transfer history for a student ────────────────────────────────────────

export async function getEnrollmentTransferHistory(studentId: string) {
  const db = createServiceClient()
  const { data } = await db
    .from('student_enrollments')
    .select(`
      id, status, start_date, end_date, transferred_to,
      groups!student_enrollments_group_id_fkey(name)
    `)
    .eq('student_id', studentId)
    .not('status', 'eq', 'ACTIVE')
    .order('created_at', { ascending: true })

  return ((data ?? []) as any[]).map(row => ({
    enrollment_id: row.id as string,
    group_name:    (row.groups as any)?.name ?? null,
    status:        row.status as EnrollmentStatus,
    start_date:    row.start_date as string,
    end_date:      row.end_date  as string | null,
    transferred_to: row.transferred_to as string | null,
  }))
}

// ── Get group_course_id for a group (active course) ───────────────────────────

export async function getActiveGroupCourseId(groupId: string): Promise<string | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('group_courses')
    .select('id')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .maybeSingle()
  return (data as any)?.id ?? null
}

// ── Internal helper ───────────────────────────────────────────────────────────

function mapEnrollment(row: any): StudentEnrollment {
  const enrolled  = Number(row.enrolled_sessions  ?? 0)
  const consumed  = Number(row.consumed_sessions  ?? 0)
  const remaining = Number(row.remaining_sessions ?? Math.max(0, enrolled - consumed))
  return {
    id:               row.id,
    student_id:       row.student_id,
    branch_id:        row.branch_id,
    group_id:         row.group_id ?? null,
    group_course_id:  row.group_course_id ?? null,
    instructor_id:    row.instructor_id ?? null,
    group_student_id: row.group_student_id ?? null,
    start_date:       row.start_date,
    end_date:         row.end_date ?? null,
    status:           row.status as EnrollmentStatus,
    enrollment_type:  row.enrollment_type ?? 'primary',
    pricing_plan:     row.pricing_plan ?? null,
    total_amount:     Number(row.total_amount ?? 0),
    discount_amount:  Number(row.discount_amount ?? 0),
    net_amount:       Number(row.net_amount ?? 0),
    expected_sessions:     Number(row.expected_sessions ?? 0),
    attendance_count:      Number(row.attendance_count ?? 0),
    completion_percentage: Number(row.completion_percentage ?? 0),
    // Sprint 44 session contract fields
    enrolled_sessions:  enrolled,
    consumed_sessions:  consumed,
    remaining_sessions: remaining,
    financial_status:   (row.financial_status ?? null) as import('./types').EnrollmentFinancialStatus | null,
    // Sprint 45
    allow_overdraft_sessions: row.allow_overdraft_sessions ?? false,
    transferred_from: row.transferred_from ?? null,
    transferred_to:   row.transferred_to   ?? null,
    notes:            row.notes ?? null,
    created_by:       row.created_by ?? null,
    created_at:       row.created_at,
    updated_at:       row.updated_at,
    // Snapshot fields
    group_name_snapshot:      row.group_name_snapshot      ?? null,
    course_name_snapshot:     row.course_name_snapshot     ?? null,
    instructor_name_snapshot: row.instructor_name_snapshot ?? null,
    branch_name_snapshot:     row.branch_name_snapshot     ?? null,
    pricing_snapshot:         row.pricing_snapshot         ?? null,
  }
}
