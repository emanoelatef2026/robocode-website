import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EnrollmentProgress {
  enrollment_id:      string
  enrolled_sessions:  number
  consumed_sessions:  number
  remaining_sessions: number
  completion_pct:     number
  is_renewal_ready:   boolean
  start_date:         string | null
  end_date:           string | null
  status:             string
}

export interface StudentAcademicProgress {
  has_enrollment:     boolean
  primary_enrollment: EnrollmentProgress | null
  all_enrollments:    EnrollmentProgress[]
  total_enrolled:     number
  total_consumed:     number
  total_remaining:    number
}

// ── Canonical helpers ──────────────────────────────────────────────────────────

function toProgress(e: any): EnrollmentProgress {
  const enrolled  = Number(e.enrolled_sessions  ?? 0)
  const consumed  = Number(e.consumed_sessions  ?? 0)
  const remaining = Number(e.remaining_sessions ?? 0)
  return {
    enrollment_id:      e.id as string,
    enrolled_sessions:  enrolled,
    consumed_sessions:  consumed,
    remaining_sessions: remaining,
    completion_pct:     enrolled > 0 ? Math.round((consumed / enrolled) * 100) : 0,
    is_renewal_ready:   enrolled > 0 && consumed >= enrolled,
    start_date:         (e.start_date as string | null) ?? null,
    end_date:           (e.end_date   as string | null) ?? null,
    status:             e.status as string,
  }
}

// ── getStudentAcademicProgress ─────────────────────────────────────────────────
// Returns the enrollment-scoped academic progress for a student.
// Primary = oldest ACTIVE enrollment (FIFO). Falls back to any enrollment if no
// active one exists so historical students still see their final state.

export async function getStudentAcademicProgress(
  studentId: string
): Promise<StudentAcademicProgress> {
  const db = createServiceClient()

  const { data: rows } = await db
    .from('student_enrollments')
    .select('id, enrolled_sessions, consumed_sessions, remaining_sessions, status, start_date, end_date')
    .eq('student_id', studentId)
    .order('start_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (!rows || rows.length === 0) {
    return {
      has_enrollment:     false,
      primary_enrollment: null,
      all_enrollments:    [],
      total_enrolled:     0,
      total_consumed:     0,
      total_remaining:    0,
    }
  }

  const enrollments = (rows as any[]).map(toProgress)

  // Primary = oldest ACTIVE, fallback to first (already FIFO sorted)
  const primary = enrollments.find(e => e.status === 'ACTIVE') ?? enrollments[0]

  return {
    has_enrollment:     true,
    primary_enrollment: primary,
    all_enrollments:    enrollments,
    total_enrolled:     enrollments.reduce((s, e) => s + e.enrolled_sessions,  0),
    total_consumed:     enrollments.reduce((s, e) => s + e.consumed_sessions,  0),
    total_remaining:    enrollments.reduce((s, e) => s + e.remaining_sessions, 0),
  }
}

// ── getRemainingStudentSessions ────────────────────────────────────────────────

export async function getRemainingStudentSessions(studentId: string): Promise<number> {
  const db = createServiceClient()
  const { data } = await db
    .from('student_enrollments')
    .select('remaining_sessions')
    .eq('student_id', studentId)
    .eq('status', 'ACTIVE')
    .order('start_date', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return Number((data as any)?.remaining_sessions ?? 0)
}

// ── getStudentEnrollmentLedger ─────────────────────────────────────────────────
// Returns the raw enrollment rows with their ledger-driven consumption counts.

export async function getStudentEnrollmentLedger(studentId: string): Promise<EnrollmentProgress[]> {
  const db = createServiceClient()
  const { data: rows } = await db
    .from('student_enrollments')
    .select('id, enrolled_sessions, consumed_sessions, remaining_sessions, status, start_date, end_date')
    .eq('student_id', studentId)
    .order('start_date', { ascending: true })
    .order('created_at', { ascending: true })
  return (rows ?? []).map(toProgress)
}

// ── resolveEnrollmentForSession ────────────────────────────────────────────────
// Finds the oldest active enrollment that covers a given session_date (ISO string).
// Returns the enrollment_id or null if no eligible enrollment exists.
// Mirrors the FIFO logic used in reconciliation.ts.

export async function resolveEnrollmentForSession(
  studentId:   string,
  sessionDate: string,
): Promise<string | null> {
  const db = createServiceClient()
  const { data: rows } = await db
    .from('student_enrollments')
    .select('id, start_date, end_date, enrolled_sessions, consumed_sessions')
    .eq('student_id', studentId)
    .in('status', ['ACTIVE', 'COMPLETED', 'TRANSFERRED', 'DROPPED', 'CANCELLED', 'PAUSED'])
    .gt('enrolled_sessions', 0)
    .order('start_date', { ascending: true })
    .order('created_at', { ascending: true })

  for (const e of (rows ?? []) as any[]) {
    if (sessionDate < (e.start_date as string)) continue
    if (e.end_date && sessionDate > (e.end_date as string)) continue
    const remaining = Number(e.enrolled_sessions ?? 0) - Number(e.consumed_sessions ?? 0)
    if (remaining <= 0) continue
    return e.id as string
  }
  return null
}

// ── recomputeStudentConsumptionLedger ─────────────────────────────────────────
// Delegates to the DB-side recompute_session_consumption() RPC.
// Repairs drift between attendance_consumptions count and stored consumed_sessions.

export async function recomputeStudentConsumptionLedger(
  enrollmentId?: string
): Promise<{ fixed: number; error: string | null }> {
  const db = createServiceClient()
  const { data, error } = enrollmentId
    ? await db.rpc('recompute_session_consumption', { p_enrollment_id: enrollmentId })
    : await db.rpc('recompute_session_consumption')

  if (error) return { fixed: 0, error: error.message }
  const rows = (data ?? []) as Array<{ fixed: boolean }>
  return { fixed: rows.filter(r => r.fixed).length, error: null }
}
