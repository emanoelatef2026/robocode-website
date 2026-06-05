import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentUser }      from '@/modules/rbac/guards'

// ── Sprint 50.1 + 51: Shared query helpers for dropdowns and operational lists.
// ALL dropdowns must use these helpers to ensure consistent filtering.
// ──────────────────────────────────────────────────────────────────────────────

// ── Accessible branches for the current user ──────────────────────────────────

export async function getAccessibleBranches(): Promise<{ id: string; name: string }[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const db = createServiceClient()

  let q = db
    .from('branches')
    .select('id, name')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')

  if (user.globalRole !== 'super_admin' && user.branchIds.length) {
    q = (q as any).in('id', user.branchIds)
  }

  const { data } = await q
  return ((data ?? []) as any[]).map(b => ({ id: b.id as string, name: b.name as string }))
}

// ── All active courses (global — not branch-scoped) ───────────────────────────

export async function getActiveCourses(): Promise<{
  id: string; title: string; level: string | null; course_type: string | null
}[]> {
  const db = createServiceClient()
  const { data } = await db
    .from('courses')
    .select('id, title, level, course_type')
    .is('deleted_at', null)
    .order('title')
    .limit(300)

  return ((data ?? []) as any[]).map(c => ({
    id:          c.id,
    title:       c.title,
    level:       c.level ?? null,
    course_type: c.course_type ?? null,
  }))
}

// ── Operational groups for given branches ─────────────────────────────────────
// Returns ALL active non-deleted groups. NO enrollment requirement.

export async function getOperationalGroups(branchIds: string[]): Promise<{
  id: string; name: string; type: string | null
  course_id: string | null; course_title: string | null
  instructor_id: string | null; instructor_name: string | null
  capacity: number | null; branch_id: string
}[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  const { data } = await db
    .from('groups')
    .select(`
      id, name, type, capacity, branch_id,
      group_courses!group_courses_group_id_fkey(
        id, instructor_id,
        courses!group_courses_course_id_fkey(id, title),
        instructors!group_courses_instructor_id_fkey(
          id,
          users!instructors_user_id_fkey(
            profiles!profiles_user_id_fkey(first_name, last_name)
          )
        )
      )
    `)
    .in('branch_id', branchIds)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name')
    .limit(200)

  return ((data ?? []) as any[]).map(g => {
    const activeGc   = Array.isArray(g.group_courses) ? g.group_courses[0] : null
    const instrProf  = activeGc?.instructors?.users?.profiles
    const instrName  = instrProf
      ? [instrProf.first_name, instrProf.last_name].filter(Boolean).join(' ') || null
      : null

    return {
      id:             g.id,
      name:           g.name,
      type:           g.type ?? null,
      capacity:       g.capacity ?? null,
      branch_id:      g.branch_id,
      course_id:      activeGc?.courses?.id ?? null,
      course_title:   activeGc?.courses?.title ?? null,
      instructor_id:  activeGc?.instructor_id ?? null,
      instructor_name: instrName,
    }
  })
}

// ── Operational students for given branches ───────────────────────────────────
// Returns ALL active students regardless of enrollment status.
// Sprint 50.1: ensures new students always appear in search/listing.

export async function getOperationalStudents(branchIds: string[]): Promise<{
  id: string; student_code: string | null; branch_id: string; name: string
  email: string; phone: string | null
  parent_name: string | null; parent_phone: string | null
}[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  const { data } = await db
    .from('students')
    .select(`
      id, student_code, branch_id, emergency_contact,
      users!students_user_id_fkey(
        email, phone,
        profiles!profiles_user_id_fkey(first_name, last_name)
      )
    `)
    .in('branch_id', branchIds)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1000)

  return ((data ?? []) as any[]).map(s => {
    const u  = s.users    ?? {}
    const p  = u.profiles ?? {}
    const ec = (s.emergency_contact ?? {}) as Record<string, string>
    return {
      id:           s.id,
      student_code: s.student_code ?? null,
      branch_id:    s.branch_id,
      name:         [p.first_name, p.last_name].filter(Boolean).join(' ') || u.email || 'Unknown',
      email:        u.email ?? '',
      phone:        u.phone ?? null,
      parent_name:  ec.name   ?? null,
      parent_phone: ec.phone1 ?? null,
    }
  })
}

// ── Active instructors for given branches ─────────────────────────────────────

export async function getAccessibleInstructors(branchIds: string[]): Promise<{
  id: string; name: string; branch_id: string | null
}[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  const { data } = await db
    .from('instructors')
    .select(`
      id, branch_id,
      users!instructors_user_id_fkey(
        profiles!profiles_user_id_fkey(first_name, last_name)
      )
    `)
    .in('branch_id', branchIds)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('created_at')
    .limit(200)

  return ((data ?? []) as any[]).map(i => {
    const p = i.users?.profiles ?? {}
    return {
      id:        i.id,
      branch_id: i.branch_id,
      name:      [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
    }
  })
}
