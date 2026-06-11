import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { EnrollmentStatus } from './types'
import type { AttendanceStatus } from '@/types/enums'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SessionRecord {
  attendance_record_id: string
  schedule_id:          string
  session_date:         string
  status:               AttendanceStatus
  notes:                string | null
  // Snapshots written at record time (null for pre-migration rows → falls back to live)
  group_name:           string | null
  course_name:          string | null
  instructor_name:      string | null
  branch_name:          string | null
  // Which enrollment this session was attributed to (from ledger)
  enrollment_id:        string | null
}

export interface PackageHistory {
  id:                 string
  start_date:         string
  end_date:           string | null
  status:             EnrollmentStatus
  enrollment_type:    string
  enrolled_sessions:  number
  consumed_sessions:  number
  remaining_sessions: number
  total_amount:       number
  discount_amount:    number
  net_amount:         number
  // Contract-time snapshots
  group_name_snapshot:      string | null
  course_name_snapshot:     string | null
  instructor_name_snapshot: string | null
  // Sessions attributed to this package via ledger
  sessions: SessionRecord[]
}

export interface StudentLearningHistory {
  student_id:          string
  packages:            PackageHistory[]
  // Sessions with no ledger entry (pre-migration or non-consuming statuses)
  unlinked_sessions:   SessionRecord[]
  // Totals
  total_present:       number
  total_absent:        number
  total_late:          number
  total_makeup:        number
  total_excused:       number
}

// ── Query ──────────────────────────────────────────────────────────────────────

export async function getStudentLearningHistory(
  studentId: string
): Promise<StudentLearningHistory> {
  const db = createServiceClient()

  // Three parallel queries: enrollments, attendance, consumption ledger
  const [enrollmentsRes, attendanceRes, consumptionsRes] = await Promise.all([
    db.from('student_enrollments')
      .select(`
        id, start_date, end_date, status, enrollment_type,
        enrolled_sessions, consumed_sessions, remaining_sessions,
        total_amount, discount_amount, net_amount,
        group_name_snapshot, course_name_snapshot, instructor_name_snapshot
      `)
      .eq('student_id', studentId)
      .order('start_date', { ascending: true })
      .order('created_at', { ascending: true }),

    db.from('attendance_records')
      .select(`
        id,
        schedule_id,
        status,
        notes,
        group_name_snapshot,
        course_name_snapshot,
        instructor_name_snapshot,
        branch_name_snapshot,
        schedules!inner(scheduled_at)
      `)
      .eq('student_id', studentId)
      .order('recorded_at', { ascending: false }),

    db.from('attendance_consumptions')
      .select('attendance_record_id, enrollment_id')
      .eq('student_id', studentId),
  ])

  // Build lookup: attendance_record_id → enrollment_id
  const consumptionMap = new Map<string, string>()
  for (const c of (consumptionsRes.data ?? []) as any[]) {
    consumptionMap.set(c.attendance_record_id as string, c.enrollment_id as string)
  }

  // Map attendance rows into SessionRecord
  const sessionsByEnrollment = new Map<string, SessionRecord[]>()
  const unlinked: SessionRecord[] = []

  for (const ar of (attendanceRes.data ?? []) as any[]) {
    const enrollmentId = consumptionMap.get(ar.id as string) ?? null
    const rec: SessionRecord = {
      attendance_record_id: ar.id,
      schedule_id:          ar.schedule_id,
      session_date:         (ar.schedules as any)?.scheduled_at ?? '',
      status:               ar.status as AttendanceStatus,
      notes:                ar.notes ?? null,
      group_name:           ar.group_name_snapshot ?? null,
      course_name:          ar.course_name_snapshot ?? null,
      instructor_name:      ar.instructor_name_snapshot ?? null,
      branch_name:          ar.branch_name_snapshot ?? null,
      enrollment_id:        enrollmentId,
    }

    if (enrollmentId) {
      if (!sessionsByEnrollment.has(enrollmentId)) sessionsByEnrollment.set(enrollmentId, [])
      sessionsByEnrollment.get(enrollmentId)!.push(rec)
    } else {
      unlinked.push(rec)
    }
  }

  // Build packages
  const packages: PackageHistory[] = ((enrollmentsRes.data ?? []) as any[]).map(e => ({
    id:                 e.id as string,
    start_date:         e.start_date as string,
    end_date:           e.end_date as string | null,
    status:             e.status as EnrollmentStatus,
    enrollment_type:    e.enrollment_type as string,
    enrolled_sessions:  Number(e.enrolled_sessions ?? 0),
    consumed_sessions:  Number(e.consumed_sessions ?? 0),
    remaining_sessions: Number(e.remaining_sessions ?? 0),
    total_amount:       Number(e.total_amount ?? 0),
    discount_amount:    Number(e.discount_amount ?? 0),
    net_amount:         Number(e.net_amount ?? 0),
    group_name_snapshot:      e.group_name_snapshot ?? null,
    course_name_snapshot:     e.course_name_snapshot ?? null,
    instructor_name_snapshot: e.instructor_name_snapshot ?? null,
    sessions: sessionsByEnrollment.get(e.id as string) ?? [],
  }))

  // Attendance totals across all records
  let total_present = 0, total_absent = 0, total_late = 0, total_makeup = 0, total_excused = 0
  const allSessions = [...packages.flatMap(p => p.sessions), ...unlinked]
  for (const s of allSessions) {
    if (s.status === 'present')  total_present++
    if (s.status === 'absent')   total_absent++
    if (s.status === 'late')     total_late++
    if (s.status === 'makeup')   total_makeup++
    if (s.status === 'excused')  total_excused++
  }

  return {
    student_id:        studentId,
    packages,
    unlinked_sessions: unlinked,
    total_present,
    total_absent,
    total_late,
    total_makeup,
    total_excused,
  }
}
