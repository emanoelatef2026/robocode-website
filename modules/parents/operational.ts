import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstructorFilterOptions } from '@/modules/query-standards'

// ── Internal raw-query types ───────────────────────────────────────────────────
// These map directly to Supabase PostgREST response shapes.
// Using explicit types here eliminates `as any[]` from critical loops.

interface RawStudentRow {
  id:           string
  user_id:      string
  branch_id:    string
  student_code: string | null
  status:       string
  age:          number | null
  deleted_at:   string | null
  users:        { phone: string | null; profiles: { first_name: string | null; last_name: string | null } | null } | null
  branches:     { name: string } | null
}

interface RawPsLink {
  parent_id:    string
  student_id:   string
  relationship: string
  is_primary:   boolean
}

interface RawParentRow {
  id:      string
  user_id: string
  users:   { email: string; phone: string | null; profiles: { first_name: string | null; last_name: string | null } | null } | null
}

// ── Public types ───────────────────────────────────────────────────────────────

/**
 * Family health status. Priority (high → low):
 *   NO_CHILDREN → ARCHIVED → GRADUATED → INACTIVE → AT_RISK → NEEDS_ATTENTION → NO_ENROLLMENTS → HEALTHY
 */
export type ParentOpHealth =
  | 'HEALTHY'          // ≥1 active child with active enrollment
  | 'AT_RISK'          // ≥1 child with consecutive absences or poor attendance
  | 'NEEDS_ATTENTION'  // ≥1 active child near session exhaustion (≤2 remaining)
  | 'NO_ENROLLMENTS'   // active children exist but none have an active enrollment
  | 'GRADUATED'        // all non-archived children are graduated
  | 'INACTIVE'         // all non-archived children are inactive/paused/banned
  | 'ARCHIVED'         // all children are soft-deleted (parent is historical)
  | 'NO_CHILDREN'      // parent has zero student links in DB

export interface LinkedChild {
  contact_id:          string | null  // student_parent_contacts.id — used by edit form to remove this link
  student_id:          string
  student_name:        string
  student_code:        string | null
  age:                 number | null
  branch_id:           string
  branch_name:         string
  relationship:        string
  is_primary:          boolean
  student_status:      string
  is_archived:         boolean   // student.deleted_at IS NOT NULL
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
  // Attendance (last 180 days)
  attendance_pct:        number
  sessions_attended:     number
  total_sessions:        number
  consecutive_absences:  number
  last_attendance_date:  string | null
  // Risk
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface ParentOperationalRow {
  parent_id:       string   // equals parent_group_id for contact-based parents
  parent_group_id: string   // stable UUID grouping all contacts for this parent
  user_id:         string   // empty string if no portal account
  parent_name:     string
  first_name:      string | null
  last_name:       string | null
  email:           string   // empty string if no portal account
  phone:           string | null   // phone1
  phone2:          string | null
  relation:        string
  whatsapp_preferred: boolean
  notes:           string | null
  // Children — includes soft-deleted students (is_archived=true)
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
  status:       string
  branch_name:  string
  group_name:   string | null
  age:          number | null
  phone:        string | null
}

// ── Scope helper ───────────────────────────────────────────────────────────────

interface ParentScope {
  stuRows:    RawStudentRow[]
  studentIds: string[]
  psLinkRows: RawPsLink[]
  parentIds:  string[]
}

/**
 * Resolves the three-step parent scope for a given branch set.
 *
 * Step 1 intentionally includes soft-deleted students so a parent whose only
 * child has been archived does NOT disappear from the TL's view. Branch scope
 * is enforced via branch_id IN branchIds — students outside the TL's branches
 * are never returned.
 *
 * Returns null when there are genuinely no parents in scope (not an error).
 * Throws for unexpected DB errors so callers can distinguish the two cases.
 */
export async function resolveParentScope(
  db: ReturnType<typeof createServiceClient>,
  branchIds: string[]
): Promise<ParentScope | null> {
  // Step 1: All students in branch (including soft-deleted for historical visibility)
  const { data: stuData, error: stuErr } = await db
    .from('students')
    .select(`
      id, user_id, branch_id, student_code, status, age, deleted_at,
      users!students_user_id_fkey(
        phone,
        profiles!profiles_user_id_fkey(first_name, last_name)
      ),
      branches!students_branch_id_fkey(name)
    `)
    .in('branch_id', branchIds)

  if (stuErr) {
    console.error('[resolveParentScope] students error:', stuErr.message, stuErr.details, stuErr.hint)
    throw new Error(`DB error in resolveParentScope (students): ${stuErr.message}`)
  }

  const stuRows = (stuData ?? []) as unknown as RawStudentRow[]
  if (!stuRows.length) return null

  const studentIds = stuRows.map(s => s.id)

  // Step 2: Parent-student links for the resolved student set
  const { data: psData, error: psErr } = await db
    .from('parent_students')
    .select('parent_id, student_id, relationship, is_primary')
    .in('student_id', studentIds)

  if (psErr) {
    console.error('[resolveParentScope] parent_students error:', psErr.message, psErr.details)
    throw new Error(`DB error in resolveParentScope (parent_students): ${psErr.message}`)
  }

  const psLinkRows = (psData ?? []) as RawPsLink[]
  if (!psLinkRows.length) return null

  const parentIds = [...new Set(psLinkRows.map(ps => ps.parent_id))]

  return { stuRows, studentIds, psLinkRows, parentIds }
}

// ── Main operational query ─────────────────────────────────────────────────────

export async function listParentsOperational(
  branchIds: string[]
): Promise<ParentOperationalRow[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  // 1–2. Resolve scope (students + parent links in branch)
  let scope: ParentScope | null
  try {
    scope = await resolveParentScope(db, branchIds)
  } catch (err) {
    console.error('[listParentsOperational] scope resolution failed:', err)
    return []
  }
  if (!scope) return []

  const { stuRows, studentIds, psLinkRows, parentIds } = scope

  // 3. Parent records with user + profile — exclude soft-deleted parents
  const { data: parData, error: parErr } = await db
    .from('parents')
    .select(`
      id, user_id,
      users!parents_user_id_fkey(
        email, phone,
        profiles!profiles_user_id_fkey(first_name, last_name)
      )
    `)
    .in('id', parentIds)
    .is('deleted_at', null)

  if (parErr) {
    console.error('[listParentsOperational] parents error:', parErr.message, parErr.details)
    return []
  }
  const parents = (parData ?? []) as unknown as RawParentRow[]
  if (!parents.length) return []

  // 4. Group memberships for active group enrollments
  const { data: gsData, error: gsErr } = await db
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

  if (gsErr) {
    console.error('[listParentsOperational] group_students error:', gsErr.message, '— proceeding without group data')
  }

  // Keep only the first active group per student
  const gsMap = new Map<string, any>()
  for (const gs of (gsData ?? []) as any[]) {
    if (!gsMap.has(gs.student_id)) gsMap.set(gs.student_id, gs)
  }

  // 5. Active enrollments (sessions contract data)
  const { data: enrollData, error: enrollErr } = await db
    .from('student_enrollments')
    .select('student_id, enrolled_sessions, consumed_sessions, remaining_sessions')
    .in('student_id', studentIds)
    .eq('status', 'ACTIVE')

  if (enrollErr) {
    console.error('[listParentsOperational] enrollments error:', enrollErr.message, '— proceeding without enrollment data')
  }

  const enrollMap = new Map<string, { enrolled_sessions: number; consumed_sessions: number; remaining_sessions: number }[]>()
  for (const e of (enrollData ?? []) as any[]) {
    const arr = enrollMap.get(e.student_id) ?? []
    arr.push({ enrolled_sessions: e.enrolled_sessions, consumed_sessions: e.consumed_sessions, remaining_sessions: e.remaining_sessions })
    enrollMap.set(e.student_id, arr)
  }

  // 6. Attendance — capped at 180 days to prevent unbounded scans
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 180)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const { data: attData, error: attErr } = await db
    .from('attendance_records')
    .select('student_id, status, session_date')
    .in('student_id', studentIds)
    .gte('session_date', cutoffStr)
    .order('session_date', { ascending: false })

  if (attErr) {
    console.error('[listParentsOperational] attendance error:', attErr.message, '— proceeding without attendance data')
  }

  interface AttStats { total: number; attended: number; pct: number; consec: number; last_date: string | null }
  const attMap = new Map<string, AttStats>()
  const attGrouped = new Map<string, { status: string; session_date: string }[]>()
  for (const r of (attData ?? []) as { student_id: string; status: string; session_date: string }[]) {
    const arr = attGrouped.get(r.student_id) ?? []
    arr.push(r)
    attGrouped.set(r.student_id, arr)
  }
  for (const [sid, recs] of attGrouped) {
    const total    = recs.length
    const attended = recs.filter(r => r.status === 'present').length
    const pct      = total > 0 ? Math.round((attended / total) * 100) : 0
    let consec = 0
    for (const r of recs) {
      if (r.status !== 'present') consec++
      else break
    }
    attMap.set(sid, { total, attended, pct, consec, last_date: recs[0]?.session_date ?? null })
  }

  // Build lookup maps
  const stuMap = new Map<string, RawStudentRow>()
  for (const s of stuRows) stuMap.set(s.id, s)

  const psMap = new Map<string, RawPsLink[]>()
  for (const ps of psLinkRows) {
    const arr = psMap.get(ps.parent_id) ?? []
    arr.push(ps)
    psMap.set(ps.parent_id, arr)
  }

  // 7. Assemble parent rows
  return parents.map((p): ParentOperationalRow => {
    const links     = psMap.get(p.id) ?? []
    const prof      = p.users?.profiles ?? null
    const firstName = prof?.first_name ?? null
    const lastName  = prof?.last_name  ?? null
    const name      = [firstName, lastName].filter(Boolean).join(' ') || p.users?.email || '—'

    const children: LinkedChild[] = links.flatMap((link): LinkedChild[] => {
      const s = stuMap.get(link.student_id)
      if (!s) return []   // student outside TL's branch scope — skip

      const sProf      = s.users?.profiles ?? null
      const sName      = [sProf?.first_name, sProf?.last_name].filter(Boolean).join(' ') || '—'
      const isArchived = s.deleted_at !== null

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
      if (!isArchived) {
        if (att.consec >= 3 || (att.total >= 4 && att.pct < 50) || s.status !== 'active') {
          risk_level = 'HIGH'
        } else if (
          att.consec >= 2 ||
          (att.total >= 3 && att.pct < 70) ||
          (mainEnroll && mainEnroll.remaining_sessions <= 2 && mainEnroll.enrolled_sessions > 0)
        ) {
          risk_level = 'MEDIUM'
        }
      }

      return [{
        contact_id:          null,
        student_id:          s.id,
        student_name:        sName,
        student_code:        s.student_code ?? null,
        age:                 s.age ?? null,
        branch_id:           s.branch_id,
        branch_name:         s.branches?.name ?? '',
        relationship:        link.relationship,
        is_primary:          link.is_primary,
        student_status:      s.status,
        is_archived:         isArchived,
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

    // ── Aggregates ────────────────────────────────────────────────────────────

    // Visible children = non-archived; these drive the health state
    const visibleChildren   = children.filter(c => !c.is_archived)
    const activeChildren    = visibleChildren.filter(c => c.student_status === 'active')
    const graduatedChildren = visibleChildren.filter(c => c.student_status === 'graduated')

    const activeContracts          = activeChildren.filter(c => c.enrolled_sessions > 0)
    // Only count sessions for active (non-archived, status='active') children — archived/graduated
    // students' remaining sessions are not actionable and must not be included in this total.
    const totalSessionsRemaining   = activeChildren.reduce((s, c) => s + c.remaining_sessions, 0)
    const attRiskChildren          = visibleChildren.filter(c => c.risk_level === 'HIGH').length
    const nearExhaustionChildren   = activeChildren.filter(c => c.remaining_sessions <= 2 && c.enrolled_sessions > 0).length
    const lastAttDate              = children.reduce<string | null>((best, c) => {
      if (!c.last_attendance_date) return best
      if (!best) return c.last_attendance_date
      return c.last_attendance_date > best ? c.last_attendance_date : best
    }, null)

    // ── Health state — priority order ─────────────────────────────────────────
    let op_health: ParentOpHealth
    if (children.length === 0) {
      op_health = 'NO_CHILDREN'
    } else if (visibleChildren.length === 0) {
      // All linked students are archived
      op_health = 'ARCHIVED'
    } else if (graduatedChildren.length === visibleChildren.length) {
      op_health = 'GRADUATED'
    } else if (activeChildren.length === 0) {
      // All non-archived children are inactive/paused/banned
      op_health = 'INACTIVE'
    } else if (attRiskChildren > 0) {
      op_health = 'AT_RISK'
    } else if (nearExhaustionChildren > 0) {
      op_health = 'NEEDS_ATTENTION'
    } else if (activeContracts.length === 0) {
      // Has active children but no active enrollment contract
      op_health = 'NO_ENROLLMENTS'
    } else {
      op_health = 'HEALTHY'
    }

    return {
      parent_id:       p.id,
      parent_group_id: p.id,
      user_id:         p.user_id,
      parent_name:     name,
      first_name:      firstName,
      last_name:       lastName,
      email:           p.users?.email ?? '',
      phone:           p.users?.phone ?? null,
      phone2:          null,
      relation:        'guardian',
      whatsapp_preferred: false,
      notes:           null,
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
// Branch scope is always enforced via .in('branch_id', branchIds).
// Soft-deleted students are excluded (you cannot link to a deleted student),
// but all active statuses (inactive, graduated, paused, banned) are returned
// so a TL can link a parent to any current or historical non-deleted student.

export async function getStudentPickerOptions(branchIds: string[]): Promise<StudentPickerOption[]> {
  if (!branchIds.length) {
    console.warn('[getStudentPickerOptions] called with empty branchIds — TL has no branch assigned')
    return []
  }
  console.log('[getStudentPickerOptions] querying', branchIds.length, 'branch(es):', branchIds)
  const db = createServiceClient()

  const { data: stuData, error: stuErr } = await db
    .from('students')
    .select(`
      id, student_code, age, status,
      users!students_user_id_fkey(
        phone,
        profiles!profiles_user_id_fkey(first_name, last_name)
      ),
      branches!students_branch_id_fkey(name)
    `)
    .in('branch_id', branchIds)
    .is('deleted_at', null)   // Picker only shows non-deleted students (can't link to archived)
    .limit(500)

  if (stuErr) {
    console.error('[getStudentPickerOptions] DB error:', stuErr.message, '| details:', stuErr.details, '| hint:', stuErr.hint)
    return []
  }

  const stuRows = (stuData ?? []) as unknown as RawStudentRow[]
  console.log('[getStudentPickerOptions] query returned', stuRows.length, 'student(s)')

  if (!stuRows.length) {
    console.warn('[getStudentPickerOptions] 0 students found — check that branch_id values are correct and students exist with deleted_at IS NULL')
    return []
  }

  const studentIds = stuRows.map(s => s.id)
  const { data: gsData } = await db
    .from('group_students')
    .select('student_id, groups!group_students_group_id_fkey(name)')
    .in('student_id', studentIds)
    .eq('status', 'active')

  const groupMap = new Map<string, string>()
  for (const gs of (gsData ?? []) as any[]) {
    groupMap.set(gs.student_id, gs.groups?.name ?? '')
  }

  const result = stuRows.map((s): StudentPickerOption => {
    const prof = s.users?.profiles ?? null
    const name = [prof?.first_name, prof?.last_name].filter(Boolean).join(' ') || '—'
    return {
      student_id:   s.id,
      student_name: name,
      student_code: s.student_code ?? null,
      status:       s.status ?? 'active',
      branch_name:  s.branches?.name ?? '',
      group_name:   groupMap.get(s.id) ?? null,
      age:          s.age ?? null,
      phone:        s.users?.phone ?? null,
    }
  })

  const unnamed = result.filter(r => r.student_name === '—').length
  if (unnamed > 0) {
    console.warn('[getStudentPickerOptions]', unnamed, 'student(s) have missing profile data (name shown as —) — profile join may be failing')
  }

  return result
}

// ── Contact-based parent source ────────────────────────────────────────────────
// Reads from student_parent_contacts (auto-populated via student enrollment form).
// Groups contacts by normalized phone1 so a parent with multiple children appears
// as one row. Only includes students that are NOT soft-deleted.
//
// This is the canonical query for the TL Parents page. The legacy
// listParentsOperational() (portal accounts) is kept for reference but the page
// no longer calls it.

interface RawContactRow {
  id:                 string
  student_id:         string
  parent_group_id:    string
  name:               string
  relation:           string
  phone1:             string | null
  phone2:             string | null
  whatsapp_preferred: boolean
  is_primary:         boolean
  is_emergency:       boolean
  notes:              string | null
  status:             string
}

function normalizePhoneKey(phone: string | null | undefined): string | null {
  if (!phone) return null
  const s = phone.replace(/[\s\-\(\)\+]/g, '')
  if (s.startsWith('20') && s.length >= 12) return '0' + s.slice(2)
  if (s.startsWith('002'))                  return '0' + s.slice(3)
  return s.length >= 7 ? s : null
}

export async function listParentContactsOperational(
  branchIds: string[]
): Promise<ParentOperationalRow[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  // 1. Active (non-archived) students in branch only
  const { data: stuData, error: stuErr } = await db
    .from('students')
    .select(`
      id, user_id, branch_id, student_code, status, age, deleted_at,
      users!students_user_id_fkey(
        phone,
        profiles!profiles_user_id_fkey(first_name, last_name)
      ),
      branches!students_branch_id_fkey(name)
    `)
    .in('branch_id', branchIds)
    .is('deleted_at', null)

  if (stuErr) {
    console.error('[listParentContactsOperational] students error:', stuErr.message)
    return []
  }

  const stuRows = (stuData ?? []) as unknown as RawStudentRow[]
  if (!stuRows.length) return []

  const studentIds = stuRows.map(s => s.id)

  // 2. Parent contacts for those students (active only)
  const { data: contactData, error: contactErr } = await db
    .from('student_parent_contacts')
    .select('id, student_id, parent_group_id, name, relation, phone1, phone2, whatsapp_preferred, is_primary, is_emergency, notes, status')
    .in('student_id', studentIds)
    .eq('status', 'active')

  if (contactErr) {
    console.error('[listParentContactsOperational] contacts error:', contactErr.message)
    return []
  }

  const contacts = (contactData ?? []) as RawContactRow[]
  if (!contacts.length) return []

  // 3. Group contacts by parent_group_id (stable UUID per parent entity)
  const groups = new Map<string, RawContactRow[]>()
  for (const c of contacts) {
    const key = c.parent_group_id
    const arr = groups.get(key) ?? []
    arr.push(c)
    groups.set(key, arr)
  }

  // 4. Group memberships for active students
  const { data: gsData, error: gsErr } = await db
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

  if (gsErr) {
    console.error('[listParentContactsOperational] group_students error:', gsErr.message, '— proceeding without group data')
  }

  const gsMap = new Map<string, any>()
  for (const gs of (gsData ?? []) as any[]) {
    if (!gsMap.has(gs.student_id)) gsMap.set(gs.student_id, gs)
  }

  // 5. Active enrollments
  const { data: enrollData, error: enrollErr } = await db
    .from('student_enrollments')
    .select('student_id, enrolled_sessions, consumed_sessions, remaining_sessions')
    .in('student_id', studentIds)
    .eq('status', 'ACTIVE')

  if (enrollErr) {
    console.error('[listParentContactsOperational] enrollments error:', enrollErr.message, '— proceeding without enrollment data')
  }

  const enrollMap = new Map<string, { enrolled_sessions: number; consumed_sessions: number; remaining_sessions: number }[]>()
  for (const e of (enrollData ?? []) as any[]) {
    const arr = enrollMap.get(e.student_id) ?? []
    arr.push({ enrolled_sessions: e.enrolled_sessions, consumed_sessions: e.consumed_sessions, remaining_sessions: e.remaining_sessions })
    enrollMap.set(e.student_id, arr)
  }

  // 6. Attendance — capped at 180 days
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 180)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const { data: attData, error: attErr } = await db
    .from('attendance_records')
    .select('student_id, status, session_date')
    .in('student_id', studentIds)
    .gte('session_date', cutoffStr)
    .order('session_date', { ascending: false })

  if (attErr) {
    console.error('[listParentContactsOperational] attendance error:', attErr.message, '— proceeding without attendance data')
  }

  interface AttStats { total: number; attended: number; pct: number; consec: number; last_date: string | null }
  const attMap = new Map<string, AttStats>()
  const attGrouped = new Map<string, { status: string; session_date: string }[]>()
  for (const r of (attData ?? []) as { student_id: string; status: string; session_date: string }[]) {
    const arr = attGrouped.get(r.student_id) ?? []
    arr.push(r)
    attGrouped.set(r.student_id, arr)
  }
  for (const [sid, recs] of attGrouped) {
    const total    = recs.length
    const attended = recs.filter(r => r.status === 'present').length
    const pct      = total > 0 ? Math.round((attended / total) * 100) : 0
    let consec = 0
    for (const r of recs) {
      if (r.status !== 'present') consec++
      else break
    }
    attMap.set(sid, { total, attended, pct, consec, last_date: recs[0]?.session_date ?? null })
  }

  // Build student lookup map
  const stuMap = new Map<string, RawStudentRow>()
  for (const s of stuRows) stuMap.set(s.id, s)

  // 7. Assemble parent rows from contact groups
  return [...groups.entries()].map(([key, groupContacts]): ParentOperationalRow => {
    const primary   = groupContacts[0]
    const childSids = [...new Set(groupContacts.map(c => c.student_id))]

    const children: LinkedChild[] = childSids.flatMap((sid): LinkedChild[] => {
      const s = stuMap.get(sid)
      if (!s) return []

      const sProf      = s.users?.profiles ?? null
      const sName      = [sProf?.first_name, sProf?.last_name].filter(Boolean).join(' ') || '—'
      const isArchived = s.deleted_at !== null  // always false here (filtered to deleted_at IS NULL)

      const gs        = gsMap.get(sid)
      const groupObj  = gs?.groups ?? null
      const gcFirst   = (groupObj?.group_courses ?? [])[0] ?? null
      const courseObj = gcFirst?.courses ?? null
      const instrObj  = gcFirst?.instructors ?? null
      const instrProf = instrObj?.users?.profiles ?? null
      const instrName = instrProf
        ? [instrProf.first_name, instrProf.last_name].filter(Boolean).join(' ')
        : null

      const activeEnrolls = enrollMap.get(sid) ?? []
      const mainEnroll    = activeEnrolls[0] ?? null
      const att           = attMap.get(sid) ?? { total: 0, attended: 0, pct: 0, consec: 0, last_date: null }

      let risk_level: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
      if (!isArchived) {
        if (att.consec >= 3 || (att.total >= 4 && att.pct < 50) || s.status !== 'active') {
          risk_level = 'HIGH'
        } else if (
          att.consec >= 2 ||
          (att.total >= 3 && att.pct < 70) ||
          (mainEnroll && mainEnroll.remaining_sessions <= 2 && mainEnroll.enrolled_sessions > 0)
        ) {
          risk_level = 'MEDIUM'
        }
      }

      const contactForSid = groupContacts.find(c => c.student_id === sid)

      return [{
        contact_id:           contactForSid?.id ?? null,
        student_id:           s.id,
        student_name:         sName,
        student_code:         s.student_code ?? null,
        age:                  s.age ?? null,
        branch_id:            s.branch_id,
        branch_name:          s.branches?.name ?? '',
        relationship:         contactForSid?.relation ?? primary.relation,
        is_primary:           contactForSid?.is_primary ?? true,
        student_status:       s.status,
        is_archived:          isArchived,
        group_id:             groupObj?.id ?? null,
        group_name:           groupObj?.name ?? null,
        course_id:            courseObj?.id ?? null,
        course_name:          courseObj?.title ?? null,
        instructor_id:        instrObj?.id ?? null,
        instructor_name:      instrName,
        enrolled_sessions:    mainEnroll?.enrolled_sessions  ?? 0,
        consumed_sessions:    mainEnroll?.consumed_sessions  ?? 0,
        remaining_sessions:   mainEnroll?.remaining_sessions ?? 0,
        attendance_pct:        att.pct,
        sessions_attended:     att.attended,
        total_sessions:        att.total,
        consecutive_absences:  att.consec,
        last_attendance_date:  att.last_date,
        risk_level,
      }]
    })

    // ── Aggregates ──────────────────────────────────────────────────────────────
    const visibleChildren   = children.filter(c => !c.is_archived)
    const activeChildren    = visibleChildren.filter(c => c.student_status === 'active')
    const graduatedChildren = visibleChildren.filter(c => c.student_status === 'graduated')

    const activeContracts        = activeChildren.filter(c => c.enrolled_sessions > 0)
    const totalSessionsRemaining = activeChildren.reduce((s, c) => s + c.remaining_sessions, 0)
    const attRiskChildren        = visibleChildren.filter(c => c.risk_level === 'HIGH').length
    const nearExhaustionChildren = activeChildren.filter(c => c.remaining_sessions <= 2 && c.enrolled_sessions > 0).length
    const lastAttDate            = children.reduce<string | null>((best, c) => {
      if (!c.last_attendance_date) return best
      if (!best) return c.last_attendance_date
      return c.last_attendance_date > best ? c.last_attendance_date : best
    }, null)

    let op_health: ParentOpHealth
    if (children.length === 0) {
      op_health = 'NO_CHILDREN'
    } else if (visibleChildren.length === 0) {
      op_health = 'ARCHIVED'
    } else if (graduatedChildren.length === visibleChildren.length) {
      op_health = 'GRADUATED'
    } else if (activeChildren.length === 0) {
      op_health = 'INACTIVE'
    } else if (attRiskChildren > 0) {
      op_health = 'AT_RISK'
    } else if (nearExhaustionChildren > 0) {
      op_health = 'NEEDS_ATTENTION'
    } else if (activeContracts.length === 0) {
      op_health = 'NO_ENROLLMENTS'
    } else {
      op_health = 'HEALTHY'
    }

    return {
      parent_id:       key,      // stable parent_group_id
      parent_group_id: key,
      user_id:         '',
      parent_name:     primary.name,
      first_name:      null,
      last_name:       null,
      email:           '',
      phone:           primary.phone1 ?? null,
      phone2:          primary.phone2 ?? null,
      relation:        primary.relation,
      whatsapp_preferred: primary.whatsapp_preferred,
      notes:           primary.notes ?? null,
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
