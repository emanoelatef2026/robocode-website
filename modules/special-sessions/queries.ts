import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { TrialSession, MakeupSession, SpecialSessionListItem } from './types'

// ── Instructor resolver ────────────────────────────────────────────────────────

async function resolveInstructorName(
  instructorId: string | null,
  db: ReturnType<typeof createServiceClient>
): Promise<string | null> {
  if (!instructorId) return null
  const { data } = await db
    .from('instructors')
    .select('users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))')
    .eq('id', instructorId)
    .maybeSingle()
  if (!data) return null
  const prof = (data as any).users?.profiles
  return prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || null : null
}

// ── getTrialSession ────────────────────────────────────────────────────────────

export async function getTrialSession(sessionId: string): Promise<TrialSession | null> {
  const db = createServiceClient()

  const [sessRes, studRes] = await Promise.all([
    db.from('schedules')
      .select('id, branch_id, scheduled_at, duration_minutes, notes, status, created_by, created_at, branches!schedules_branch_id_fkey(name)')
      .eq('id', sessionId)
      .eq('type', 'trial')
      .maybeSingle(),
    db.from('trial_session_students')
      .select('*')
      .eq('schedule_id', sessionId)
      .order('created_at', { ascending: true }),
  ])

  if (!sessRes.data) return null
  const s = sessRes.data as any

  // Find instructor from session_instructors
  const { data: siRow } = await db
    .from('session_instructors')
    .select('instructor_id')
    .eq('session_id', sessionId)
    .maybeSingle()

  const instructorId   = (siRow as any)?.instructor_id ?? null
  const instructorName = await resolveInstructorName(instructorId, db)

  return {
    id:               s.id,
    branch_id:        s.branch_id,
    branch_name:      s.branches?.name ?? '',
    instructor_id:    instructorId,
    instructor_name:  instructorName,
    scheduled_at:     s.scheduled_at,
    duration_minutes: s.duration_minutes,
    course_name:      null,
    notes:            s.notes ?? null,
    status:           s.status,
    created_by:       s.created_by ?? null,
    created_at:       s.created_at,
    students: (studRes.data ?? []).map((r: any) => ({
      id:                r.id,
      schedule_id:       r.schedule_id,
      lead_id:           r.lead_id ?? null,
      student_name:      r.student_name,
      student_phone:     r.student_phone ?? null,
      parent_phone:      r.parent_phone ?? null,
      notes:             r.notes ?? null,
      attendance_status: r.attendance_status ?? null,
      created_at:        r.created_at,
    })),
  }
}

// ── getMakeupSession ───────────────────────────────────────────────────────────

export async function getMakeupSession(sessionId: string): Promise<MakeupSession | null> {
  const db = createServiceClient()

  const [sessRes, studRes] = await Promise.all([
    db.from('schedules')
      .select('id, branch_id, scheduled_at, duration_minutes, notes, status, created_by, created_at, branches!schedules_branch_id_fkey(name)')
      .eq('id', sessionId)
      .eq('type', 'makeup')
      .is('group_course_id', null)
      .maybeSingle(),
    db.from('makeup_session_students')
      .select(
        `*, students!makeup_session_students_student_id_fkey(
          users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
        ), replaced:schedules!makeup_session_students_replaced_session_id_fkey(session_number)`
      )
      .eq('schedule_id', sessionId)
      .order('created_at', { ascending: true }),
  ])

  if (!sessRes.data) return null
  const s = sessRes.data as any

  const { data: siRow } = await db
    .from('session_instructors')
    .select('instructor_id')
    .eq('session_id', sessionId)
    .maybeSingle()

  const instructorId   = (siRow as any)?.instructor_id ?? null
  const instructorName = await resolveInstructorName(instructorId, db)

  return {
    id:               s.id,
    branch_id:        s.branch_id,
    branch_name:      s.branches?.name ?? '',
    instructor_id:    instructorId,
    instructor_name:  instructorName,
    scheduled_at:     s.scheduled_at,
    duration_minutes: s.duration_minutes,
    notes:            s.notes ?? null,
    status:           s.status,
    created_by:       s.created_by ?? null,
    created_at:       s.created_at,
    students: (studRes.data ?? []).map((r: any) => {
      const prof = r.students?.users?.profiles
      return {
        id:                   r.id,
        schedule_id:          r.schedule_id,
        student_id:           r.student_id,
        student_name:         prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || 'Unknown' : 'Unknown',
        mode:                 r.mode,
        replaced_session_id:  r.replaced_session_id ?? null,
        replaced_session_num: r.replaced?.session_number ?? null,
        attendance_status:    r.attendance_status ?? null,
        created_at:           r.created_at,
      }
    }),
  }
}

// ── listSpecialSessions ────────────────────────────────────────────────────────
// Lists all special sessions visible to the given instructor (or all for admin).

export async function listSpecialSessions(options: {
  instructorId?: string   // if set, only sessions this instructor is assigned to
  branchId?:     string | string[]
  type?:         'trial' | 'makeup'
  fromDate?:     string
  toDate?:       string
  limit?:        number
}): Promise<SpecialSessionListItem[]> {
  const { instructorId, branchId, type, fromDate, toDate, limit = 50 } = options
  const db = createServiceClient()

  // Fetch standalone sessions (group_course_id IS NULL) that match type filter
  let q = db
    .from('schedules')
    .select(
      `id, type, branch_id, scheduled_at, duration_minutes, status,
       branches!schedules_branch_id_fkey(name)`
    )
    .is('group_course_id', null)
    .in('type', type ? [type] : ['trial', 'makeup'])
    .order('scheduled_at', { ascending: false })
    .limit(limit)

  if (branchId) {
    if (Array.isArray(branchId)) q = (q as any).in('branch_id', branchId)
    else q = (q as any).eq('branch_id', branchId)
  }
  if (fromDate) q = (q as any).gte('scheduled_at', fromDate)
  if (toDate)   q = (q as any).lte('scheduled_at', toDate)

  const { data: rows } = await q

  if (!rows || rows.length === 0) return []

  const sessionIds = (rows as any[]).map((r) => r.id as string)

  // If instructor filter — keep only sessions where they're in session_instructors
  let allowedSessionIds: Set<string>
  if (instructorId) {
    const { data: siRows } = await db
      .from('session_instructors')
      .select('session_id')
      .in('session_id', sessionIds)
      .eq('instructor_id', instructorId)
    allowedSessionIds = new Set((siRows ?? []).map((r: any) => r.session_id as string))
  } else {
    allowedSessionIds = new Set(sessionIds)
  }

  // Count participants per session
  const [trialCounts, makeupCounts, siRows] = await Promise.all([
    db.from('trial_session_students').select('schedule_id').in('schedule_id', sessionIds),
    db.from('makeup_session_students').select('schedule_id').in('schedule_id', sessionIds),
    db.from('session_instructors')
      .select('session_id, instructor_id')
      .in('session_id', sessionIds),
  ])

  const countMap: Record<string, number> = {}
  for (const r of (trialCounts.data ?? []) as any[]) {
    countMap[r.schedule_id] = (countMap[r.schedule_id] ?? 0) + 1
  }
  for (const r of (makeupCounts.data ?? []) as any[]) {
    countMap[r.schedule_id] = (countMap[r.schedule_id] ?? 0) + 1
  }

  // Map instructor per session
  const instrMap: Record<string, string> = {}
  for (const r of (siRows.data ?? []) as any[]) {
    instrMap[r.session_id] = r.instructor_id
  }

  // Resolve instructor names
  const uniqueInstrIds = [...new Set(Object.values(instrMap))]
  const instrNameMap: Record<string, string | null> = {}
  if (uniqueInstrIds.length > 0) {
    const { data: instrRows } = await db
      .from('instructors')
      .select('id, users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))')
      .in('id', uniqueInstrIds)
    for (const r of (instrRows ?? []) as any[]) {
      const prof = r.users?.profiles
      instrNameMap[r.id] = prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || null : null
    }
  }

  return (rows as any[])
    .filter((r) => allowedSessionIds.has(r.id))
    .map((r) => ({
      id:                r.id,
      type:              r.type as 'trial' | 'makeup',
      branch_id:         r.branch_id,
      branch_name:       r.branches?.name ?? '',
      instructor_name:   instrMap[r.id] ? (instrNameMap[instrMap[r.id]] ?? null) : null,
      scheduled_at:      r.scheduled_at,
      duration_minutes:  r.duration_minutes,
      status:            r.status,
      participant_count: countMap[r.id] ?? 0,
    }))
}

// ── Today's standalone special sessions for instructor dashboard ───────────────

export async function getTodaySpecialSessions(instructorId: string): Promise<{
  id:               string
  type:             'trial' | 'makeup'
  branch_id:        string
  branch_name:      string
  scheduled_at:     string
  duration_minutes: number
  status:           string
  participant_count: number
}[]> {
  const db = createServiceClient()

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999)

  // Find session_ids assigned to this instructor today
  const { data: siRows } = await db
    .from('session_instructors')
    .select('session_id')
    .eq('instructor_id', instructorId)

  if (!siRows || siRows.length === 0) return []

  const siSessionIds = (siRows as any[]).map((r) => r.session_id as string)

  const { data: rows } = await db
    .from('schedules')
    .select('id, type, branch_id, scheduled_at, duration_minutes, status, branches!schedules_branch_id_fkey(name)')
    .in('id', siSessionIds)
    .is('group_course_id', null)
    .in('type', ['trial', 'makeup'])
    .gte('scheduled_at', todayStart.toISOString())
    .lte('scheduled_at', todayEnd.toISOString())
    .not('status', 'in', '("cancelled","cancelled_with_makeup")')

  if (!rows || rows.length === 0) return []

  const sessionIds = (rows as any[]).map((r) => r.id as string)
  const [tCounts, mCounts] = await Promise.all([
    db.from('trial_session_students').select('schedule_id').in('schedule_id', sessionIds),
    db.from('makeup_session_students').select('schedule_id').in('schedule_id', sessionIds),
  ])

  const countMap: Record<string, number> = {}
  for (const r of [...(tCounts.data ?? []), ...(mCounts.data ?? [])] as any[]) {
    countMap[r.schedule_id] = (countMap[r.schedule_id] ?? 0) + 1
  }

  return (rows as any[]).map((r) => ({
    id:                r.id,
    type:              r.type as 'trial' | 'makeup',
    branch_id:         r.branch_id,
    branch_name:       r.branches?.name ?? '',
    scheduled_at:      r.scheduled_at,
    duration_minutes:  r.duration_minutes,
    status:            r.status,
    participant_count: countMap[r.id] ?? 0,
  }))
}

// ── searchLeads for trial session student picker ───────────────────────────────

export async function searchLeadsForTrialSession(
  query: string,
  branchId?: string
): Promise<Array<{
  id:          string
  child_name:  string
  parent_name: string | null
  phone:       string | null
  status:      string
}>> {
  const db = createServiceClient()
  const q  = `%${query}%`

  let req = db
    .from('leads')
    .select('id, child_name, parent_name, phone')
    .or(`child_name.ilike.${q},phone.ilike.${q},whatsapp.ilike.${q}`)
    .not('status', 'in', '("CONVERTED","LOST")')
    .limit(20)

  if (branchId) req = (req as any).eq('branch_id', branchId)

  const { data } = await req
  return ((data ?? []) as any[]).map((r) => ({
    id:          r.id,
    child_name:  r.child_name,
    parent_name: r.parent_name ?? null,
    phone:       r.phone ?? null,
    status:      r.status,
  }))
}

// ── searchStudents for makeup session student picker ──────────────────────────

export async function searchStudentsForMakeupSession(
  query: string,
  branchId?: string
): Promise<Array<{
  id:         string
  name:       string
  phone:      string | null
}>> {
  const db = createServiceClient()
  const q  = `%${query}%`

  let req = db
    .from('students')
    .select(
      `id,
       users!students_user_id_fkey(
         profiles!profiles_user_id_fkey(first_name, last_name)
       )`
    )
    .eq('status', 'active')
    .is('deleted_at', null)
    .limit(20)

  if (branchId) req = (req as any).eq('branch_id', branchId)

  const { data } = await req
  return ((data ?? []) as any[])
    .map((r) => {
      const prof = r.users?.profiles
      const name = prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') : ''
      return { id: r.id, name, phone: null }
    })
    .filter((r) => !query || r.name.toLowerCase().includes(query.toLowerCase()))
}

// ── getSessionsForMakeupReplacement ───────────────────────────────────────────
// Returns past sessions where the student was absent (for REPLACE_MISSED mode).

export async function getAbsentSessionsForStudent(studentId: string): Promise<Array<{
  schedule_id:    string
  session_number: number | null
  scheduled_at:   string
  group_name:     string
}>> {
  const db = createServiceClient()

  const { data } = await db
    .from('attendance_records')
    .select(
      `schedule_id,
       schedules!attendance_records_schedule_id_fkey(
         session_number, scheduled_at,
         group_courses!schedules_group_course_id_fkey(
           groups!group_courses_group_id_fkey(name)
         )
       )`
    )
    .eq('student_id', studentId)
    .eq('status', 'absent')
    .limit(30)

  return ((data ?? []) as any[]).map((r) => {
    const s = r.schedules
    return {
      schedule_id:    r.schedule_id,
      session_number: s?.session_number ?? null,
      scheduled_at:   s?.scheduled_at   ?? '',
      group_name:     s?.group_courses?.groups?.name ?? '',
    }
  })
}
