import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstructorFilterOptions } from '@/modules/query-standards'

// ── Types ──────────────────────────────────────────────────────────────────────

export type ParentOpHealth = 'HEALTHY' | 'AT_RISK' | 'NEEDS_ATTENTION' | 'NO_CHILDREN' | 'INACTIVE'

export interface LinkedChild {
  student_id:          string
  student_name:        string
  student_code:        string | null
  age:                 number | null
  branch_id:           string
  branch_name:         string
  relationship:        string
  is_primary:          boolean
  student_status:      string
  // Academic
  group_id:            string | null
  group_name:          string | null
  course_id:           string | null
  course_name:         string | null
  instructor_id:       string | null
  instructor_name:     string | null
  // Sessions
  enrolled_sessions:   number
  consumed_sessions:   number
  remaining_sessions:  number
  // Attendance
  attendance_pct:        number
  sessions_attended:     number
  total_sessions:        number
  consecutive_absences:  number
  last_attendance_date:  string | null
  // Risk
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface ParentOperationalRow {
  parent_id:    string
  user_id:      string
  parent_name:  string
  first_name:   string | null
  last_name:    string | null
  email:        string
  phone:        string | null
  // Children
  children:       LinkedChild[]
  children_count: number
  // Operational aggregates
  op_health:                      ParentOpHealth
  active_contracts_count:         number
  total_sessions_remaining:       number
  attendance_risk_children_count: number
  near_exhaustion_children_count: number
  last_attendance_at:             string | null
  // For client-side filtering
  branch_ids:     string[]
  course_ids:     string[]
  group_ids:      string[]
  instructor_ids: string[]
}

export interface StudentPickerOption {
  student_id:   string
  student_name: string
  student_code: string | null
  branch_name:  string
  group_name:   string | null
  age:          number | null
  phone:        string | null
}

// ── Main operational query ─────────────────────────────────────────────────────

export async function listParentsOperational(
  branchIds: string[]
): Promise<ParentOperationalRow[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  // 1. Students in branch (basic identity + age)
  const { data: students } = await db
    .from('students')
    .select(`
      id, user_id, branch_id, student_code, status, age,
      users!students_user_id_fkey(
        phone,
        profiles!profiles_user_id_fkey(first_name, last_name)
      ),
      branches!students_branch_id_fkey(name)
    `)
    .in('branch_id', branchIds)
    .is('deleted_at', null)

  const stuRows = (students ?? []) as any[]
  if (!stuRows.length) return []
  const studentIds = stuRows.map((s: any) => s.id as string)

  // 2. Parent → student links for these students
  const { data: psLinks } = await db
    .from('parent_students')
    .select('parent_id, student_id, relationship, is_primary')
    .in('student_id', studentIds)

  if (!(psLinks as any[])?.length) return []
  const parentIds = [...new Set((psLinks as any[]).map((ps: any) => ps.parent_id as string))]

  // 3. Parent records with user + profile
  const { data: parents } = await db
    .from('parents')
    .select(`
      id, user_id,
      users!parents_user_id_fkey(
        email, phone,
        profiles!profiles_user_id_fkey(first_name, last_name)
      )
    `)
    .in('id', parentIds)

  if (!(parents as any[])?.length) return []

  // 4. Group memberships for students
  const { data: gsMem } = await db
    .from('group_students')
    .select(`
      student_id,
      groups!group_students_group_id_fkey(
        id, name,
        group_courses!group_courses_group_id_fkey(
          courses!group_courses_course_id_fkey(id, title),
          instructors!group_courses_instructor_id_fkey(
            id,
            users!instructors_user_id_fkey(
              profiles!profiles_user_id_fkey(first_name, last_name)
            )
          )
        )
      )
    `)
    .in('student_id', studentIds)
    .eq('status', 'active')

  const gsMap = new Map<string, any>()
  for (const gs of (gsMem ?? []) as any[]) {
    if (!gsMap.has(gs.student_id)) gsMap.set(gs.student_id, gs)
  }

  // 5. Active enrollments (sessions only, no finance)
  const { data: enrolls } = await db
    .from('student_enrollments')
    .select('student_id, enrolled_sessions, consumed_sessions, remaining_sessions')
    .in('student_id', studentIds)
    .eq('status', 'ACTIVE')

  const enrollMap = new Map<string, any[]>()
  for (const e of (enrolls ?? []) as any[]) {
    const arr = enrollMap.get(e.student_id) ?? []
    arr.push(e)
    enrollMap.set(e.student_id, arr)
  }

  // 6. Attendance per student
  const { data: attRows } = await db
    .from('attendance_records')
    .select('student_id, status, session_date')
    .in('student_id', studentIds)
    .order('session_date', { ascending: false })

  const attMap = new Map<string, { total: number; attended: number; pct: number; consec: number; last_date: string | null }>()
  const grouped = new Map<string, any[]>()
  for (const r of (attRows ?? []) as any[]) {
    const arr = grouped.get(r.student_id) ?? []
    arr.push(r)
    grouped.set(r.student_id, arr)
  }
  for (const [sid, recs] of grouped) {
    const total    = recs.length
    const attended = recs.filter((r: any) => r.status === 'present').length
    const pct      = total > 0 ? Math.round((attended / total) * 100) : 0
    let consec = 0
    for (const r of recs) {
      if (r.status !== 'present') consec++
      else break
    }
    attMap.set(sid, { total, attended, pct, consec, last_date: recs[0]?.session_date ?? null })
  }

  // Build lookup maps
  const stuMap = new Map<string, any>()
  for (const s of stuRows) stuMap.set(s.id, s)

  const psMap = new Map<string, any[]>()
  for (const ps of (psLinks as any[])) {
    const arr = psMap.get(ps.parent_id) ?? []
    arr.push(ps)
    psMap.set(ps.parent_id, arr)
  }

  // 7. Assemble parent rows
  return (parents as any[]).map((p: any): ParentOperationalRow => {
    const links     = psMap.get(p.id) ?? []
    const prof      = p.users?.profiles ?? {}
    const firstName = prof.first_name ?? null
    const lastName  = prof.last_name  ?? null
    const name      = [firstName, lastName].filter(Boolean).join(' ') || p.users?.email || '—'

    const children: LinkedChild[] = (links as any[]).flatMap((link: any) => {
      const s = stuMap.get(link.student_id)
      if (!s) return []

      const sProf     = s.users?.profiles ?? {}
      const sName     = [sProf.first_name, sProf.last_name].filter(Boolean).join(' ') || '—'
      const gs        = gsMap.get(s.id)
      const groupObj  = gs?.groups ?? null
      const gcFirst   = (groupObj?.group_courses ?? [])[0] ?? null
      const courseObj = gcFirst?.courses ?? null
      const instrObj  = gcFirst?.instructors ?? null
      const instrProf = instrObj?.users?.profiles ?? null
      const instrName = instrProf
        ? [instrProf.first_name, instrProf.last_name].filter(Boolean).join(' ')
        : null

      const activeEnrolls = enrollMap.get(s.id) ?? []
      const mainEnroll    = activeEnrolls[0] ?? null
      const att           = attMap.get(s.id) ?? { total: 0, attended: 0, pct: 0, consec: 0, last_date: null }

      let risk_level: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
      if (att.consec >= 3 || (att.total >= 4 && att.pct < 50) || s.status !== 'active') {
        risk_level = 'HIGH'
      } else if (
        att.consec >= 2 ||
        (att.total >= 3 && att.pct < 70) ||
        (mainEnroll && mainEnroll.remaining_sessions <= 2 && mainEnroll.enrolled_sessions > 0)
      ) {
        risk_level = 'MEDIUM'
      }

      return [{
        student_id:          s.id,
        student_name:        sName,
        student_code:        s.student_code ?? null,
        age:                 s.age ?? null,
        branch_id:           s.branch_id,
        branch_name:         s.branches?.name ?? '',
        relationship:        link.relationship,
        is_primary:          link.is_primary,
        student_status:      s.status,
        group_id:            groupObj?.id ?? null,
        group_name:          groupObj?.name ?? null,
        course_id:           courseObj?.id ?? null,
        course_name:         courseObj?.title ?? null,
        instructor_id:       instrObj?.id ?? null,
        instructor_name:     instrName,
        enrolled_sessions:   mainEnroll?.enrolled_sessions  ?? 0,
        consumed_sessions:   mainEnroll?.consumed_sessions  ?? 0,
        remaining_sessions:  mainEnroll?.remaining_sessions ?? 0,
        attendance_pct:       att.pct,
        sessions_attended:    att.attended,
        total_sessions:       att.total,
        consecutive_absences: att.consec,
        last_attendance_date: att.last_date,
        risk_level,
      }]
    })

    const activeContracts         = children.filter(c => c.enrolled_sessions > 0)
    const totalSessionsRemaining  = children.reduce((s, c) => s + c.remaining_sessions, 0)
    const attRiskChildren         = children.filter(c => c.risk_level === 'HIGH').length
    const nearExhaustionChildren  = children.filter(c => c.remaining_sessions <= 2 && c.enrolled_sessions > 0).length
    const lastAttDate             = children.reduce<string | null>((best, c) => {
      if (!c.last_attendance_date) return best
      if (!best) return c.last_attendance_date
      return c.last_attendance_date > best ? c.last_attendance_date : best
    }, null)

    let op_health: ParentOpHealth = 'HEALTHY'
    if (!children.length) {
      op_health = 'NO_CHILDREN'
    } else if (children.every(c => c.student_status !== 'active')) {
      op_health = 'INACTIVE'
    } else if (attRiskChildren > 0) {
      op_health = 'AT_RISK'
    } else if (nearExhaustionChildren > 0) {
      op_health = 'NEEDS_ATTENTION'
    }

    return {
      parent_id:    p.id,
      user_id:      p.user_id,
      parent_name:  name,
      first_name:   firstName,
      last_name:    lastName,
      email:        p.users?.email ?? '',
      phone:        p.users?.phone ?? null,
      children,
      children_count:                 children.length,
      op_health,
      active_contracts_count:         activeContracts.length,
      total_sessions_remaining:       totalSessionsRemaining,
      attendance_risk_children_count: attRiskChildren,
      near_exhaustion_children_count: nearExhaustionChildren,
      last_attendance_at:             lastAttDate,
      branch_ids:     [...new Set(children.map(c => c.branch_id))],
      course_ids:     [...new Set(children.map(c => c.course_id).filter((x): x is string => x !== null))],
      group_ids:      [...new Set(children.map(c => c.group_id).filter((x): x is string => x !== null))],
      instructor_ids: [...new Set(children.map(c => c.instructor_id).filter((x): x is string => x !== null))],
    }
  })
}

// ── Student picker for form modal ──────────────────────────────────────────────

export async function getStudentPickerOptions(branchIds: string[]): Promise<StudentPickerOption[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  const { data: students } = await db
    .from('students')
    .select(`
      id, student_code, age,
      users!students_user_id_fkey(
        phone,
        profiles!profiles_user_id_fkey(first_name, last_name)
      ),
      branches!students_branch_id_fkey(name)
    `)
    .in('branch_id', branchIds)
    .eq('status', 'active')
    .is('deleted_at', null)
    .limit(500)

  const stuRows = (students ?? []) as any[]
  if (!stuRows.length) return []

  const studentIds = stuRows.map((s: any) => s.id as string)
  const { data: gsMem } = await db
    .from('group_students')
    .select('student_id, groups!group_students_group_id_fkey(name)')
    .in('student_id', studentIds)
    .eq('status', 'active')

  const groupMap = new Map<string, string>()
  for (const gs of (gsMem ?? []) as any[]) {
    groupMap.set(gs.student_id, gs.groups?.name ?? '')
  }

  return stuRows.map((s: any): StudentPickerOption => {
    const prof = s.users?.profiles ?? {}
    const name = [prof.first_name, prof.last_name].filter(Boolean).join(' ') || '—'
    return {
      student_id:   s.id,
      student_name: name,
      student_code: s.student_code ?? null,
      branch_name:  s.branches?.name ?? '',
      group_name:   groupMap.get(s.id) ?? null,
      age:          s.age ?? null,
      phone:        s.users?.phone ?? null,
    }
  })
}

// ── Branch lookup ──────────────────────────────────────────────────────────────

export async function getParentBranches(branchIds: string[]): Promise<{ id: string; name: string }[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()
  const { data } = await db.from('branches').select('id, name').in('id', branchIds).order('name')
  return (data ?? []) as { id: string; name: string }[]
}

// ── Filter options (independent queries — not derived from rows) ───────────────

export async function getParentFilterOptions(branchIds: string[]) {
  if (!branchIds.length) return { groups: [], courses: [], instructors: [] }
  const db = createServiceClient()

  const [groupRes, courseRes, instructors] = await Promise.all([
    db.from('groups').select('id, name').in('branch_id', branchIds).is('deleted_at', null).order('name'),
    db.from('courses').select('id, title').order('title'),
    getInstructorFilterOptions(branchIds),
  ])

  return {
    groups:      (groupRes.data ?? []) as { id: string; name: string }[],
    courses:     (courseRes.data ?? []).map((c: any) => ({ id: c.id as string, title: c.title as string })),
    instructors,
  }
}
