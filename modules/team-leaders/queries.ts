import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { TeamLeaderListItem, TeamLeader, TeamLeaderStatus } from './types'
import type { PaginatedResult } from '@/types/app'

// ── helpers ──────────────────────────────────────────────────────────────────

function metaStatus(metadata: Record<string, unknown> | null): TeamLeaderStatus {
  const v = (metadata ?? {})['tl_status']
  return v === 'inactive' ? 'inactive' : 'active'
}

// ── List ─────────────────────────────────────────────────────────────────────

export async function listTeamLeaders({
  page = 1,
  perPage = 20,
  search = '',
  branchId,
  status,
}: {
  page?:     number
  perPage?:  number
  search?:   string
  branchId?: string
  status?:   TeamLeaderStatus
} = {}): Promise<PaginatedResult<TeamLeaderListItem>> {
  const db   = createServiceClient()
  const from = (page - 1) * perPage
  const to   = from + perPage - 1

  // Query user_roles for all team-leader assignments
  let q = db
    .from('user_roles')
    .select(
      `id,
       user_id,
       branch_id,
       created_at,
       tl_code,
       users!user_roles_user_id_fkey(
         email,
         phone,
         metadata,
         profiles!profiles_user_id_fkey(first_name, last_name)
       ),
       branches!fk_user_roles_branch(name)`,
      { count: 'exact' }
    )
    .not('branch_id', 'is', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  // Filter to team_leader role via a sub-select on the roles table
  const { data: roleRow } = await db
    .from('roles')
    .select('id')
    .eq('name', 'team_leader')
    .single()

  if (!roleRow) return { data: [], total: 0, page, perPage, totalPages: 0 }
  q = q.eq('role_id', roleRow.id)

  if (branchId) q = q.eq('branch_id', branchId)

  const { data, count, error } = await q
  if (error) throw new Error(error.message)

  // Build branch → counts map
  const branchIds = [...new Set((data ?? []).map((r: any) => r.branch_id).filter(Boolean))]

  const [groupCounts, studentCounts] = branchIds.length > 0
    ? await Promise.all([
        db.from('groups')
          .select('branch_id')
          .in('branch_id', branchIds)
          .eq('status', 'active')
          .is('deleted_at', null),
        db.from('students')
          .select('branch_id')
          .in('branch_id', branchIds)
          .eq('status', 'active')
          .is('deleted_at', null),
      ])
    : [{ data: [] }, { data: [] }]

  const groupsByBranch  = groupCounts.data?.reduce<Record<string, number>>((acc, g: any) => {
    acc[g.branch_id] = (acc[g.branch_id] ?? 0) + 1
    return acc
  }, {}) ?? {}

  const studentsByBranch = studentCounts.data?.reduce<Record<string, number>>((acc, s: any) => {
    acc[s.branch_id] = (acc[s.branch_id] ?? 0) + 1
    return acc
  }, {}) ?? {}

  let items: TeamLeaderListItem[] = (data ?? []).map((row: any) => {
    const u    = row.users
    const prof = u?.profiles
    const s    = metaStatus(u?.metadata)
    return {
      user_role_id:    row.id,
      user_id:         row.user_id,
      branch_id:       row.branch_id,
      email:           u?.email ?? '',
      first_name:      prof?.first_name ?? null,
      last_name:       prof?.last_name  ?? null,
      branch_name:     row.branches?.name ?? '',
      status:          s,
      active_groups:   groupsByBranch[row.branch_id]  ?? 0,
      active_students: studentsByBranch[row.branch_id] ?? 0,
      tl_code:         row.tl_code ?? null,
      phone:           u?.phone ?? null,
    }
  })

  // Apply status filter client-side (metadata-based status not filterable in DB directly)
  if (status) items = items.filter((i) => i.status === status)

  // Apply search client-side
  if (search) {
    const q = search.toLowerCase()
    items = items.filter((i) =>
      `${i.first_name ?? ''} ${i.last_name ?? ''} ${i.email} ${i.branch_name}`.toLowerCase().includes(q)
    )
  }

  return {
    data:       items,
    total:      count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  }
}

// ── Single profile ────────────────────────────────────────────────────────────

export async function getTeamLeader(userId: string): Promise<TeamLeader | null> {
  const db = createServiceClient()

  // Fetch user + profile + role assignment + branch
  const { data: roleRow } = await db
    .from('roles')
    .select('id')
    .eq('name', 'team_leader')
    .single()

  if (!roleRow) return null

  const { data: ur } = await db
    .from('user_roles')
    .select(
      `id, branch_id, created_at, tl_code,
       users!user_roles_user_id_fkey(
         id, email, phone, metadata,
         profiles!profiles_user_id_fkey(first_name, last_name)
       ),
       branches!fk_user_roles_branch(name)`
    )
    .eq('user_id', userId)
    .eq('role_id', roleRow.id)
    .not('branch_id', 'is', null)
    .maybeSingle()

  // May have no current role entry (inactive TL — fetch user directly)
  const { data: userRow } = await db
    .from('users')
    .select(`id, email, phone, metadata, profiles!profiles_user_id_fkey(first_name, last_name)`)
    .eq('id', userId)
    .single()

  if (!userRow) return null

  const u    = ur ? (ur as any).users : userRow as any
  const prof = u?.profiles
  const meta = u?.metadata ?? {}
  const branchId   = (ur as any)?.branch_id ?? meta.tl_branch_id ?? null
  const branchName = (ur as any)?.branches?.name ?? null

  const tlStatus: TeamLeaderStatus = ur ? metaStatus(meta) : 'inactive'

  // Fetch branch-level data in parallel
  const [instructorsRes, groupsRes, studentsRes] = branchId
    ? await Promise.all([
        db.from('instructors')
          .select(
            `id, status,
             users!instructors_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))`
          )
          .eq('branch_id', branchId)
          .eq('status', 'active')
          .is('deleted_at', null)
          .limit(50),

        db.from('groups')
          .select('id, name, type, status')
          .eq('branch_id', branchId)
          .eq('status', 'active')
          .is('deleted_at', null)
          .limit(50),

        db.from('students')
          .select('id', { count: 'exact', head: true })
          .eq('branch_id', branchId)
          .eq('status', 'active')
          .is('deleted_at', null),
      ])
    : [{ data: [] }, { data: [] }, { count: 0 }]

  const instructors = (instructorsRes.data ?? []).map((i: any) => {
    const p = i.users?.profiles
    return {
      id:         i.id,
      first_name: p?.first_name ?? null,
      last_name:  p?.last_name  ?? null,
      email:      i.users?.email ?? '',
      status:     i.status,
    }
  })

  // For groups, count students
  const groupIds = (groupsRes.data ?? []).map((g: any) => g.id)
  const studentCountByGroup: Record<string, number> = {}
  if (groupIds.length > 0) {
    const { data: gsRows } = await db
      .from('group_students')
      .select('group_id')
      .in('group_id', groupIds)
      .eq('status', 'active')
    for (const gs of gsRows ?? []) {
      studentCountByGroup[(gs as any).group_id] = (studentCountByGroup[(gs as any).group_id] ?? 0) + 1
    }
  }

  const groups = (groupsRes.data ?? []).map((g: any) => ({
    id:            g.id,
    name:          g.name,
    type:          g.type,
    status:        g.status,
    student_count: studentCountByGroup[g.id] ?? 0,
  }))

  return {
    user_role_id:        (ur as any)?.id ?? userId,
    user_id:             userId,
    branch_id:           branchId,
    email:               u?.email ?? (userRow as any).email ?? '',
    first_name:          prof?.first_name ?? null,
    last_name:           prof?.last_name  ?? null,
    branch_name:         branchName,
    status:              tlStatus,
    assigned_at:         (ur as any)?.created_at ?? null,
    instructors,
    groups,
    student_count:       (studentsRes as any).count ?? 0,
    tl_code:             (ur as any)?.tl_code ?? null,
    phone:               u?.phone ?? null,
    payment_link:        (meta.payment_link as string) ?? null,
    wallet_number:       (meta.wallet_number as string) ?? null,
    bank_account_number: (meta.bank_account_number as string) ?? null,
  }
}
