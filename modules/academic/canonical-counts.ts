import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface InstructorRange {
  from_session:       number
  to_session:         number | null
  allocated_sessions: number | null
}

export interface StudentContract {
  enrollment_id:      string
  enrolled_sessions:  number
  consumed_sessions:  number
  remaining_sessions: number
  start_date:         string
  status:             string
}

export interface GroupProgress {
  completed_sessions: number
}

// ── 1. Canonical group planned sessions ─────────────────────────────────────
// Source: group_courses.total_sessions (null = open-ended group)

export async function getCanonicalGroupPlannedSessions(groupId: string): Promise<number | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('group_courses')
    .select('total_sessions')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return (data as any).total_sessions ?? null
}

// ── 2. Canonical instructor allocation range ──────────────────────────────────
// Source: group_instructors.from_session / to_session

export async function getCanonicalInstructorRange(
  groupId:      string,
  instructorId: string
): Promise<InstructorRange | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('group_instructors')
    .select('from_session, to_session, allocated_sessions')
    .eq('group_id', groupId)
    .eq('instructor_id', instructorId)
    .maybeSingle()
  if (!data) return null
  const r = data as any
  return {
    from_session:       r.from_session       ?? 1,
    to_session:         r.to_session          ?? null,
    allocated_sessions: r.allocated_sessions  ?? null,
  }
}

// ── 3. Canonical instructor session progress ──────────────────────────────────
// Counts completed schedules within the instructor's allocation range.

export async function getCanonicalInstructorSessionProgress(
  groupId:      string,
  instructorId: string
): Promise<number> {
  const db    = createServiceClient()
  const range = await getCanonicalInstructorRange(groupId, instructorId)

  const { data: gcRow } = await db
    .from('group_courses')
    .select('id')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (!gcRow) return 0
  const gcId = (gcRow as any).id as string

  const { data: sessions } = await db
    .from('schedules')
    .select('session_number')
    .eq('group_course_id', gcId)
    .eq('status', 'completed')
  if (!sessions || sessions.length === 0) return 0

  if (!range) return sessions.length
  return sessions.filter((s: any) =>
    s.session_number != null &&
    s.session_number >= range.from_session &&
    (range.to_session == null || s.session_number <= range.to_session)
  ).length
}

// ── 4. Canonical student contract ────────────────────────────────────────────
// FIFO: prefers group-linked ACTIVE enrollment, fallback to any ACTIVE enrollment.

export async function getCanonicalStudentContract(
  studentId: string,
  groupId?:  string
): Promise<StudentContract | null> {
  const db = createServiceClient()

  if (groupId) {
    const { data } = await db
      .from('student_enrollments')
      .select('id, enrolled_sessions, consumed_sessions, remaining_sessions, start_date, status')
      .eq('student_id', studentId)
      .eq('group_id', groupId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (data) return mapContract(data)
  }

  const { data } = await db
    .from('student_enrollments')
    .select('id, enrolled_sessions, consumed_sessions, remaining_sessions, start_date, status')
    .eq('student_id', studentId)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data ? mapContract(data) : null
}

function mapContract(row: any): StudentContract {
  return {
    enrollment_id:      row.id,
    enrolled_sessions:  row.enrolled_sessions  ?? 0,
    consumed_sessions:  row.consumed_sessions  ?? 0,
    remaining_sessions: row.remaining_sessions ?? 0,
    start_date:         row.start_date,
    status:             row.status,
  }
}

// ── 5. Canonical consumed sessions from ledger ────────────────────────────────
// Source: COUNT(*) FROM attendance_consumptions (not the stored column)

export async function getCanonicalStudentConsumedSessions(
  studentId:    string,
  enrollmentId: string
): Promise<number> {
  const db = createServiceClient()
  const { count } = await db
    .from('attendance_consumptions')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('enrollment_id', enrollmentId)
  return count ?? 0
}

// ── 6. Canonical student remaining sessions ───────────────────────────────────
// From the enrollment GENERATED column (enrolled − consumed).

export async function getCanonicalStudentRemainingSessions(
  studentId: string,
  groupId?:  string
): Promise<number> {
  const contract = await getCanonicalStudentContract(studentId, groupId)
  return contract?.remaining_sessions ?? 0
}

// ── 7. Canonical group delivery progress ─────────────────────────────────────
// Source: groups.completed_sessions (trigger-maintained counter, migration 0034).

export async function getCanonicalGroupProgress(groupId: string): Promise<GroupProgress> {
  const db = createServiceClient()
  const { data } = await db
    .from('groups')
    .select('completed_sessions')
    .eq('id', groupId)
    .maybeSingle()
  return { completed_sessions: (data as any)?.completed_sessions ?? 0 }
}
