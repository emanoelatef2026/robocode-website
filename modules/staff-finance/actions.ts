'use server'

import { revalidatePath }      from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth }         from '@/modules/rbac/guards'
import type { ActionResult }   from '@/types/app'
import type {
  FinanceAdjustment, FinanceAdjType, UserPickerOption, InstructorSessionDetail,
  OverrideReason, StaffSession, StaffPaymentRecord, EmploymentStatus,
} from './types'
import { searchUsersForStaff, getInstructorSessionsDetail, getStaffSessions, getStaffPaymentRecords } from './queries'

// ── Constants ─────────────────────────────────────────────────────────────────

const PAYROLL_PATHS = [
  '/portal/team-leader/payroll',
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
  branch_id:         string
  instructor_id?:    string   // set for instructor adjustments
  staff_profile_id?: string   // set for staff adjustments
  type:              FinanceAdjType
  amount:            number   // must be > 0
  adjustment_date:   string   // YYYY-MM-DD
  notes:             string
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
  department:         string
  payroll_type:       'per_session' | 'fixed_salary' | 'mixed'
  basic_salary:       number
  session_rate:       number
  payment_method:     string
  payment_reference:  string
  employment_status:  EmploymentStatus
  works_all_branches: boolean
  notes:              string
}

export async function upsertStaffProfileAction(
  input: UpsertStaffProfileInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  if (!input.branch_id || input.branch_id === 'all') {
    return { success: false, error: { code: 'INVALID', message: 'A specific branch must be selected.' } }
  }

  const db = createServiceClient()

  const { data, error } = await db
    .from('staff_payroll_profiles')
    .upsert(
      {
        user_id:            input.user_id,
        branch_id:          input.branch_id,
        role:               input.role,
        department:         input.department.trim() || null,
        payroll_type:       input.payroll_type,
        basic_salary:       Math.max(0, input.basic_salary),
        session_rate:       Math.max(0, input.session_rate),
        payment_method:     input.payment_method,
        payment_reference:  input.payment_reference.trim() || null,
        employment_status:  input.employment_status,
        works_all_branches: input.works_all_branches,
        // Keep is_payroll_enabled in sync for backward compatibility
        is_payroll_enabled: input.employment_status !== 'inactive',
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

// ── Update employment status ──────────────────────────────────────────────────

export async function updateEmploymentStatusAction(
  profileId: string,
  status:    EmploymentStatus,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  const { error } = await db
    .from('staff_payroll_profiles')
    .update({
      employment_status:  status,
      is_payroll_enabled: status !== 'inactive',
      updated_at:         new Date().toISOString(),
    })
    .eq('id', profileId)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  revalidateAll()
  return { success: true, data: undefined }
}

// ── Update staff payment info (salary, rate, method) ─────────────────────────

export interface UpdateStaffPaymentInput {
  profile_id:        string
  basic_salary:      number
  session_rate:      number
  payment_method:    string
  payment_reference: string
}

export async function updateStaffPaymentInfoAction(
  input: UpdateStaffPaymentInput,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  const { error } = await db
    .from('staff_payroll_profiles')
    .update({
      basic_salary:      Math.max(0, input.basic_salary),
      session_rate:      Math.max(0, input.session_rate),
      payment_method:    input.payment_method,
      payment_reference: input.payment_reference.trim() || null,
      updated_at:        new Date().toISOString(),
    })
    .eq('id', input.profile_id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  revalidateAll()
  return { success: true, data: undefined }
}

// ── Update staff notes ────────────────────────────────────────────────────────

export async function updateStaffNotesAction(
  profileId: string,
  notes:     string,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  const { error } = await db
    .from('staff_payroll_profiles')
    .update({ notes: notes.trim() || null, updated_at: new Date().toISOString() })
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

// ── Get instructor session details (drill-down popup) ─────────────────────────

export async function getInstructorSessionsDetailAction(
  instructorId: string,
  branchIds:    string[],
  dateFrom:     string,
  dateTo:       string,
): Promise<ActionResult<InstructorSessionDetail[]>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  const data = await getInstructorSessionsDetail(instructorId, branchIds, dateFrom, dateTo)
  return { success: true, data }
}

// ── Get staff sessions (detail view) ─────────────────────────────────────────

export async function getStaffSessionsAction(
  profileId: string,
  dateFrom?: string,
  dateTo?:   string,
): Promise<ActionResult<StaffSession[]>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  const data = await getStaffSessions(profileId, dateFrom, dateTo)
  return { success: true, data }
}

// ── Add staff session ─────────────────────────────────────────────────────────

export interface AddStaffSessionInput {
  staff_profile_id: string
  branch_id:        string
  session_date:     string   // YYYY-MM-DD
  activity_type:    string
  description:      string
  rate:             number
  quantity:         number
  notes:            string
}

export async function addStaffSessionAction(
  input: AddStaffSessionInput,
): Promise<ActionResult<StaffSession>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  if (input.rate < 0) {
    return { success: false, error: { code: 'INVALID', message: 'Rate must be 0 or greater.' } }
  }
  if (input.quantity <= 0) {
    return { success: false, error: { code: 'INVALID', message: 'Quantity must be greater than 0.' } }
  }

  const db = createServiceClient()

  const { data, error } = await db
    .from('staff_sessions')
    .insert({
      staff_profile_id: input.staff_profile_id,
      branch_id:        input.branch_id,
      session_date:     input.session_date,
      activity_type:    input.activity_type || 'custom',
      description:      input.description.trim() || null,
      rate:             input.rate,
      quantity:         input.quantity,
      notes:            input.notes.trim() || null,
      created_by:       user.id,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to add session.' } }
  }

  revalidateAll()
  const s = data as any
  return {
    success: true,
    data: {
      ...s,
      rate:     Number(s.rate),
      quantity: Number(s.quantity),
      amount:   Number(s.rate) * Number(s.quantity),
    } as StaffSession,
  }
}

// ── Update staff session ──────────────────────────────────────────────────────

export interface UpdateStaffSessionInput {
  id:            string
  session_date:  string
  activity_type: string
  description:   string
  rate:          number
  quantity:      number
  notes:         string
}

export async function updateStaffSessionAction(
  input: UpdateStaffSessionInput,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  if (input.rate < 0) {
    return { success: false, error: { code: 'INVALID', message: 'Rate must be 0 or greater.' } }
  }
  if (input.quantity <= 0) {
    return { success: false, error: { code: 'INVALID', message: 'Quantity must be greater than 0.' } }
  }

  const db = createServiceClient()

  const { error } = await db
    .from('staff_sessions')
    .update({
      session_date:  input.session_date,
      activity_type: input.activity_type || 'custom',
      description:   input.description.trim() || null,
      rate:          input.rate,
      quantity:      input.quantity,
      notes:         input.notes.trim() || null,
      updated_at:    new Date().toISOString(),
    })
    .eq('id', input.id)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  revalidateAll()
  return { success: true, data: undefined }
}

// ── Delete staff session ──────────────────────────────────────────────────────

export async function deleteStaffSessionAction(
  sessionId: string,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  const { error } = await db
    .from('staff_sessions')
    .delete()
    .eq('id', sessionId)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  revalidateAll()
  return { success: true, data: undefined }
}

// ── Add staff payment record ──────────────────────────────────────────────────

export interface AddStaffPaymentInput {
  staff_profile_id: string
  branch_id:        string
  month:            number
  year:             number
  amount:           number
  payment_date:     string   // YYYY-MM-DD
  payment_method:   string
  notes:            string
}

export async function addStaffPaymentAction(
  input: AddStaffPaymentInput,
): Promise<ActionResult<StaffPaymentRecord>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  if (input.amount <= 0) {
    return { success: false, error: { code: 'INVALID', message: 'Amount must be greater than 0.' } }
  }

  const db = createServiceClient()

  const { data, error } = await db
    .from('staff_payment_records')
    .insert({
      staff_profile_id: input.staff_profile_id,
      branch_id:        input.branch_id,
      month:            input.month,
      year:             input.year,
      amount:           input.amount,
      payment_date:     input.payment_date,
      payment_method:   input.payment_method || null,
      notes:            input.notes.trim() || null,
      created_by:       user.id,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to add payment.' } }
  }

  revalidateAll()
  const pr = data as any
  return {
    success: true,
    data: { ...pr, amount: Number(pr.amount) } as StaffPaymentRecord,
  }
}

// ── Delete staff payment record ───────────────────────────────────────────────

export async function deleteStaffPaymentAction(
  paymentId: string,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  const { error } = await db
    .from('staff_payment_records')
    .delete()
    .eq('id', paymentId)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  revalidateAll()
  return { success: true, data: undefined }
}

// ── Get staff payment records (server action wrapper) ─────────────────────────

export async function getStaffPaymentRecordsAction(
  profileId: string,
  month:     number,
  year:      number,
): Promise<ActionResult<StaffPaymentRecord[]>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  const data = await getStaffPaymentRecords(profileId, month, year)
  return { success: true, data }
}

// ── Set group-specific instructor rate ────────────────────────────────────────

export async function setGroupInstructorRateAction(
  groupId:      string,
  instructorId: string,
  sessionRate:  number | null,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  if (sessionRate !== null && sessionRate < 0) {
    return { success: false, error: { code: 'INVALID', message: 'Rate must be 0 or greater.' } }
  }

  const db = createServiceClient()

  const { error } = await db
    .from('group_instructors')
    .update({ session_rate: sessionRate })
    .eq('group_id', groupId)
    .eq('instructor_id', instructorId)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  revalidateAll()
  return { success: true, data: undefined }
}

// ── Upsert session rate override ──────────────────────────────────────────────

export interface UpsertSessionOverrideInput {
  schedule_id:   string
  instructor_id: string
  override_rate: number
  reason:        string
  notes:         string
}

export async function upsertSessionRateOverrideAction(
  input: UpsertSessionOverrideInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  if (input.override_rate < 0) {
    return { success: false, error: { code: 'INVALID', message: 'Rate must be 0 or greater.' } }
  }

  const db = createServiceClient()

  const { data, error } = await db
    .from('payroll_session_overrides')
    .upsert(
      {
        schedule_id:   input.schedule_id,
        instructor_id: input.instructor_id,
        override_rate: input.override_rate,
        reason:        input.reason.trim()  || null,
        notes:         input.notes.trim()   || null,
        created_by:    user.id,
        updated_at:    new Date().toISOString(),
      },
      { onConflict: 'schedule_id,instructor_id' },
    )
    .select('id')
    .single()

  if (error || !data) {
    return { success: false, error: { code: 'DB_ERROR', message: error?.message ?? 'Failed to save override.' } }
  }

  revalidateAll()
  return { success: true, data: { id: (data as any).id } }
}

// ── Remove session rate override ──────────────────────────────────────────────

export async function removeSessionRateOverrideAction(
  overrideId: string,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  const { error } = await db
    .from('payroll_session_overrides')
    .delete()
    .eq('id', overrideId)

  if (error) {
    return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  revalidateAll()
  return { success: true, data: undefined }
}

// ── Load adjustments for a date range (server action) ─────────────────────────

export async function getAdjustmentsAction(
  filters: {
    instructor_id?:    string
    staff_profile_id?: string
    branch_id:         string
    date_from?:        string
    date_to?:          string
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
