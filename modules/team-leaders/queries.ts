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
// NORMALIZED: Returns ONE record per unique user_id.
// Multi-branch TLs are aggregated — branch_ids / branch_names are arrays.
// active_groups / active_students are totals across all assigned branches.

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
  const db = createServiceClient()

  const { data: roleRow } = await db
    .from('roles').select('id').eq('name', 'team_leader').single()
  if (!roleRow) return { data: [], total: 0, page, perPage, totalPages: 0 }

  // Fetch ALL matching user_roles rows (no pagination yet — we aggregate first)
  let q = db
    .from('user_roles')
    .select(
      `id, user_id, branch_id, created_at, tl_code,
       users!user_roles_user_id_fkey(
         email, phone, metadata,
         profiles!profiles_user_id_fkey(first_name, last_name)
       ),
       branches!fk_user_roles_branch(name)`
    )
    .eq('role_id', roleRow.id)
    .not('branch_id', 'is', null)
    .order('user_id')
    .order('created_at', { ascending: true })

  if (branchId) q = q.eq('branch_id', branchId)

  const { data: rows, error } = await q
  if (error) throw new Error(error.message)

  // Aggregate rows by user_id — one entry per TL person
  const userMap = new Map<string, {
    user_role_id: string
    user_id:      string
    branch_ids:   string[]
    branch_names: string[]
    tl_code:      string | null
    email:        string
    first_name:   string | null
    last_name:    string | null
    phone:        string | null
    status:       TeamLeaderStatus
  }>()

  for (const row of (rows ?? []) as any[]) {
    const uid  = row.user_id as string
    const u    = row.users
    const prof = u?.profiles
    const s    = metaStatus(u?.metadata)

    if (!userMap.has(uid)) {
      userMap.set(uid, {
        user_role_id: row.id,
        user_id:      uid,
        branch_ids:   [],
        branch_names: [],
        tl_code:      row.tl_code ?? null,
        email:        u?.email ?? '',
        first_name:   prof?.first_name ?? null,
        last_name:    prof?.last_name  ?? null,
        phone:        u?.phone ?? null,
        status:       s,
      })
    }
    const entry = userMap.get(uid)!
    if (row.branch_id) {
      entry.branch_ids.push(row.branch_id as string)
      entry.branch_names.push(row.branches?.name ?? row.branch_id)
    }
    // Update tl_code if any row has one
    if (row.tl_code && !entry.tl_code) entry.tl_code = row.tl_code
  }

  let aggregated = [...userMap.values()]

  // Apply status + search filters
  if (status) {
    aggregated = aggregated.filter(i => i.status === status)
  }
  if (search) {
    const sq = search.toLowerCase()
    aggregated = aggregated.filter(i =>
      `${i.first_name ?? ''} ${i.last_name ?? ''} ${i.email} ${i.branch_names.join(' ')}`.toLowerCase().includes(sq)
    )
  }

  // Get totals across all branches
  const allBranchIds = [...new Set(aggregated.flatMap(tl => tl.branch_ids))]
  const [groupCounts, studentCounts] = allBranchIds.length > 0
    ? await Promise.all([
        db.from('groups').select('branch_id').in('branch_id', allBranchIds).eq('status', 'active').is('deleted_at', null),
        db.from('students').select('branch_id').in('branch_id', allBranchIds).eq('status', 'active').is('deleted_at', null),
      ])
    : [{ data: [] }, { data: [] }]

  const groupsByBranch  : Record<string, number> = {}
  const studentsByBranch: Record<string, number> = {}
  for (const g of groupCounts.data   ?? []) groupsByBranch[(g as any).branch_id]   = (groupsByBranch[(g as any).branch_id]   ?? 0) + 1
  for (const s of studentCounts.data ?? []) studentsByBranch[(s as any).branch_id] = (studentsByBranch[(s as any).branch_id] ?? 0) + 1

  const total = aggregated.length

  // Apply pagination on the unique-user list
  const from  = (page - 1) * perPage
  const paged = aggregated.slice(from, from + perPage)

  const items: TeamLeaderListItem[] = paged.map(tl => ({
    user_role_id:    tl.user_role_id,
    user_id:         tl.user_id,
    branch_ids:      tl.branch_ids,
    branch_names:    tl.branch_names,
    branch_id:       tl.branch_ids[0] ?? '',
    branch_name:     tl.branch_names[0] ?? '',
    email:           tl.email,
    first_name:      tl.first_name,
    last_name:       tl.last_name,
    status:          tl.status,
    active_groups:   tl.branch_ids.reduce((sum, bid) => sum + (groupsByBranch[bid] ?? 0), 0),
    active_students: tl.branch_ids.reduce((sum, bid) => sum + (studentsByBranch[bid] ?? 0), 0),
    tl_code:         tl.tl_code,
    phone:           tl.phone,
  }))

  return {
    data:       items,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
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

// ── Responsibilities summary (pre-delete/disable check) ───────────────────────

export async function getTeamLeaderResponsibilities(userId: string): Promise<{
  branchIds:    string[]
  leadCount:    number
  groupCount:   number
  studentCount: number
}> {
  const db = createServiceClient()
  const { data: tlRole } = await db.from('roles').select('id').eq('name', 'team_leader').single()
  if (!tlRole) return { branchIds: [], leadCount: 0, groupCount: 0, studentCount: 0 }

  const { data: urRows } = await db
    .from('user_roles').select('branch_id')
    .eq('user_id', userId).eq('role_id', tlRole.id).not('branch_id', 'is', null)

  const branchIds = (urRows ?? []).map((r: any) => r.branch_id as string)

  const leadQ = db.from('leads').select('id', { count: 'exact', head: true })
    .eq('assigned_to', userId).not('status', 'in', '("CONVERTED","LOST")')

  const [leadRes, groupRes, studentRes] = await Promise.all([
    leadQ,
    branchIds.length
      ? db.from('groups').select('id', { count: 'exact', head: true }).in('branch_id', branchIds).eq('status', 'active').is('deleted_at', null)
      : Promise.resolve({ count: 0 }),
    branchIds.length
      ? db.from('students').select('id', { count: 'exact', head: true }).in('branch_id', branchIds).eq('status', 'active').is('deleted_at', null)
      : Promise.resolve({ count: 0 }),
  ])

  return {
    branchIds,
    leadCount:    (leadRes as any).count    ?? 0,
    groupCount:   (groupRes as any).count   ?? 0,
    studentCount: (studentRes as any).count ?? 0,
  }
}
