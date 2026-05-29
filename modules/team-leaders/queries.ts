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
// Returns one row per user_roles entry (one per branch assignment).
// A multi-branch TL appears once per branch.

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

  if (status) items = items.filter((i) => i.status === status)

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
// Returns all branch assignments for the TL and aggregates data across them.

export async function getTeamLeader(userId: string): Promise<TeamLeader | null> {
  const db = createServiceClient()

  const { data: roleRow } = await db
    .from('roles')
    .select('id')
    .eq('name', 'team_leader')
    .single()

  if (!roleRow) return null

  // Fetch ALL branch assignments for this TL (multi-branch support)
  const { data: urRows } = await db
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
    .order('created_at', { ascending: true })

  // Fetch user directly for inactive TLs who have no user_roles rows
  const { data: userRow } = await db
    .from('users')
    .select(`id, email, phone, metadata, profiles!profiles_user_id_fkey(first_name, last_name)`)
    .eq('id', userId)
    .single()

  if (!userRow) return null

  const firstUr  = (urRows ?? [])[0]
  const u        = firstUr ? (firstUr as any).users : userRow as any
  const prof     = u?.profiles
  const meta     = (u?.metadata ?? {}) as Record<string, unknown>

  const branchIds   = (urRows ?? []).map((r: any) => r.branch_id as string).filter(Boolean)
  const branchNames = (urRows ?? []).map((r: any) => (r.branches?.name ?? '') as string)

  const tlStatus: TeamLeaderStatus = (urRows ?? []).length > 0 ? metaStatus(meta) : 'inactive'

  // Aggregate data across all branches
  const [instructorsRes, groupsRes, studentsRes] = branchIds.length > 0
    ? await Promise.all([
        db.from('instructors')
          .select(
            `id, status,
             users!instructors_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))`
          )
          .in('branch_id', branchIds)
          .eq('status', 'active')
          .is('deleted_at', null)
          .limit(50),

        db.from('groups')
          .select('id, name, type, status')
          .in('branch_id', branchIds)
          .eq('status', 'active')
          .is('deleted_at', null)
          .limit(50),

        db.from('students')
          .select('id', { count: 'exact', head: true })
          .in('branch_id', branchIds)
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
    user_role_id:        (firstUr as any)?.id ?? userId,
    user_id:             userId,
    branch_ids:          branchIds,
    branch_names:        branchNames,
    branch_id:           branchIds[0] ?? null,
    branch_name:         branchNames[0] ?? null,
    email:               u?.email ?? (userRow as any).email ?? '',
    first_name:          prof?.first_name ?? null,
    last_name:           prof?.last_name  ?? null,
    status:              tlStatus,
    assigned_at:         (firstUr as any)?.created_at ?? null,
    instructors,
    groups,
    student_count:       (studentsRes as any).count ?? 0,
    tl_code:             (firstUr as any)?.tl_code ?? null,
    phone:               u?.phone ?? null,
    payment_link:        (meta.payment_link as string) ?? null,
    wallet_number:       (meta.wallet_number as string) ?? null,
    bank_account_number: (meta.bank_account_number as string) ?? null,
  }
}
