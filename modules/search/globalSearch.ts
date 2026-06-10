import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { computeRisk, computeRenewalPriority, computeCollectionPriority } from '@/modules/operational-engine'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GlobalSearchHit {
  type: 'student' | 'parent' | 'instructor' | 'course' | 'group'
  id:   string
  // Display
  name:     string
  subtitle: string | null
  // Student extras
  student_code?:        string | null
  phone?:               string | null
  parent_name?:         string | null
  parent_phone?:        string | null
  branch_name?:         string | null
  active_enrollments?:  number
  remaining_balance?:   number
  next_due_date?:       string | null
  risk_level?:          'HIGH' | 'MEDIUM' | 'LOW' | null
  collection_priority?: string | null
  renewal_priority?:    string | null
  quick_action?:        string | null    // primary recommended action label
}

export interface GlobalSearchResponse {
  students:    GlobalSearchHit[]
  parents:     GlobalSearchHit[]
  instructors: GlobalSearchHit[]
  courses:     GlobalSearchHit[]
  groups:      GlobalSearchHit[]
  total:       number
}

// ── Main search function ───────────────────────────────────────────────────────

export async function globalSearch(
  query:     string,
  branchIds: string[],
  limit = 8
): Promise<GlobalSearchResponse> {
  const empty: GlobalSearchResponse = { students: [], parents: [], instructors: [], courses: [], groups: [], total: 0 }
  if (!query || query.trim().length < 2 || !branchIds.length) return empty

  const q   = query.trim()
  const pct = `%${q}%`
  const db  = createServiceClient()

  // ── Run all searches in parallel ────────────────────────────────────────────
  const [
    profileHits,
    phoneHits,
    codeHits,
    instructorHits,
    courseHits,
    groupHits,
  ] = await Promise.all([
    // Student: by name (via profiles)
    db.from('profiles')
      .select('user_id')
      .or(`first_name.ilike.${pct},last_name.ilike.${pct}`)
      .limit(50),

    // Student: by phone
    db.from('users')
      .select('id')
      .ilike('phone', pct)
      .limit(30),

    // Student: by code
    db.from('students')
      .select('id')
      .ilike('student_code', pct)
      .in('branch_id', branchIds)
      .is('deleted_at', null)
      .limit(30),

    // Instructor: by name
    db.from('instructors')
      .select(`
        id,
        users!instructors_user_id_fkey(
          email,
          profiles!profiles_user_id_fkey(first_name, last_name)
        )
      `)
      .is('deleted_at', null)
      .limit(20),

    // Course: by title
    db.from('courses')
      .select('id, title, level')
      .ilike('title', pct)
      .is('deleted_at', null)
      .limit(limit),

    // Group: by name
    db.from('groups')
      .select('id, name, type, status')
      .in('branch_id', branchIds)
      .ilike('name', pct)
      .is('deleted_at', null)
      .limit(limit),
  ])

  // ── Resolve student IDs ────────────────────────────────────────────────────
  const profileUserIds = (profileHits.data ?? []).map((r: any) => r.user_id as string)
  const phoneUserIds   = (phoneHits.data  ?? []).map((r: any) => r.id as string)

  const [fromProfiles, fromPhone] = await Promise.all([
    profileUserIds.length > 0
      ? db.from('students').select('id').in('user_id', profileUserIds).in('branch_id', branchIds).is('deleted_at', null).limit(50)
      : Promise.resolve({ data: [] }),
    phoneUserIds.length > 0
      ? db.from('students').select('id').in('user_id', phoneUserIds).in('branch_id', branchIds).is('deleted_at', null).limit(50)
      : Promise.resolve({ data: [] }),
  ])

  const allStudentIds = [...new Set([
    ...(fromProfiles.data ?? []).map((r: any) => r.id as string),
    ...(fromPhone.data    ?? []).map((r: any) => r.id as string),
    ...(codeHits.data     ?? []).map((r: any) => r.id as string),
  ])].slice(0, 30)

  // ── Fetch full student detail ────────────────────────────────────────────────
  let studentHits: GlobalSearchHit[] = []
  if (allStudentIds.length) {
    const [stuRes, enrollRes, accRes] = await Promise.all([
      db.from('students')
        .select(`
          id, student_code, branch_id,
          users!students_user_id_fkey(email, phone, profiles!profiles_user_id_fkey(first_name, last_name)),
          branches!students_branch_id_fkey(name)
        `)
        .in('id', allStudentIds)
        .is('deleted_at', null)
        .limit(limit),

      db.from('student_enrollments')
        .select('student_id, remaining_sessions, enrolled_sessions')
        .in('student_id', allStudentIds)
        .eq('status', 'ACTIVE'),

      db.from('student_financial_accounts')
        .select('student_id, remaining_amount, status, next_due_date')
        .in('student_id', allStudentIds),
    ])

    const enrollCountMap   = new Map<string, number>()
    const minSessionsMap   = new Map<string, number>()    // min remaining_sessions across contracts
    for (const e of (enrollRes.data ?? []) as any[]) {
      enrollCountMap.set(e.student_id, (enrollCountMap.get(e.student_id) ?? 0) + 1)
      const enrolled  = Number(e.enrolled_sessions  ?? 0)
      const remaining = Number(e.remaining_sessions ?? 0)
      if (enrolled > 0) {
        const cur = minSessionsMap.get(e.student_id) ?? Infinity
        if (remaining < cur) minSessionsMap.set(e.student_id, remaining)
      }
    }

    const balanceMap  = new Map<string, number>()
    const nextDueMap  = new Map<string, string>()
    const statusMap   = new Map<string, string>()
    for (const a of (accRes.data ?? []) as any[]) {
      const cur = balanceMap.get(a.student_id) ?? 0
      balanceMap.set(a.student_id, cur + Number(a.remaining_amount ?? 0))
      if (a.next_due_date && !nextDueMap.has(a.student_id)) nextDueMap.set(a.student_id, a.next_due_date)
      if (a.status === 'OVERDUE' || a.status === 'BLOCKED') statusMap.set(a.student_id, a.status)
    }

    studentHits = ((stuRes.data ?? []) as any[]).map(s => {
      const u   = s.users    ?? {}
      const p   = u.profiles ?? {}
      const name      = [p.first_name, p.last_name].filter(Boolean).join(' ') || u.email || 'Unknown'
      const remaining = balanceMap.get(s.id) ?? 0
      const nextDue   = nextDueMap.get(s.id) ?? null
      const finStatus = statusMap.get(s.id) ?? null

      const today   = new Date().toISOString().slice(0, 10)
      const daysOvr = nextDue && nextDue < today && remaining > 0
        ? Math.floor((Date.now() - new Date(nextDue).getTime()) / 86400000)
        : 0

      const sessLeft = minSessionsMap.get(s.id) ?? null

      const risk = computeRisk({
        enrolled_sessions:   sessLeft !== null ? 1 : 0,
        consumed_sessions:   0,
        remaining_sessions:  sessLeft ?? 0,
        total_sessions:      0,
        sessions_attended:   0,
        attendance_pct:      100,
        consecutive_absences: 0,
        last_attendance_date: null,
        remaining_balance:   remaining,
        days_overdue:        daysOvr,
        financial_status:    finStatus,
        net_amount:          0,
        group_id:            'search',
        has_assignment_submissions: true,
      })

      const colPri = computeCollectionPriority({ enrolled_sessions: 0, consumed_sessions: 0, remaining_sessions: 0, total_sessions: 0, sessions_attended: 0, attendance_pct: 100, consecutive_absences: 0, last_attendance_date: null, remaining_balance: remaining, days_overdue: daysOvr, financial_status: finStatus, net_amount: 0, group_id: null, has_assignment_submissions: true })
      const renPri = sessLeft !== null ? computeRenewalPriority({ enrolled_sessions: 1, consumed_sessions: 0, remaining_sessions: sessLeft, total_sessions: 0, sessions_attended: 0, attendance_pct: 100, consecutive_absences: 0, last_attendance_date: null, remaining_balance: 0, days_overdue: 0, financial_status: null, net_amount: 0, group_id: null, has_assignment_submissions: true }) : 'NONE'

      const quickAction =
        finStatus === 'BLOCKED' ? 'Payment Blocked' :
        daysOvr > 0 && remaining > 0 ? `Collect EGP ${remaining}` :
        sessLeft !== null && sessLeft <= 2 ? 'Renew Package' :
        null

      return {
        type:        'student' as const,
        id:          s.id,
        name,
        subtitle:    (s.branches as any)?.name ?? null,
        student_code: s.student_code ?? null,
        phone:        u.phone ?? null,
        parent_name:  null,
        parent_phone: null,
        branch_name:  (s.branches as any)?.name ?? null,
        active_enrollments: enrollCountMap.get(s.id) ?? 0,
        remaining_balance:  remaining,
        next_due_date:      nextDue,
        risk_level:         risk.level,
        collection_priority: colPri !== 'NONE' ? colPri : null,
        renewal_priority:    renPri !== 'NONE' ? renPri : null,
        quick_action:        quickAction,
      }
    })
  }

  // ── Instructor hits (filter by name match) ──────────────────────────────────
  const instrHits: GlobalSearchHit[] = ((instructorHits.data ?? []) as any[])
    .filter(i => {
      const p   = i.users?.profiles
      const full = [p?.first_name, p?.last_name].filter(Boolean).join(' ').toLowerCase()
      return full.includes(q.toLowerCase())
    })
    .slice(0, limit)
    .map(i => {
      const p   = i.users?.profiles ?? {}
      const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || i.users?.email || 'Unknown'
      return {
        type:     'instructor' as const,
        id:       i.id,
        name,
        subtitle: i.users?.email ?? null,
      }
    })

  // ── Course hits ──────────────────────────────────────────────────────────────
  const courseResults: GlobalSearchHit[] = ((courseHits.data ?? []) as any[]).map(c => ({
    type:     'course' as const,
    id:       c.id,
    name:     c.title,
    subtitle: c.level ?? null,
  }))

  // ── Group hits ───────────────────────────────────────────────────────────────
  const groupResults: GlobalSearchHit[] = ((groupHits.data ?? []) as any[]).map(g => ({
    type:     'group' as const,
    id:       g.id,
    name:     g.name,
    subtitle: g.type ?? null,
  }))

  const total = studentHits.length + instrHits.length + courseResults.length + groupResults.length

  return {
    students:    studentHits,
    parents:     [],
    instructors: instrHits,
    courses:     courseResults,
    groups:      groupResults,
    total,
  }
}
