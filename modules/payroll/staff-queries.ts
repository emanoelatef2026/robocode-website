import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { StaffPayrollProfile, StaffPayrollProfileRow } from './types'

// ── Helpers ────────────────────────────────────────────────────────────────────

function profileName(row: any): string {
  const prof = row?.users?.profiles ?? {}
  return [prof.first_name, prof.last_name].filter(Boolean).join(' ') || '—'
}

// ── Get all staff profiles for a branch ───────────────────────────────────────

export async function getStaffPayrollProfiles(
  branchId: string,
): Promise<StaffPayrollProfileRow[]> {
  const db = createServiceClient()

  const [profilesRes, branchRes] = await Promise.all([
    db.from('staff_payroll_profiles')
      .select(`
        *,
        users!staff_payroll_profiles_user_id_fkey(
          profiles!profiles_user_id_fkey(first_name, last_name, phone, avatar_url)
        )
      `)
      .eq('branch_id', branchId)
      .order('role', { ascending: true })
      .order('created_at', { ascending: true }),
    db.from('branches').select('name').eq('id', branchId).maybeSingle(),
  ])

  const branchName = (branchRes.data as any)?.name ?? ''

  return ((profilesRes.data ?? []) as any[]).map(row => ({
    ...row,
    display_name: profileName(row),
    avatar_url:   (row.users?.profiles?.avatar_url as string | null) ?? null,
    phone:        (row.users?.profiles?.phone as string | null) ?? null,
    branch_name:  branchName,
    users:        undefined,
  } as StaffPayrollProfileRow))
}

// ── Get all staff profiles across multiple branches ───────────────────────────

export async function getStaffPayrollProfilesForBranches(
  branchIds: string[],
): Promise<StaffPayrollProfileRow[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  const [profilesRes, branchesRes] = await Promise.all([
    db.from('staff_payroll_profiles')
      .select(`
        *,
        users!staff_payroll_profiles_user_id_fkey(
          profiles!profiles_user_id_fkey(first_name, last_name, phone, avatar_url)
        )
      `)
      .in('branch_id', branchIds)
      .order('role', { ascending: true })
      .order('created_at', { ascending: true }),
    db.from('branches').select('id, name').in('id', branchIds),
  ])

  const branchMap = new Map<string, string>()
  for (const b of (branchesRes.data ?? []) as any[]) branchMap.set(b.id, b.name)

  return ((profilesRes.data ?? []) as any[]).map(row => ({
    ...row,
    display_name: profileName(row),
    avatar_url:   (row.users?.profiles?.avatar_url as string | null) ?? null,
    phone:        (row.users?.profiles?.phone as string | null) ?? null,
    branch_name:  branchMap.get(row.branch_id) ?? '',
    users:        undefined,
  } as StaffPayrollProfileRow))
}

// ── Get a single staff profile by id ─────────────────────────────────────────

export async function getStaffPayrollProfile(
  profileId: string,
): Promise<StaffPayrollProfileRow | null> {
  const db = createServiceClient()

  const { data } = await db
    .from('staff_payroll_profiles')
    .select(`
      *,
      users!staff_payroll_profiles_user_id_fkey(
        profiles!profiles_user_id_fkey(first_name, last_name, phone, avatar_url)
      ),
      branches!staff_payroll_profiles_branch_id_fkey(name)
    `)
    .eq('id', profileId)
    .maybeSingle()

  if (!data) return null
  const row = data as any
  return {
    ...row,
    display_name: profileName(row),
    avatar_url:   (row.users?.profiles?.avatar_url as string | null) ?? null,
    phone:        (row.users?.profiles?.phone as string | null) ?? null,
    branch_name:  row.branches?.name ?? '',
    users:        undefined,
    branches:     undefined,
  } as StaffPayrollProfileRow
}

// ── Get staff profile by user_id + branch_id ─────────────────────────────────

export async function getStaffPayrollProfileByUser(
  userId: string,
  branchId: string,
): Promise<StaffPayrollProfile | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('staff_payroll_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('branch_id', branchId)
    .maybeSingle()
  return data as StaffPayrollProfile | null
}

// ── Get users not yet in staff_payroll_profiles for a branch ─────────────────
// Used by the "Add Staff" modal to show users who can be added.

export async function getUnEnrolledUsersForPayroll(
  branchId: string,
): Promise<Array<{ user_id: string; display_name: string; role: string }>> {
  const db = createServiceClient()

  // Get existing profile user_ids for this branch
  const { data: existing } = await db
    .from('staff_payroll_profiles')
    .select('user_id')
    .eq('branch_id', branchId)

  const existingIds = new Set(((existing ?? []) as any[]).map(r => r.user_id as string))

  // Get all users with staff roles in this branch via user_roles
  const { data: roles } = await db
    .from('user_roles')
    .select(`
      user_id,
      roles!user_roles_role_id_fkey(name),
      users!user_roles_user_id_fkey(
        profiles!profiles_user_id_fkey(first_name, last_name)
      )
    `)

  return ((roles ?? []) as any[])
    .filter(r => !existingIds.has(r.user_id))
    .filter(r => ['super_admin', 'team_leader', 'instructor'].includes(r.roles?.name ?? ''))
    .map(r => ({
      user_id:      r.user_id as string,
      display_name: profileName(r),
      role:         r.roles?.name ?? 'other',
    }))
}
