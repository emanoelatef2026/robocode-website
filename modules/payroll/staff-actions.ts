'use server'

import { revalidatePath }      from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth }         from '@/modules/rbac/guards'
import type { ActionResult }   from '@/types/app'
import type {
  StaffPayrollProfile, StaffPayrollProfileRow,
  PayrollType, PaymentMethod, StaffRole,
} from './types'
import { getStaffPayrollProfile, getStaffPayrollProfiles } from './staff-queries'

// ── Constants ─────────────────────────────────────────────────────────────────

const REVALIDATE_PATHS = [
  '/portal/team-leader/payroll',
  '/portal/team-leader/payroll/staff',
  '/portal/team-leader/instructor-payroll',
]

const FORBIDDEN = {
  success: false as const,
  error: { code: 'FORBIDDEN', message: 'You do not have permission to manage payroll.' },
}

function hasPayrollAccess(permissions: string[]): boolean {
  return permissions.includes('manage_payroll') || permissions.includes('manage_financials')
}

function revalidateAll() {
  for (const p of REVALIDATE_PATHS) revalidatePath(p)
}

// ── Upsert staff payroll profile ──────────────────────────────────────────────

export interface UpsertStaffProfileInput {
  user_id:            string
  branch_id:          string
  role:               StaffRole
  payroll_type:       PayrollType
  basic_salary:       number
  session_rate:       number
  payment_method:     PaymentMethod
  payment_reference:  string
  is_payroll_enabled: boolean
  notes:              string
}

export async function upsertStaffPayrollProfileAction(
  input: UpsertStaffProfileInput,
): Promise<ActionResult<StaffPayrollProfileRow>> {
  const user = await requireAuth()
  if (!hasPayrollAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  const payload = {
    user_id:            input.user_id,
    branch_id:          input.branch_id,
    role:               input.role,
    payroll_type:       input.payroll_type,
    basic_salary:       Math.max(0, input.basic_salary),
    session_rate:       Math.max(0, input.session_rate),
    payment_method:     input.payment_method,
    payment_reference:  input.payment_reference.trim() || null,
    is_payroll_enabled: input.is_payroll_enabled,
    notes:              input.notes.trim() || null,
    created_by:         user.id,
  }

  const { data, error } = await db
    .from('staff_payroll_profiles')
    .upsert(payload, { onConflict: 'user_id,branch_id' })
    .select('id')
    .single()

  if (error || !data) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to save staff profile.' } }
  }

  try {
    await db.rpc('write_audit_log', {
      p_performed_by: user.id,
      p_action:       'upsert_staff_payroll_profile',
      p_entity_type:  'staff_payroll_profile',
      p_entity_id:    (data as any).id,
      p_new_values:   { ...payload, notes: payload.notes?.slice(0, 200) },
    })
  } catch { /* audit log is non-critical */ }

  revalidateAll()

  const profile = await getStaffPayrollProfile((data as any).id)
  if (!profile) return { success: false, error: { code: 'NOT_FOUND', message: 'Profile not found after save.' } }
  return { success: true, data: profile }
}

// ── Toggle payroll enabled ────────────────────────────────────────────────────

export async function toggleStaffPayrollEnabledAction(
  profileId: string,
  enabled: boolean,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasPayrollAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  const { error } = await db
    .from('staff_payroll_profiles')
    .update({ is_payroll_enabled: enabled })
    .eq('id', profileId)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  revalidateAll()
  return { success: true, data: undefined }
}

// ── List staff profiles for a branch (server action wrapper) ──────────────────

export async function getStaffPayrollProfilesAction(
  branchId: string,
): Promise<ActionResult<StaffPayrollProfileRow[]>> {
  const user = await requireAuth()
  if (!hasPayrollAccess(user.permissions)) return FORBIDDEN

  const profiles = await getStaffPayrollProfiles(branchId)
  return { success: true, data: profiles }
}

// ── Get single profile (server action wrapper) ────────────────────────────────

export async function getStaffPayrollProfileAction(
  profileId: string,
): Promise<ActionResult<StaffPayrollProfileRow>> {
  const user = await requireAuth()
  if (!hasPayrollAccess(user.permissions)) return FORBIDDEN

  const profile = await getStaffPayrollProfile(profileId)
  if (!profile) return { success: false, error: { code: 'NOT_FOUND', message: 'Profile not found.' } }
  return { success: true, data: profile }
}
