'use server'

import { revalidatePath }      from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth }         from '@/modules/rbac/guards'
import type { ActionResult }   from '@/types/app'
import { getInstructorByUserId } from '@/modules/instructor-portal/queries'
import {
  validatePaymentMethodFields,
  type InstructorPreferredMethod,
  type InstructorPaymentMethods,
} from './types'
import { getInstructorPaymentMethods } from './queries'

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
  const validationError = validatePaymentMethodFields(input)
  if (validationError) {
    return { success: false, error: { code: 'INVALID', message: validationError } }
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

// ── TL / Admin: read wrapper (used by InstructorDetailModal) ───────────────────

export async function getInstructorPaymentMethodsAction(
  instructorId: string,
): Promise<ActionResult<InstructorPaymentMethods>> {
  const user = await requireAuth()
  if (!hasPayrollAccess(user.permissions)) return FORBIDDEN

  const data = await getInstructorPaymentMethods(instructorId)
  return { success: true, data }
}
