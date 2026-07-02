'use server'

import { revalidatePath }      from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth }         from '@/modules/rbac/guards'
import type { ActionResult }   from '@/types/app'
import { getInstructorByUserId } from '@/modules/instructor-portal/queries'
import {
  seedPayoutRequestSubmittedNotification,
  seedPayoutRequestDecidedNotification,
} from '@/modules/notifications/actions'
import {
  isValidVodafoneCash, isValidInstapayLink,
  type InstructorPreferredMethod, type InstructorPayoutRequest,
  type InstructorPaymentMethods, type PayoutRequestListItem,
} from './types'
import {
  getOpenPayoutRequest, resolveInstructorStaffProfileId, getInstructorPaymentOverview,
  getInstructorPaymentMethods, listPayoutRequestsForBranches,
} from './queries'

const PAYMENTS_PATHS = [
  '/portal/instructor/payments',
  '/portal/instructor',
  '/portal/team-leader/payroll',
]

function revalidateAll() {
  for (const p of PAYMENTS_PATHS) revalidatePath(p)
}

const FORBIDDEN = {
  success: false as const,
  error: { code: 'FORBIDDEN', message: 'No permission to perform this action.' },
}

function hasPayrollAccess(permissions: string[]): boolean {
  return (
    permissions.includes('manage_payroll') ||
    permissions.includes('manage_financials') ||
    permissions.includes('manage_system')
  )
}

// ── Ownership guard: resolve the caller's own instructor row ──────────────────

async function requireOwnInstructor(userId: string) {
  const instructor = await getInstructorByUserId(userId)
  if (!instructor) {
    return { instructor: null, error: { code: 'NOT_FOUND', message: 'No instructor record found for this account.' } }
  }
  return { instructor, error: null }
}

// ── Update payment methods (instructor self-service) ───────────────────────────

export interface UpdatePaymentMethodsInput {
  payment_method:      InstructorPreferredMethod
  wallet_number?:       string   // Vodafone Cash number
  instapay_number?:     string
  payment_link?:        string   // Instapay payment link
  bank_account_number?: string
}

export async function updateMyPaymentMethodsAction(
  input: UpdatePaymentMethodsInput,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  const { instructor, error } = await requireOwnInstructor(user.id)
  if (!instructor) return { success: false, error: error! }

  // ── Validation ────────────────────────────────────────────────────────────
  if (input.payment_method === 'vodafone_cash') {
    const number = (input.wallet_number ?? '').trim()
    if (!isValidVodafoneCash(number)) {
      return { success: false, error: { code: 'INVALID', message: 'Vodafone Cash number must be exactly 11 digits.' } }
    }
  }
  if (input.payment_method === 'instapay') {
    const hasNumber = !!(input.instapay_number ?? '').trim()
    const link      = (input.payment_link ?? '').trim()
    if (!hasNumber && !link) {
      return { success: false, error: { code: 'INVALID', message: 'Provide an Instapay number or payment link.' } }
    }
    if (link && !isValidInstapayLink(link)) {
      return { success: false, error: { code: 'INVALID', message: 'Instapay payment link must be a valid URL.' } }
    }
  }
  if (input.payment_method === 'bank_transfer') {
    if (!(input.bank_account_number ?? '').trim()) {
      return { success: false, error: { code: 'INVALID', message: 'Bank account number is required.' } }
    }
  }

  const db = createServiceClient()
  const { error: dbError } = await db
    .from('instructors')
    .update({
      payment_method:      input.payment_method,
      wallet_number:       input.wallet_number?.trim()       || null,
      instapay_number:     input.instapay_number?.trim()     || null,
      payment_link:        input.payment_link?.trim()        || null,
      bank_account_number: input.bank_account_number?.trim() || null,
      updated_at:          new Date().toISOString(),
    })
    .eq('id', instructor.id)

  if (dbError) return { success: false, error: { code: 'DB_ERROR', message: dbError.message } }

  revalidateAll()
  return { success: true, data: undefined }
}

// ── Payout requests (instructor-initiated) ─────────────────────────────────────

export async function requestPayoutAction(): Promise<ActionResult<InstructorPayoutRequest>> {
  const user = await requireAuth()
  const { instructor, error } = await requireOwnInstructor(user.id)
  if (!instructor) return { success: false, error: error! }

  const existing = await getOpenPayoutRequest(instructor.id)
  if (existing) {
    return { success: false, error: { code: 'CONFLICT', message: 'You already have an open payout request.' } }
  }

  const overview = await getInstructorPaymentOverview(instructor.id, user.id, instructor.branch_id)
  if (overview.outstanding <= 0) {
    return { success: false, error: { code: 'INVALID', message: 'No outstanding balance to request.' } }
  }

  const db = createServiceClient()
  const { data, error: dbError } = await db
    .from('instructor_payout_requests')
    .insert({
      instructor_id:    instructor.id,
      branch_id:        instructor.branch_id,
      requested_amount: overview.outstanding,
      status:           'pending',
    })
    .select('*')
    .single()

  if (dbError || !data) {
    return { success: false, error: { code: 'DB_ERROR', message: dbError?.message ?? 'Failed to create payout request.' } }
  }

  const name = [instructor.first_name, instructor.last_name].filter(Boolean).join(' ') || instructor.email
  await seedPayoutRequestSubmittedNotification(instructor.branch_id, name, overview.outstanding, (data as any).id)

  revalidateAll()
  return { success: true, data: data as InstructorPayoutRequest }
}

// ── TL / Admin: decide a payout request (approve / reject) ─────────────────────

export async function decidePayoutRequestAction(
  payoutRequestId: string,
  decision:        'approved' | 'rejected',
  notes?:          string,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasPayrollAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()
  const { data: reqRow } = await db
    .from('instructor_payout_requests')
    .select('id, instructor_id, requested_amount, status')
    .eq('id', payoutRequestId)
    .maybeSingle()

  if (!reqRow) return { success: false, error: { code: 'NOT_FOUND', message: 'Payout request not found.' } }
  if ((reqRow as any).status !== 'pending') {
    return { success: false, error: { code: 'INVALID', message: 'Only pending requests can be decided.' } }
  }

  const { error } = await db
    .from('instructor_payout_requests')
    .update({
      status:         decision,
      decided_by:     user.id,
      decided_at:     new Date().toISOString(),
      decision_notes: notes?.trim() || null,
    })
    .eq('id', payoutRequestId)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  const { data: instrRow } = await db
    .from('instructors').select('user_id').eq('id', (reqRow as any).instructor_id).maybeSingle()
  if (instrRow) {
    await seedPayoutRequestDecidedNotification(
      (instrRow as any).user_id, decision, Number((reqRow as any).requested_amount), payoutRequestId,
    )
  }

  revalidateAll()
  return { success: true, data: undefined }
}

// ── TL / Admin: mark an approved payout request as paid ────────────────────────
// Creates the actual staff_payment_records row (the source of truth for "paid").

export async function markPayoutRequestPaidAction(
  payoutRequestId: string,
  paymentMethod:   string,
  notes?:          string,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasPayrollAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()
  const { data: reqRow } = await db
    .from('instructor_payout_requests')
    .select('id, instructor_id, branch_id, requested_amount, status')
    .eq('id', payoutRequestId)
    .maybeSingle()

  if (!reqRow) return { success: false, error: { code: 'NOT_FOUND', message: 'Payout request not found.' } }
  if ((reqRow as any).status !== 'approved') {
    return { success: false, error: { code: 'INVALID', message: 'Only approved requests can be marked as paid.' } }
  }

  const { data: instrRow } = await db
    .from('instructors').select('user_id, branch_id').eq('id', (reqRow as any).instructor_id).single()
  if (!instrRow) return { success: false, error: { code: 'NOT_FOUND', message: 'Instructor not found.' } }

  const staffProfileId = await resolveInstructorStaffProfileId((instrRow as any).user_id, (instrRow as any).branch_id)

  const now = new Date()
  const { data: payment, error: payError } = await db
    .from('staff_payment_records')
    .insert({
      staff_profile_id: staffProfileId,
      branch_id:        (reqRow as any).branch_id,
      month:            now.getMonth() + 1,
      year:             now.getFullYear(),
      amount:           (reqRow as any).requested_amount,
      payment_date:     now.toISOString().slice(0, 10),
      payment_method:   paymentMethod || null,
      notes:            notes?.trim() || `Payout request ${payoutRequestId}`,
      created_by:       user.id,
    })
    .select('id')
    .single()

  if (payError || !payment) {
    return { success: false, error: { code: 'DB_ERROR', message: payError?.message ?? 'Failed to record payment.' } }
  }

  const { error } = await db
    .from('instructor_payout_requests')
    .update({
      status:            'paid',
      decided_by:        user.id,
      decided_at:        now.toISOString(),
      decision_notes:    notes?.trim() || null,
      payment_record_id: (payment as any).id,
    })
    .eq('id', payoutRequestId)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  await seedPayoutRequestDecidedNotification(
    (instrRow as any).user_id, 'paid', Number((reqRow as any).requested_amount), payoutRequestId,
  )

  revalidateAll()
  return { success: true, data: undefined }
}

// ── TL / Admin: read wrappers (used by InstructorDetailModal) ──────────────────

export async function getInstructorPaymentMethodsAction(
  instructorId: string,
): Promise<ActionResult<InstructorPaymentMethods>> {
  const user = await requireAuth()
  if (!hasPayrollAccess(user.permissions)) return FORBIDDEN

  const data = await getInstructorPaymentMethods(instructorId)
  return { success: true, data }
}

export async function listInstructorPayoutRequestsForModalAction(
  branchIds: string[],
): Promise<ActionResult<PayoutRequestListItem[]>> {
  const user = await requireAuth()
  if (!hasPayrollAccess(user.permissions)) return FORBIDDEN

  const data = await listPayoutRequestsForBranches(branchIds)
  return { success: true, data }
}
