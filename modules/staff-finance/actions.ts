'use server'

import { revalidatePath }      from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth }         from '@/modules/rbac/guards'
import type { ActionResult }   from '@/types/app'
import type {
  FinanceAdjustment, FinanceAdjType, UserPickerOption,
} from './types'
import { searchUsersForStaff } from './queries'

// ── Constants ─────────────────────────────────────────────────────────────────

const PAYROLL_PATHS = [
  '/portal/team-leader/payroll',
  '/portal/team-leader/payroll/staff',
  '/portal/team-leader/instructor-payroll',
]

const FORBIDDEN = {
  success: false as const,
  error: { code: 'FORBIDDEN', message: 'No permission to manage payroll.' },
}

function hasAccess(permissions: string[]): boolean {
  return (
    permissions.includes('manage_payroll') ||
    permissions.includes('manage_financials') ||
    permissions.includes('manage_system')
  )
}

function revalidateAll() {
  for (const p of PAYROLL_PATHS) revalidatePath(p)
}

// ── Add adjustment ────────────────────────────────────────────────────────────

export interface AddAdjustmentInput {
  branch_id:        string
  instructor_id?:   string   // set for instructor adjustments
  staff_profile_id?: string  // set for staff adjustments
  type:             FinanceAdjType
  amount:           number   // must be > 0
  adjustment_date:  string   // YYYY-MM-DD
  notes:            string
}

export async function addFinanceAdjustmentAction(
  input: AddAdjustmentInput,
): Promise<ActionResult<FinanceAdjustment>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  if (!input.instructor_id && !input.staff_profile_id) {
    return { success: false, error: { code: 'INVALID', message: 'Either instructor_id or staff_profile_id is required.' } }
  }
  if (input.amount <= 0) {
    return { success: false, error: { code: 'INVALID', message: 'Amount must be greater than 0.' } }
  }

  const db = createServiceClient()

  const { data, error } = await db
    .from('finance_adjustments')
    .insert({
      branch_id:        input.branch_id,
      instructor_id:    input.instructor_id    ?? null,
      staff_profile_id: input.staff_profile_id ?? null,
      type:             input.type,
      amount:           input.amount,
      adjustment_date:  input.adjustment_date,
      notes:            input.notes.trim() || null,
      created_by:       user.id,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to add adjustment.' } }
  }

  revalidateAll()
  return { success: true, data: data as FinanceAdjustment }
}

// ── Delete adjustment ─────────────────────────────────────────────────────────

export async function deleteFinanceAdjustmentAction(
  id: string,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  const { error } = await db
    .from('finance_adjustments')
    .delete()
    .eq('id', id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  revalidateAll()
  return { success: true, data: undefined }
}

// ── Update instructor payment info ────────────────────────────────────────────

export interface UpdateInstructorPaymentInput {
  instructor_id:      string
  salary_per_session: number | null
  payment_method:     string | null
  instapay_number:    string | null
  payment_notes:      string | null
}

export async function updateInstructorPaymentInfoAction(
  input: UpdateInstructorPaymentInput,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  const { error } = await db
    .from('instructors')
    .update({
      salary_per_session: input.salary_per_session,
      payment_method:     input.payment_method     ?? null,
      instapay_number:    input.instapay_number    ?? null,
      payment_notes:      input.payment_notes      ?? null,
      updated_at:         new Date().toISOString(),
    })
    .eq('id', input.instructor_id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  revalidateAll()
  return { success: true, data: undefined }
}

// ── Upsert staff payroll profile ──────────────────────────────────────────────

export interface UpsertStaffProfileInput {
  user_id:            string
  branch_id:          string
  role:               string
  payroll_type:       'per_session' | 'fixed_salary' | 'mixed'
  basic_salary:       number
  session_rate:       number
  payment_method:     string
  payment_reference:  string
  is_payroll_enabled: boolean
  notes:              string
}

export async function upsertStaffProfileAction(
  input: UpsertStaffProfileInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  const { data, error } = await db
    .from('staff_payroll_profiles')
    .upsert(
      {
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
      },
      { onConflict: 'user_id,branch_id' }
    )
    .select('id')
    .single()

  if (error || !data) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to save staff profile.' } }
  }

  revalidateAll()
  return { success: true, data: { id: (data as any).id } }
}

// ── Toggle staff enabled ──────────────────────────────────────────────────────

export async function toggleStaffEnabledAction(
  profileId: string,
  enabled:   boolean,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

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

// ── Delete staff profile ──────────────────────────────────────────────────────

export async function deleteStaffProfileAction(
  profileId: string,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  const { error } = await db
    .from('staff_payroll_profiles')
    .delete()
    .eq('id', profileId)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  revalidateAll()
  return { success: true, data: undefined }
}

// ── Search users for staff picker (server action wrapper) ─────────────────────

export async function searchUsersForStaffAction(
  branchId: string,
  query:    string,
): Promise<ActionResult<UserPickerOption[]>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  const results = await searchUsersForStaff(branchId, query)
  return { success: true, data: results }
}

// ── Load adjustments for a date range (server action) ─────────────────────────

export async function getAdjustmentsAction(
  filters: {
    instructor_id?:   string
    staff_profile_id?: string
    branch_id:        string
    date_from?:       string
    date_to?:         string
  },
): Promise<ActionResult<FinanceAdjustment[]>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  let q = db
    .from('finance_adjustments')
    .select('*')
    .eq('branch_id', filters.branch_id)
    .order('adjustment_date', { ascending: false })

  if (filters.instructor_id)    q = q.eq('instructor_id', filters.instructor_id)
  if (filters.staff_profile_id) q = q.eq('staff_profile_id', filters.staff_profile_id)
  if (filters.date_from)        q = q.gte('adjustment_date', filters.date_from)
  if (filters.date_to)          q = q.lte('adjustment_date', filters.date_to)

  const { data, error } = await q
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  return { success: true, data: (data ?? []) as FinanceAdjustment[] }
}
