'use server'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission }   from '@/modules/rbac/guards'
import { revalidatePath }       from 'next/cache'
import type {
  AddPaymentInput, AddNoteInput, AddActivityInput,
  CreateAccountInput, AddInstallmentInput, AddPromiseInput,
} from './types'
import { getStudentFinanceDetail, getAccountPromises } from './queries'

// ── Branch access guard helper ─────────────────────────────────────────────────

function assertBranchAccess(user: { globalRole: string; branchIds: string[] }, branchId: string) {
  if (user.globalRole === 'super_admin') return
  if (!user.branchIds.includes(branchId)) {
    throw new Error('Not authorized for this branch')
  }
}

async function getAccountBranchId(db: ReturnType<typeof createServiceClient>, accountId: string): Promise<string | null> {
  const { data } = await db.from('student_financial_accounts').select('branch_id').eq('id', accountId).single()
  return (data as any)?.branch_id ?? null
}

async function getStudentBranchId(db: ReturnType<typeof createServiceClient>, studentId: string): Promise<string | null> {
  const { data } = await db.from('students').select('branch_id').eq('id', studentId).single()
  return (data as any)?.branch_id ?? null
}

async function resolveBranchIdForNote(
  db: ReturnType<typeof createServiceClient>,
  accountId: string | undefined,
  studentId: string
): Promise<string | null> {
  if (accountId) return getAccountBranchId(db, accountId)
  return getStudentBranchId(db, studentId)
}

// ── Create / update financial account ─────────────────────────────────────────

export async function createOrUpdateFinancialAccount(input: CreateAccountInput) {
  const user = await requirePermission('manage_financials')
  assertBranchAccess(user, input.branch_id)
  const db   = createServiceClient()

  const net = input.total_amount - (input.discount_amount ?? 0)

  const { data, error } = await db
    .from('student_financial_accounts')
    .upsert(
      {
        student_id:      input.student_id,
        branch_id:       input.branch_id,
        group_id:        input.group_id ?? null,
        total_amount:    input.total_amount,
        discount_amount: input.discount_amount ?? 0,
        net_amount:      net,
        next_due_date:   input.next_due_date ?? null,
        notes:           input.notes ?? null,
        created_by:      user.id,
      },
      { onConflict: 'student_id', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/admin/finance')
  revalidatePath('/portal/team-leader/finance')
  return { accountId: (data as any).id as string }
}

// ── Add payment ───────────────────────────────────────────────────────────────

export async function addPayment(input: AddPaymentInput) {
  const user = await requirePermission('manage_financials')
  const db   = createServiceClient()

  const branchId = await getAccountBranchId(db, input.account_id)
  if (!branchId) return { error: 'Account not found' }
  assertBranchAccess(user, branchId)

  const { error } = await db.from('finance_payments').insert({
    student_id:       input.student_id,
    account_id:       input.account_id,
    installment_id:   input.installment_id ?? null,
    amount:           input.amount,
    payment_date:     input.payment_date,
    payment_method:   input.payment_method,
    reference_number: input.reference_number ?? null,
    notes:            input.notes ?? null,
    created_by:       user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/admin/finance')
  revalidatePath('/portal/team-leader/finance')
  revalidatePath('/portal/parent/finance')
  return { ok: true }
}

// ── Add installment ───────────────────────────────────────────────────────────

export async function addInstallment(input: AddInstallmentInput) {
  const user = await requirePermission('manage_financials')
  const db   = createServiceClient()

  const branchId = await getAccountBranchId(db, input.account_id)
  if (!branchId) return { error: 'Account not found' }
  assertBranchAccess(user, branchId)

  const { error } = await db.from('finance_installments').insert({
    account_id:         input.account_id,
    installment_number: input.installment_number,
    amount:             input.amount,
    due_date:           input.due_date,
    notes:              input.notes ?? null,
  })

  if (error) return { error: error.message }

  // Update next_due_date on account to the earliest PENDING installment
  const { data: pending } = await db
    .from('finance_installments')
    .select('due_date')
    .eq('account_id', input.account_id)
    .in('status', ['PENDING','PARTIAL','OVERDUE'])
    .order('due_date', { ascending: true })
    .limit(1)

  if (pending && (pending as any[]).length > 0) {
    await db.from('student_financial_accounts')
      .update({ next_due_date: (pending as any[])[0].due_date, updated_at: new Date().toISOString() })
      .eq('id', input.account_id)
  }

  revalidatePath('/admin/finance')
  return { ok: true }
}

// ── Add finance note ──────────────────────────────────────────────────────────

export async function addFinanceNote(input: AddNoteInput) {
  const user = await requirePermission('manage_financials')
  const db   = createServiceClient()

  const branchId = await resolveBranchIdForNote(db, input.account_id, input.student_id)
  if (!branchId) return { error: 'Student or account not found' }
  try { assertBranchAccess(user, branchId) } catch { return { error: 'Not authorized for this branch' } }

  const { error } = await db.from('finance_notes').insert({
    student_id:  input.student_id,
    account_id:  input.account_id ?? null,
    note_text:   input.note_text,
    is_internal: input.is_internal,
    created_by:  user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/finance')
  return { ok: true }
}

// ── Record collection activity ────────────────────────────────────────────────

export async function recordActivity(input: AddActivityInput) {
  const user = await requirePermission('manage_financials')
  const db   = createServiceClient()

  const branchId = await resolveBranchIdForNote(db, input.account_id, input.student_id)
  if (!branchId) return { error: 'Student or account not found' }
  try { assertBranchAccess(user, branchId) } catch { return { error: 'Not authorized for this branch' } }

  const { error } = await db.from('collection_activities').insert({
    student_id:    input.student_id,
    account_id:    input.account_id ?? null,
    activity_type: input.activity_type,
    notes:         input.notes ?? null,
    created_by:    user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/finance')
  return { ok: true }
}

// ── Fetch detail for the student modal (data-loading action) ───────────────────

export async function fetchStudentFinanceDetail(accountId: string) {
  const user = await requirePermission('manage_financials')
  const db   = createServiceClient()

  const branchId = await getAccountBranchId(db, accountId)
  if (!branchId) return null
  try { assertBranchAccess(user, branchId) } catch { return null }

  return getStudentFinanceDetail(accountId)
}

// ── Bulk mark reminder sent ───────────────────────────────────────────────────

export async function bulkRecordReminders(accountIds: string[]) {
  const user = await requirePermission('manage_financials')
  const db   = createServiceClient()

  if (!accountIds.length) return { ok: true, count: 0 }

  // Get student IDs for the accounts
  const { data: accounts } = await db
    .from('student_financial_accounts')
    .select('id, student_id')
    .in('id', accountIds)

  if (!accounts?.length) return { ok: true, count: 0 }

  const rows = (accounts as any[]).map(a => ({
    student_id:    a.student_id,
    account_id:    a.id,
    activity_type: 'PAYMENT_REMINDER',
    notes:         'Bulk reminder sent',
    created_by:    user.id,
  }))

  const { error } = await db.from('collection_activities').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/admin/finance')
  return { ok: true, count: rows.length }
}

// ── Update account status (force refresh overdue) ─────────────────────────────

export async function refreshAccountStatuses() {
  await requirePermission('manage_financials')
  const db = createServiceClient()

  await db.rpc('mark_overdue_installments' as any)
  await db.rpc('mark_broken_promises' as any)

  revalidatePath('/admin/finance')
  revalidatePath('/admin/finance/queue')
  revalidatePath('/portal/team-leader/finance')
  return { ok: true }
}

// ── Payment Promises ──────────────────────────────────────────────────────────

export async function addPaymentPromise(input: AddPromiseInput) {
  const user = await requirePermission('manage_financials')
  const db   = createServiceClient()

  const branchId = await resolveBranchIdForNote(db, input.account_id, input.student_id)
  if (!branchId) return { error: 'Student or account not found' }
  try { assertBranchAccess(user, branchId) } catch { return { error: 'Not authorized for this branch' } }

  const { error } = await db.from('payment_promises').insert({
    student_id:      input.student_id,
    account_id:      input.account_id ?? null,
    promised_amount: input.promised_amount,
    promised_date:   input.promised_date,
    notes:           input.notes ?? null,
    status:          'ACTIVE',
    created_by:      user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/finance')
  revalidatePath('/admin/finance/queue')
  return { ok: true }
}

export async function markPromiseFulfilled(promiseId: string) {
  await requirePermission('manage_financials')
  const db = createServiceClient()

  const { error } = await db
    .from('payment_promises')
    .update({ status: 'FULFILLED', updated_at: new Date().toISOString() })
    .eq('id', promiseId)

  if (error) return { error: error.message }
  revalidatePath('/admin/finance')
  revalidatePath('/admin/finance/queue')
  return { ok: true }
}

export async function markPromiseBroken(promiseId: string) {
  await requirePermission('manage_financials')
  const db = createServiceClient()

  const { error } = await db
    .from('payment_promises')
    .update({ status: 'BROKEN', updated_at: new Date().toISOString() })
    .eq('id', promiseId)

  if (error) return { error: error.message }
  revalidatePath('/admin/finance')
  return { ok: true }
}

// ── Fetch promises for modal ───────────────────────────────────────────────────

export async function fetchAccountPromises(accountId: string) {
  await requirePermission('manage_financials')
  return getAccountPromises(accountId)
}

// ── Update account discount ────────────────────────────────────────────────────

export async function updateAccountDiscount(accountId: string, discountAmount: number) {
  const user = await requirePermission('manage_financials')
  const db   = createServiceClient()

  // Get current total + branch for access check
  const { data: acc } = await db
    .from('student_financial_accounts')
    .select('total_amount, branch_id')
    .eq('id', accountId)
    .single()

  if (!acc) return { error: 'Account not found' }
  assertBranchAccess(user, (acc as any).branch_id)

  const totalAmount = Number((acc as any).total_amount)
  if (discountAmount > totalAmount) return { error: 'Discount cannot exceed total amount' }

  const { error } = await db
    .from('student_financial_accounts')
    .update({
      discount_amount: discountAmount,
      net_amount:      totalAmount - discountAmount,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', accountId)

  if (error) return { error: error.message }
  revalidatePath('/admin/finance')
  revalidatePath('/portal/team-leader/finance')
  return { ok: true }
}
