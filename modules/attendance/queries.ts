import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { AttendanceListItem, SessionStudent } from './types'
import type { PaginatedResult } from '@/types/app'

export async function listAttendanceRecords({
  page = 1,
  perPage = 30,
  branchId,
  groupId,
}: {
  page?: number
  perPage?: number
  branchId?: string | string[]
  groupId?: string
} = {}): Promise<PaginatedResult<AttendanceListItem>> {
  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  let query = db
    .from('attendance_records')
    .select(
      `id, schedule_id, student_id, status, recorded_at, notes,
       students!attendance_records_student_id_fkey(
         users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))
       ),
       schedules!attendance_records_schedule_id_fkey(
         scheduled_at, branch_id,
         branches!schedules_branch_id_fkey(name),
         group_courses!schedules_group_course_id_fkey(
           groups!group_courses_group_id_fkey(name)
         )
       )`,
      { count: 'exact' }
    )
    .order('recorded_at', { ascending: false })
    .range(from, to)

  if (branchId) {
    if (Array.isArray(branchId)) {
      // Pre-query schedule IDs for the allowed branches, then filter
      const { data: schedRows } = await db
        .from('schedules').select('id').in('branch_id', branchId)
      const schedIds = (schedRows ?? []).map((r: any) => r.id as string)
      if (schedIds.length === 0) return { data: [], total: 0, page, perPage, totalPages: 0 }
      query = query.in('schedule_id', schedIds)
    } else {
      query = query.eq('schedules.branch_id', branchId)
    }
  }

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  const items: AttendanceListItem[] = (data ?? []).map((row: any) => ({
    id:                 row.id,
    schedule_id:        row.schedule_id,
    student_id:         row.student_id,
    status:             row.status,
    recorded_at:        row.recorded_at,
    notes:              row.notes,
    student_email:      row.students?.users?.email ?? '',
    student_first_name: row.students?.users?.profiles?.first_name ?? null,
    student_last_name:  row.students?.users?.profiles?.last_name ?? null,
    group_name:         row.schedules?.group_courses?.groups?.name ?? '',
    scheduled_at:       row.schedules?.scheduled_at ?? '',
    branch_name:        row.schedules?.branches?.name ?? '',
  }))

  return {
    data:       items,
    total:      count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  }
}

export async function getGroupStudentsForSession(groupId: string): Promise<SessionStudent[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('group_students')
    .select(
      `student_id,
       students!group_students_student_id_fkey(
         users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))
       )`
    )
    .eq('group_id', groupId)
    .eq('status', 'active')

  if (error) return []

  return (data ?? []).map((row: any) => ({
    student_id:    row.student_id,
    student_email: row.students?.users?.email ?? '',
    first_name:    row.students?.users?.profiles?.first_name ?? null,
    last_name:     row.students?.users?.profiles?.last_name ?? null,
  }))
}

// ── Reconciliation status for the TL attendance landing page ──────────────────

export interface AttendanceReconciliationStatus {
  /** attendance_records that have NO consumption entry (unfunded/unlinked) */
  unmatched_count:              number
  /** distinct students with ≥1 unmatched record */
  students_with_unmatched:      number
  /** students with attendance but ZERO active enrollments */
  students_without_contracts:   number
  /** enrollments where remaining_sessions > 0 (available capacity) */
  contracts_with_unused:        number
  /** v_enrollment_integrity drift count */
  drift_count:                  number
}

export async function getAttendanceReconciliationStatus(
  branchIds: string[]
): Promise<AttendanceReconciliationStatus> {
  const db = createServiceClient()

  // Branch-scoped schedule IDs so we can filter attendance_records
  const { data: schedRows } = await db
    .from('schedules')
    .select('id')
    .in('branch_id', branchIds)
  const schedIds = (schedRows ?? []).map((r: any) => r.id as string)

  if (schedIds.length === 0) {
    return {
      unmatched_count: 0,
      students_with_unmatched: 0,
      students_without_contracts: 0,
      contracts_with_unused: 0,
      drift_count: 0,
    }
  }

  const [
    unmatchedRes,
    driftRes,
    contractsRes,
  ] = await Promise.all([
    // Attendance records with no consumption entry (unlinked)
    db.from('attendance_records')
      .select('id, student_id', { count: 'exact', head: false })
      .in('schedule_id', schedIds)
      .not('id', 'in',
        `(SELECT attendance_record_id FROM attendance_consumptions)`
      ),

    // Drift: enrollments where stored consumed ≠ ledger count
    db.from('v_enrollment_integrity')
      .select('enrollment_id', { count: 'exact', head: true }),

    // Enrollments with remaining capacity
    db.from('student_enrollments')
      .select('id', { count: 'exact', head: true })
      .gt('enrolled_sessions', 0)
      .gt('remaining_sessions', 0)
      .eq('status', 'ACTIVE'),
  ])

  const unmatchedRows = (unmatchedRes.data ?? []) as any[]
  const unmatchedCount = unmatchedRes.count ?? 0
  const studentsWithUnmatched = new Set(unmatchedRows.map((r) => r.student_id as string)).size

  // Students with unmatched attendance but no active enrollment at all
  const unmatchedStudentIds = [...new Set(unmatchedRows.map((r) => r.student_id as string))]
  let studentsWithoutContracts = 0
  if (unmatchedStudentIds.length > 0) {
    const { count } = await db
      .from('student_enrollments')
      .select('student_id', { count: 'exact', head: true })
      .in('student_id', unmatchedStudentIds.slice(0, 500))
      .eq('status', 'ACTIVE')
    // Students who appear in unmatched but NOT in any active enrollment
    studentsWithoutContracts = Math.max(0, unmatchedStudentIds.length - (count ?? 0))
  }

  return {
    unmatched_count:            unmatchedCount,
    students_with_unmatched:    studentsWithUnmatched,
    students_without_contracts: studentsWithoutContracts,
    contracts_with_unused:      contractsRes.count ?? 0,
    drift_count:                driftRes.count ?? 0,
  }
}

// ── Recent attendance timeline for TL landing page ────────────────────────────

export interface RecentAttendanceItem {
  id:            string
  student_name:  string
  group_name:    string
  status:        string
  session_date:  string
  branch_name:   string
}

export async function getRecentAttendance(
  branchIds: string[],
  limit = 12
): Promise<RecentAttendanceItem[]> {
  const db = createServiceClient()

  const { data: schedRows } = await db
    .from('schedules')
    .select('id')
    .in('branch_id', branchIds)
  const schedIds = (schedRows ?? []).map((r: any) => r.id as string)
  if (schedIds.length === 0) return []

  const { data, error } = await db
    .from('attendance_records')
    .select(`
      id, status, recorded_at,
      group_name_snapshot,
      branch_name_snapshot,
      schedules!attendance_records_schedule_id_fkey(scheduled_at),
      students!attendance_records_student_id_fkey(
        users!students_user_id_fkey(
          profiles!profiles_user_id_fkey(first_name, last_name)
        )
      )
    `)
    .in('schedule_id', schedIds)
    .order('recorded_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return (data as any[]).map((r) => {
    const prof = r.students?.users?.profiles
    const name = prof
      ? [prof.first_name, prof.last_name].filter(Boolean).join(' ')
      : 'Unknown Student'
    return {
      id:           r.id as string,
      student_name: name,
      group_name:   (r.group_name_snapshot as string | null) ?? '—',
      status:       r.status as string,
      session_date: (r.schedules?.scheduled_at as string | null) ?? (r.recorded_at as string),
      branch_name:  (r.branch_name_snapshot as string | null) ?? '',
    }
  })
}

export async function getOrCreateGroupCourse(groupId: string, branchId: string): Promise<string | null> {
  const db = createServiceClient()

  const { data: existing } = await db
    .from('group_courses')
    .select('id')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .maybeSingle()

  if (existing) return existing.id

  let courseId: string
  const { data: existingCourse } = await db
    .from('courses')
    .select('id')
    .eq('branch_id', branchId)
    .eq('title', 'General Sessions')
    .maybeSingle()

  if (existingCourse) {
    courseId = existingCourse.id
  } else {
    const { data: newCourse, error: courseError } = await db
      .from('courses')
      .insert({ branch_id: branchId, title: 'General Sessions', scope: 'branch', is_published: true })
      .select('id')
      .single()
    if (courseError || !newCourse) return null
    courseId = newCourse.id
  }

  const { data: newGC, error: gcError } = await db
    .from('group_courses')
    .insert({ group_id: groupId, course_id: courseId, status: 'active' })
    .select('id')
    .single()

  if (gcError || !newGC) return null
  return newGC.id
}
