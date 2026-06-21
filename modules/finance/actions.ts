'use server'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission }   from '@/modules/rbac/guards'
import { revalidatePath }       from 'next/cache'
import { logTimelineEvent }     from '@/lib/timeline'
import type {
  AddPaymentInput, AddNoteInput, AddActivityInput,
  CreateAccountInput, AddInstallmentInput, AddPromiseInput,
  QuickPaymentInput, CreateReversalInput, AddExpenseInput,
  AddRecurringExpenseInput,
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

export async function addPayment(
  input: AddPaymentInput
): Promise<{ ok: true; paid_amount: number; remaining_amount: number } | { error: string }> {
  const user = await requirePermission('manage_financials')
  const db   = createServiceClient()

  const branchId = await getAccountBranchId(db, input.account_id)
  if (!branchId) return { error: 'Account not found' }
  assertBranchAccess(user, branchId)

  // Resolve enrollment_id: explicit > via SFA
  let enrollmentId = input.enrollment_id ?? null
  if (!enrollmentId) {
    const { data: sfa } = await db
      .from('student_financial_accounts')
      .select('enrollment_id')
      .eq('id', input.account_id)
      .maybeSingle()
    enrollmentId = (sfa as any)?.enrollment_id ?? null
  }

  // Determine allocation strategy
  const strategy: import('./types').AllocationStrategy =
    input.enrollment_id ? 'MANUAL' : (input.allocation_strategy ?? 'AUTO_FIFO')

  const { error } = await db.from('finance_payments').insert({
    student_id:          input.student_id,
    account_id:          input.account_id,
    enrollment_id:       enrollmentId,
    installment_id:      input.installment_id ?? null,
    amount:              input.amount,
    payment_date:        input.payment_date,
    payment_method:      input.payment_method,
    reference_number:    input.reference_number ?? null,
    notes:               input.notes ?? null,
    allocation_strategy: strategy,
    receipt_url:         input.receipt_url   ?? null,
    receipt_image:       input.receipt_image ?? null,
    receipt_notes:       input.receipt_notes ?? null,
    created_by:          user.id,
  })

  if (error) return { error: error.message }

  // Explicit balance recompute — ensures correctness even if trigger missed
  const { data: balRow } = await db.rpc('recompute_account_balance' as any, {
    p_account_id: input.account_id,
  })
  const bal = (balRow as any[])?.[0]

  // Timeline event (non-fatal)
  await logTimelineEvent({
    student_id:    input.student_id,
    enrollment_id: enrollmentId,
    account_id:    input.account_id,
    event_type:    'PAYMENT',
    notes:         `EGP ${input.amount} via ${input.payment_method}${input.reference_number ? ` (${input.reference_number})` : ''}`,
    created_by:    user.id,
    branch_id:     branchId ?? undefined,
  })

  revalidatePath('/admin/finance')
  revalidatePath('/portal/team-leader/finance')
  revalidatePath('/portal/team-leader/collections')
  revalidatePath('/portal/parent/finance')

  return {
    ok:               true as const,
    paid_amount:      Number(bal?.paid_amount      ?? 0),
    remaining_amount: Number(bal?.remaining_amount ?? 0),
  }
}

// ── Quick payment (one-click collection) ──────────────────────────────────────
// Records a fast cash payment. 'full' pays the entire remaining balance.

export async function quickPayment(
  input: QuickPaymentInput
): Promise<{ ok: true; paid_amount: number; remaining_amount: number } | { error: string }> {
  const user = await requirePermission('manage_financials')
  const db   = createServiceClient()

  const branchId = await getAccountBranchId(db, input.account_id)
  if (!branchId) return { error: 'Account not found' }
  assertBranchAccess(user, branchId)

  // Resolve amount
  let amount: number
  if (input.amount === 'full') {
    const { data: acc } = await db
      .from('student_financial_accounts')
      .select('remaining_amount')
      .eq('id', input.account_id)
      .single()
    amount = Number((acc as any)?.remaining_amount ?? 0)
    if (amount <= 0) return { error: 'No remaining balance' }
  } else {
    amount = input.amount
    if (amount <= 0) return { error: 'Amount must be positive' }
  }

  // Resolve enrollment_id
  let enrollmentId = input.enrollment_id ?? null
  if (!enrollmentId) {
    const { data: sfa } = await db
      .from('student_financial_accounts')
      .select('enrollment_id')
      .eq('id', input.account_id)
      .maybeSingle()
    enrollmentId = (sfa as any)?.enrollment_id ?? null
  }

  const today = new Date().toISOString().slice(0, 10)

  const { error: payErr } = await db.from('finance_payments').insert({
    student_id:          input.student_id,
    account_id:          input.account_id,
    enrollment_id:       enrollmentId,
    amount,
    payment_date:        today,
    payment_method:      input.method ?? 'cash',
    allocation_strategy: enrollmentId ? 'MANUAL' : 'AUTO_FIFO',
    notes:               `Quick payment — EGP ${amount}`,
    created_by:          user.id,
  })

  if (payErr) return { error: payErr.message }

  // Explicit balance recompute — guarantees correctness regardless of trigger state
  const { data: balRow } = await db.rpc('recompute_account_balance' as any, {
    p_account_id: input.account_id,
  })
  const bal = (balRow as any[])?.[0]

  revalidatePath('/portal/team-leader/finance')
  revalidatePath('/portal/team-leader/collections')
  revalidatePath('/admin/finance')
  revalidatePath('/portal/parent/finance')

  return {
    ok:               true as const,
    paid_amount:      Number(bal?.paid_amount      ?? 0),
    remaining_amount: Number(bal?.remaining_amount ?? 0),
  }
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
    student_id:    input.student_id,
    account_id:    input.account_id    ?? null,
    enrollment_id: input.enrollment_id ?? null,
    note_text:     input.note_text,
    is_internal:   input.is_internal,
    created_by:    user.id,
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
    account_id:    input.account_id    ?? null,
    enrollment_id: input.enrollment_id ?? null,
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
    account_id:      input.account_id    ?? null,
    enrollment_id:   input.enrollment_id ?? null,
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

// ── Create payment reversal (Sprint 44) ───────────────────────────────────────
// Immutable. Records a reversal/refund as a new negative ledger entry.
// Does NOT delete the original payment.

export async function createReversal(input: CreateReversalInput) {
  const user = await requirePermission('manage_financials')
  const db   = createServiceClient()

  // Load original payment
  const { data: original, error: loadErr } = await db
    .from('finance_payments')
    .select('id, student_id, account_id, enrollment_id, amount')
    .eq('id', input.original_payment_id)
    .single()

  if (loadErr || !original) return { error: 'Original payment not found' }
  const o = original as any

  const branchId = await getAccountBranchId(db, o.account_id)
  if (!branchId) return { error: 'Account not found' }
  try { assertBranchAccess(user, branchId) } catch { return { error: 'Not authorized for this branch' } }

  const amount = Math.min(input.amount, Number(o.amount))
  if (amount <= 0) return { error: 'Reversal amount must be positive and <= original amount' }

  // Record the reversal in the audit table
  const { error: revErr } = await db.from('finance_payment_reversals').insert({
    original_payment_id: input.original_payment_id,
    enrollment_id:       o.enrollment_id ?? null,
    account_id:          o.account_id,
    student_id:          o.student_id,
    amount,
    reversal_type:       input.reversal_type ?? 'REVERSAL',
    reason:              input.reason ?? null,
    created_by:          user.id,
  })
  if (revErr) return { error: revErr.message }

  // Insert a negative ledger entry to debit the balance
  // Requires migration 0102 which drops the CHECK (amount > 0) constraint.
  const { error: payErr } = await db.from('finance_payments').insert({
    student_id:     o.student_id,
    account_id:     o.account_id,
    enrollment_id:  o.enrollment_id ?? null,
    amount:         -amount,
    payment_date:   new Date().toISOString().slice(0, 10),
    payment_method: 'cash',
    notes:          `${input.reversal_type ?? 'REVERSAL'}: ${input.reason ?? 'No reason provided'} (original payment ${input.original_payment_id})`,
    created_by:     user.id,
  })
  if (payErr) return { error: `Failed to debit balance: ${payErr.message}` }

  // Recompute the account balance so totals are immediately consistent
  await db.rpc('recompute_account_balance' as any, { p_account_id: o.account_id })

  revalidatePath('/portal/team-leader/finance')
  revalidatePath('/admin/finance')
  revalidatePath('/portal/parent/finance')
  revalidatePath('/portal/team-leader/groups')

  return { ok: true }
}

// ── Phase XXVII: Expense CRUD ─────────────────────────────────────────────────

export async function addExpense(input: AddExpenseInput) {
  const user = await requirePermission('manage_financials')
  const db   = createServiceClient()

  const { error, data } = await db
    .from('financial_expenses')
    .insert({
      expense_scope: input.expense_scope,
      expense_type:  input.expense_type,
      group_id:      input.group_id  ?? null,
      branch_id:     input.branch_id ?? null,
      amount:        input.amount,
      expense_date:  input.expense_date,
      notes:         input.notes ?? null,
      created_by:    user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/admin/revenue')
  revalidatePath('/admin/expenses')
  revalidatePath('/admin/finance')
  return { ok: true, id: (data as any).id as string }
}

export async function updateExpense(id: string, input: Partial<AddExpenseInput>) {
  await requirePermission('manage_financials')
  const db = createServiceClient()

  const { error } = await db
    .from('financial_expenses')
    .update({
      ...(input.expense_scope && { expense_scope: input.expense_scope }),
      ...(input.expense_type  && { expense_type:  input.expense_type }),
      ...(input.group_id  !== undefined && { group_id:  input.group_id  ?? null }),
      ...(input.branch_id !== undefined && { branch_id: input.branch_id ?? null }),
      ...(input.amount        && { amount:        input.amount }),
      ...(input.expense_date  && { expense_date:  input.expense_date }),
      ...(input.notes !== undefined && { notes: input.notes ?? null }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/revenue')
  revalidatePath('/admin/expenses')
  return { ok: true }
}

export async function deleteExpense(id: string) {
  await requirePermission('manage_financials')
  const db = createServiceClient()

  const { error } = await db
    .from('financial_expenses')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/revenue')
  revalidatePath('/admin/expenses')
  return { ok: true }
}

// ── Phase XXVIII: Recurring Expense CRUD ──────────────────────────────────────

export async function addRecurringExpense(input: AddRecurringExpenseInput) {
  const user = await requirePermission('manage_financials')
  const db   = createServiceClient()

  const { error, data } = await db
    .from('recurring_expenses')
    .insert({
      expense_scope: input.expense_scope,
      expense_type:  input.expense_type,
      group_id:      input.group_id  ?? null,
      branch_id:     input.branch_id ?? null,
      amount:        input.amount,
      start_date:    input.start_date,
      end_date:      input.end_date  ?? null,
      notes:         input.notes     ?? null,
      created_by:    user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/admin/revenue')
  revalidatePath('/admin/expenses')
  return { ok: true, id: (data as any).id as string }
}

export async function updateRecurringExpense(id: string, input: Partial<AddRecurringExpenseInput>) {
  await requirePermission('manage_financials')
  const db = createServiceClient()

  const { error } = await db
    .from('recurring_expenses')
    .update({
      ...(input.expense_scope !== undefined && { expense_scope: input.expense_scope }),
      ...(input.expense_type  !== undefined && { expense_type:  input.expense_type  }),
      ...(input.group_id      !== undefined && { group_id:      input.group_id  ?? null }),
      ...(input.branch_id     !== undefined && { branch_id:     input.branch_id ?? null }),
      ...(input.amount        !== undefined && { amount:        input.amount        }),
      ...(input.start_date    !== undefined && { start_date:    input.start_date    }),
      ...(input.end_date      !== undefined && { end_date:      input.end_date ?? null }),
      ...(input.notes         !== undefined && { notes:         input.notes    ?? null }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/revenue')
  revalidatePath('/admin/expenses')
  return { ok: true }
}

export async function toggleRecurringExpense(id: string, isActive: boolean) {
  await requirePermission('manage_financials')
  const db = createServiceClient()

  const { error } = await db
    .from('recurring_expenses')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/revenue')
  revalidatePath('/admin/expenses')
  return { ok: true }
}

export async function deleteRecurringExpense(id: string) {
  await requirePermission('manage_financials')
  const db = createServiceClient()

  const { error } = await db.from('recurring_expenses').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/revenue')
  revalidatePath('/admin/expenses')
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
