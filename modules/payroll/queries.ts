import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  PayrollRun, PayrollRunWithItems, PayrollItemRow, PayrollDetailItem,
  PayrollAdjustment, PayrollSessionSnapshot, PayrollKPIs, PayrollWarning,
} from './types'

// ── Helpers ────────────────────────────────────────────────────────────────────

function instructorName(inst: any): string {
  const prof = inst?.users?.profiles ?? {}
  return [prof.first_name, prof.last_name].filter(Boolean).join(' ') || '—'
}

function resolveStaffName(row: any): string {
  if (row.instructors) return instructorName(row.instructors)
  if (row.staff_payroll_profiles) {
    const prof = row.staff_payroll_profiles?.users?.profiles ?? {}
    return [prof.first_name, prof.last_name].filter(Boolean).join(' ') || '—'
  }
  return '—'
}

function resolveStaffRole(row: any): string {
  if (row.staff_payroll_profiles?.role) return row.staff_payroll_profiles.role as string
  if (row.instructors) return 'instructor'
  return 'instructor'
}

// ── List payroll runs for a branch ────────────────────────────────────────────

export async function getPayrollRuns(
  branchId: string,
  limit = 12,
): Promise<PayrollRun[]> {
  const db = createServiceClient()
  const { data } = await db
    .from('payroll_runs')
    .select('*')
    .eq('branch_id', branchId)
    .neq('status', 'archived')
    .order('year',  { ascending: false })
    .order('month', { ascending: false })
    .limit(limit)
  return (data ?? []) as PayrollRun[]
}

// ── Get a single payroll run with all items ────────────────────────────────────

export async function getPayrollRunWithItems(
  month:    number,
  year:     number,
  branchId: string,
): Promise<PayrollRunWithItems | null> {
  const db = createServiceClient()

  const { data: run } = await db
    .from('payroll_runs')
    .select('*')
    .eq('branch_id', branchId)
    .eq('month', month)
    .eq('year',  year)
    .maybeSingle()

  if (!run) return null

  const items = await getPayrollItemsForRun((run as PayrollRun).id)
  return { ...(run as PayrollRun), items }
}

// ── Get items for a run ────────────────────────────────────────────────────────

export async function getPayrollItemsForRun(runId: string): Promise<PayrollItemRow[]> {
  const db = createServiceClient()

  const { data } = await db
    .from('payroll_items')
    .select(`
      *,
      instructors!payroll_items_instructor_id_fkey(
        users!instructors_user_id_fkey(
          profiles!profiles_user_id_fkey(first_name, last_name)
        )
      ),
      staff_payroll_profiles!payroll_items_staff_profile_id_fkey(
        role,
        users!staff_payroll_profiles_user_id_fkey(
          profiles!profiles_user_id_fkey(first_name, last_name)
        )
      )
    `)
    .eq('payroll_run_id', runId)
    .order('final_amount', { ascending: false })

  return ((data ?? []) as any[]).map(row => {
    const name = resolveStaffName(row)
    const role = resolveStaffRole(row)
    return {
      ...row,
      staff_name:        name,
      staff_role:        role,
      staff_avatar:      null,
      instructor_name:   name,
      instructor_avatar: null,
      instructors:             undefined,
      staff_payroll_profiles:  undefined,
    } as PayrollItemRow
  })
}

// ── Get a single payroll item with adjustments + snapshots ────────────────────

export async function getPayrollItemDetail(itemId: string): Promise<PayrollDetailItem | null> {
  const db = createServiceClient()

  const [itemRes, adjRes, snapshotRes] = await Promise.all([
    db.from('payroll_items')
      .select(`
        *,
        instructors!payroll_items_instructor_id_fkey(
          users!instructors_user_id_fkey(
            profiles!profiles_user_id_fkey(first_name, last_name)
          )
        ),
        staff_payroll_profiles!payroll_items_staff_profile_id_fkey(
          role,
          users!staff_payroll_profiles_user_id_fkey(
            profiles!profiles_user_id_fkey(first_name, last_name)
          )
        )
      `)
      .eq('id', itemId)
      .maybeSingle(),
    db.from('payroll_adjustments')
      .select('*')
      .eq('payroll_item_id', itemId)
      .order('created_at', { ascending: true }),
    db.from('payroll_session_snapshots')
      .select('*')
      .eq('payroll_item_id', itemId)
      .order('session_date', { ascending: true })
      .order('session_number', { ascending: true }),
  ])

  if (!itemRes.data) return null

  const row  = itemRes.data as any
  const name = resolveStaffName(row)
  const role = resolveStaffRole(row)
  return {
    ...row,
    staff_name:        name,
    staff_role:        role,
    staff_avatar:      null,
    instructor_name:   name,
    instructor_avatar: null,
    instructors:            undefined,
    staff_payroll_profiles: undefined,
    adjustments: (adjRes.data ?? []) as PayrollAdjustment[],
    snapshots:   (snapshotRes.data ?? []) as PayrollSessionSnapshot[],
  } as PayrollDetailItem
}

// ── KPI summary for a payroll run ─────────────────────────────────────────────

export async function getPayrollRunKPIs(runId: string): Promise<PayrollKPIs> {
  const db = createServiceClient()

  const [runRes, itemsRes, adjRes] = await Promise.all([
    db.from('payroll_runs').select('total_amount').eq('id', runId).single(),
    db.from('payroll_items')
      .select('gross_amount, final_amount, sessions_count, status, currency, instructor_id, staff_profile_id, payroll_type')
      .eq('payroll_run_id', runId),
    db.from('payroll_adjustments')
      .select('type, amount, payroll_item_id')
      .in('payroll_item_id',
        // sub-select would be cleaner but we fetch items first
        []
      ),
  ])

  const items = (itemsRes.data ?? []) as any[]

  const draft_amount    = items.filter(i => i.status === 'draft').reduce((s: number, i: any) => s + Number(i.final_amount), 0)
  const approved_amount = items.filter(i => i.status === 'approved').reduce((s: number, i: any) => s + Number(i.final_amount), 0)
  const paid_amount     = items.filter(i => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.final_amount), 0)
  const session_count   = items.reduce((s: number, i: any) => s + Number(i.sessions_count), 0)
  const currency        = items[0]?.currency ?? 'EGP'
  const instructor_count = items.filter(i => i.instructor_id != null || (i.staff_profile_id != null && i.payroll_type !== 'fixed_salary')).length
  const employee_count   = items.filter(i => i.staff_profile_id != null && i.payroll_type === 'fixed_salary').length

  // Get bonus/advance totals from adjustments
  const itemIds = items.map(i => i.id as string).filter(Boolean)
  let bonus_total   = 0
  let advance_total = 0

  if (itemIds.length > 0) {
    const { data: adjs } = await db
      .from('payroll_adjustments')
      .select('type, amount')
      .in('payroll_item_id', itemIds)
    for (const adj of (adjs ?? []) as any[]) {
      if (adj.type === 'bonus' || adj.type === 'allowance') bonus_total += Number(adj.amount)
      if (adj.type === 'advance') advance_total += Math.abs(Number(adj.amount))
    }
  }

  return {
    total_amount:     Number((runRes.data as any)?.total_amount ?? 0),
    draft_amount,
    approved_amount,
    paid_amount,
    instructor_count,
    employee_count,
    session_count,
    bonus_total,
    advance_total,
    currency,
  }
}

// ── Dashboard widget query ─────────────────────────────────────────────────────
// Returns the current month's payroll summary for TL dashboard display.

export async function getDashboardPayrollSummary(
  branchIds: string[],
): Promise<{ total_amount: number; pending_amount: number; paid_amount: number; has_run: boolean; currency: string }> {
  if (!branchIds.length) return { total_amount: 0, pending_amount: 0, paid_amount: 0, has_run: false, currency: 'EGP' }

  const db    = createServiceClient()
  const now   = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()

  const { data: runs } = await db
    .from('payroll_runs')
    .select('id, total_amount, status')
    .in('branch_id', branchIds)
    .eq('month', month)
    .eq('year',  year)
    .neq('status', 'archived')

  if (!runs?.length) return { total_amount: 0, pending_amount: 0, paid_amount: 0, has_run: false, currency: 'EGP' }

  const runIds = runs.map((r: any) => r.id as string)

  const { data: items } = await db
    .from('payroll_items')
    .select('final_amount, status, currency')
    .in('payroll_run_id', runIds)

  const rows = (items ?? []) as any[]
  const total_amount   = rows.reduce((s: number, i: any) => s + Number(i.final_amount), 0)
  const pending_amount = rows.filter(i => i.status !== 'paid').reduce((s: number, i: any) => s + Number(i.final_amount), 0)
  const paid_amount    = rows.filter(i => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.final_amount), 0)
  const currency       = rows[0]?.currency ?? 'EGP'

  return { total_amount, pending_amount, paid_amount, has_run: true, currency }
}

// ── Instructor warnings ────────────────────────────────────────────────────────
// Detect instructors in branch with missing or zero rate.

export async function getPayrollWarnings(branchId: string): Promise<PayrollWarning[]> {
  const db = createServiceClient()

  const { data } = await db
    .from('instructor_branches')
    .select(`
      instructor_id,
      instructors!instructor_branches_instructor_id_fkey(
        id, salary_per_session, status,
        users!instructors_user_id_fkey(
          profiles!profiles_user_id_fkey(first_name, last_name)
        )
      )
    `)
    .eq('branch_id', branchId)

  const warnings: PayrollWarning[] = []

  for (const row of (data ?? []) as any[]) {
    const inst = row.instructors
    if (!inst || inst.status === 'deleted') continue

    const name = instructorName(inst)

    if (inst.salary_per_session == null) {
      warnings.push({
        type:            'missing_rate',
        instructor_id:   inst.id,
        instructor_name: name,
        message:         `${name} has no session rate set. They will be included in payroll with rate = 0.`,
      })
    } else if (Number(inst.salary_per_session) === 0) {
      warnings.push({
        type:            'zero_rate',
        instructor_id:   inst.id,
        instructor_name: name,
        message:         `${name} has a session rate of 0. Their payroll will be EGP 0.`,
      })
    }
  }

  return warnings
}
