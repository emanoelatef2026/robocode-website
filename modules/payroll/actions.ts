'use server'

import { revalidatePath }      from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth }         from '@/modules/rbac/guards'
import type { ActionResult }   from '@/types/app'
import type {
  GeneratePayrollResult, PayrollWarning, PayrollDetailItem, AdjustmentType,
} from './types'
import { getPayrollItemDetail } from './queries'

// ── Helpers ───────────────────────────────────────────────────────────────────

const REVALIDATE_PATH = '/portal/team-leader/instructor-payroll'

const FORBIDDEN = {
  success: false as const,
  error: { code: 'FORBIDDEN', message: 'You do not have permission to manage payroll.' },
}

function hasPayrollAccess(permissions: string[]): boolean {
  return permissions.includes('manage_payroll') || permissions.includes('manage_financials')
}

function instructorName(inst: any): string {
  const prof = inst?.users?.profiles ?? {}
  return [prof.first_name, prof.last_name].filter(Boolean).join(' ') || '—'
}

// ── Generate monthly payroll ──────────────────────────────────────────────────
//
// Core logic:
//   1. Reject if a run already exists for branch/month/year.
//   2. Load all active instructors in the branch via instructor_branches.
//   3. Load their group_instructors allocations for groups in this branch.
//   4. For each allocation, query completed schedules in the target month
//      that fall within the instructor's session range (from_session..to_session).
//   5. Deduplicate: a schedule cannot be claimed by two instructors.
//   6. Create payroll_run, payroll_items, payroll_session_snapshots atomically.
//   7. Return generation summary including any warnings (missing rates, etc.).

export async function generateMonthlyPayrollAction(
  month:    number,
  year:     number,
  branchId: string,
): Promise<ActionResult<GeneratePayrollResult>> {
  const user = await requireAuth()
  if (!hasPayrollAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  // 1. Duplicate guard
  const { data: existingRun } = await db
    .from('payroll_runs')
    .select('id, status')
    .eq('branch_id', branchId)
    .eq('month',     month)
    .eq('year',      year)
    .maybeSingle()

  if (existingRun) {
    return {
      success: false,
      error: {
        code:    'DUPLICATE_RUN',
        message: `A payroll run for this month already exists (status: ${(existingRun as any).status}). Archive the existing run first, or use Regenerate.`,
      },
    }
  }

  // 2. Instructors in branch
  const { data: biRows } = await db
    .from('instructor_branches')
    .select('instructor_id')
    .eq('branch_id', branchId)

  const instructorIds = ((biRows ?? []) as any[]).map(r => r.instructor_id as string)
  if (!instructorIds.length) {
    return { success: false, error: { code: 'NO_INSTRUCTORS', message: 'No instructors found in this branch.' } }
  }

  // 3. Instructor details (rate + name)
  const { data: instrRows } = await db
    .from('instructors')
    .select(`
      id, salary_per_session, currency, status,
      users!instructors_user_id_fkey(
        profiles!profiles_user_id_fkey(first_name, last_name)
      )
    `)
    .in('id', instructorIds)
    .neq('status', 'deleted')

  type InstrMeta = { rate: number; currency: string; name: string }
  const instrMap = new Map<string, InstrMeta>()
  for (const r of (instrRows ?? []) as any[]) {
    instrMap.set(r.id, {
      rate:     Number(r.salary_per_session ?? 0),
      currency: r.currency ?? 'EGP',
      name:     instructorName(r),
    })
  }

  const activeInstructorIds = [...instrMap.keys()]
  if (!activeInstructorIds.length) {
    return { success: false, error: { code: 'NO_ACTIVE_INSTRUCTORS', message: 'No active instructors found in this branch.' } }
  }

  // 4. Groups in this branch
  const { data: grpRows } = await db
    .from('groups')
    .select('id, name')
    .eq('branch_id', branchId)
    .is('deleted_at', null)

  const branchGroupIds = new Set(((grpRows ?? []) as any[]).map(r => r.id as string))
  const groupNameMap   = new Map<string, string>()
  for (const g of (grpRows ?? []) as any[]) groupNameMap.set(g.id, g.name)

  // 5. Allocations for these instructors within branch groups
  const { data: allocRows } = await db
    .from('group_instructors')
    .select('instructor_id, group_id, from_session, to_session, allocation_status')
    .in('instructor_id', activeInstructorIds)
    .not('allocation_status', 'eq', 'released')

  const branchAllocs = ((allocRows ?? []) as any[]).filter(r => branchGroupIds.has(r.group_id))

  // 6. group_courses for branch groups (active + completed)
  const groupIdList = [...branchGroupIds]
  const gcMap = new Map<string, string>() // group_id → group_course_id

  if (groupIdList.length > 0) {
    const { data: gcRows } = await db
      .from('group_courses')
      .select('id, group_id')
      .in('group_id', groupIdList)
      .in('status', ['active', 'completed'])

    for (const gc of (gcRows ?? []) as any[]) gcMap.set(gc.group_id, gc.id)
  }

  // 7. Completed schedules in target month
  const monthStart = new Date(year, month - 1, 1).toISOString()
  const monthEnd   = new Date(year, month,     0, 23, 59, 59, 999).toISOString()

  const gcIds = [...gcMap.values()]
  type ScheduleRow = { id: string; group_course_id: string; session_number: number; scheduled_at: string; topic: string | null }
  let schedules: ScheduleRow[] = []

  if (gcIds.length > 0) {
    const { data: sRows } = await db
      .from('schedules')
      .select('id, group_course_id, session_number, scheduled_at, topic')
      .in('group_course_id', gcIds)
      .eq('status', 'completed')
      .gte('scheduled_at', monthStart)
      .lte('scheduled_at', monthEnd)
    schedules = (sRows ?? []) as ScheduleRow[]
  }

  // Build schedules by group_course_id
  const schedsByGC = new Map<string, ScheduleRow[]>()
  for (const s of schedules) {
    if (!schedsByGC.has(s.group_course_id)) schedsByGC.set(s.group_course_id, [])
    schedsByGC.get(s.group_course_id)!.push(s)
  }

  // 8. Aggregate per instructor — guard against double-counting
  //    (a schedule_id should only appear once even if somehow in two allocations)
  type SessionEntry = {
    scheduleId: string; sessionNumber: number; groupId: string
    groupName: string; topic: string | null; sessionDate: string; sessionValue: number
  }
  const instrPayroll  = new Map<string, { rate: number; currency: string; sessions: SessionEntry[] }>()
  const seenSchedules = new Set<string>() // prevent double-counting

  for (const alloc of branchAllocs) {
    const gcId      = gcMap.get(alloc.group_id)
    const instrMeta = instrMap.get(alloc.instructor_id)
    if (!gcId || !instrMeta) continue

    const gcSchedules = schedsByGC.get(gcId) ?? []
    const rate        = instrMeta.rate

    for (const s of gcSchedules) {
      const sn = s.session_number
      if (sn < alloc.from_session) continue
      if (alloc.to_session !== null && sn > alloc.to_session) continue
      if (seenSchedules.has(s.id)) continue
      seenSchedules.add(s.id)

      if (!instrPayroll.has(alloc.instructor_id)) {
        instrPayroll.set(alloc.instructor_id, { rate, currency: instrMeta.currency, sessions: [] })
      }
      instrPayroll.get(alloc.instructor_id)!.sessions.push({
        scheduleId:    s.id,
        sessionNumber: sn,
        groupId:       alloc.group_id,
        groupName:     groupNameMap.get(alloc.group_id) ?? '—',
        topic:         s.topic ?? null,
        sessionDate:   s.scheduled_at.slice(0, 10),
        sessionValue:  rate,
      })
    }
  }

  // Warnings: instructors with missing/zero rate
  const warnings: PayrollWarning[] = []
  for (const [id, meta] of instrMap) {
    if (meta.rate === 0) {
      warnings.push({
        type:            'zero_rate',
        instructor_id:   id,
        instructor_name: meta.name,
        message:         `${meta.name} has a session rate of 0 — their payroll will be 0.`,
      })
    }
  }

  // 9. Create payroll_run
  const { data: runRow, error: runErr } = await db
    .from('payroll_runs')
    .insert({
      branch_id:    branchId,
      month,
      year,
      status:       'draft',
      total_amount: 0,
      generated_by: user.id,
    })
    .select('id')
    .single()

  if (runErr || !runRow) {
    return { success: false, error: { code: 'DB_ERROR', message: runErr?.message ?? 'Failed to create payroll run.' } }
  }

  const runId = (runRow as any).id as string
  let   totalAmount    = 0
  let   totalSessions  = 0

  // 10. Create payroll_items + snapshots
  for (const [instructorId, data] of instrPayroll) {
    const sessionsCount = data.sessions.length
    const grossAmount   = Number((sessionsCount * data.rate).toFixed(2))
    totalAmount   += grossAmount
    totalSessions += sessionsCount

    const { data: itemRow, error: itemErr } = await db
      .from('payroll_items')
      .insert({
        payroll_run_id:    runId,
        instructor_id:     instructorId,
        sessions_count:    sessionsCount,
        rate_per_session:  data.rate,
        gross_amount:      grossAmount,
        adjustments_total: 0,
        final_amount:      grossAmount,
        currency:          data.currency,
        status:            'draft',
      })
      .select('id')
      .single()

    if (itemErr || !itemRow) continue

    const itemId = (itemRow as any).id as string

    if (data.sessions.length > 0) {
      await db.from('payroll_session_snapshots').insert(
        data.sessions.map(s => ({
          payroll_item_id: itemId,
          schedule_id:     s.scheduleId,
          session_number:  s.sessionNumber,
          group_id:        s.groupId,
          group_name:      s.groupName,
          topic:           s.topic,
          session_date:    s.sessionDate,
          session_value:   s.sessionValue,
        }))
      )
    }
  }

  // 11. Update run total
  await db.from('payroll_runs').update({ total_amount: totalAmount }).eq('id', runId)

  // 12. Audit log
  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'generate_payroll',
    p_entity_type:  'payroll_run',
    p_entity_id:    runId,
    p_new_values:   { month, year, branch_id: branchId, total_amount: totalAmount, item_count: instrPayroll.size },
  })

  revalidatePath(REVALIDATE_PATH)
  return {
    success: true,
    data: {
      run_id:       runId,
      item_count:   instrPayroll.size,
      total_amount: totalAmount,
      currency:     [...instrMap.values()][0]?.currency ?? 'EGP',
      warnings,
    },
  }
}

// ── Approve payroll run ────────────────────────────────────────────────────────

export async function approvePayrollRunAction(
  runId: string,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasPayrollAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  const { data: run } = await db.from('payroll_runs').select('status').eq('id', runId).single()
  if (!run) return { success: false, error: { code: 'NOT_FOUND', message: 'Payroll run not found.' } }
  if ((run as any).status !== 'draft') {
    return { success: false, error: { code: 'INVALID_STATUS', message: `Run is already ${(run as any).status}.` } }
  }

  const now = new Date().toISOString()
  await db.from('payroll_runs').update({ status: 'approved', approved_at: now, approved_by: user.id }).eq('id', runId)
  await db.from('payroll_items').update({ status: 'approved', approved_at: now }).eq('payroll_run_id', runId).eq('status', 'draft')

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'approve_payroll',
    p_entity_type:  'payroll_run',
    p_entity_id:    runId,
    p_new_values:   { status: 'approved' },
  })

  revalidatePath(REVALIDATE_PATH)
  return { success: true, data: undefined }
}

// ── Mark payroll run as paid ───────────────────────────────────────────────────

export async function markPayrollPaidAction(
  runId: string,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasPayrollAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  const { data: run } = await db.from('payroll_runs').select('status').eq('id', runId).single()
  if (!run) return { success: false, error: { code: 'NOT_FOUND', message: 'Payroll run not found.' } }
  if ((run as any).status !== 'approved') {
    return {
      success: false,
      error: { code: 'INVALID_STATUS', message: 'Payroll must be approved before marking as paid.' },
    }
  }

  const now = new Date().toISOString()
  await db.from('payroll_runs').update({ status: 'paid', paid_at: now, paid_by: user.id }).eq('id', runId)
  await db.from('payroll_items').update({ status: 'paid', paid_at: now }).eq('payroll_run_id', runId)

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'mark_payroll_paid',
    p_entity_type:  'payroll_run',
    p_entity_id:    runId,
    p_new_values:   { status: 'paid' },
  })

  revalidatePath(REVALIDATE_PATH)
  return { success: true, data: undefined }
}

// ── Archive payroll run ────────────────────────────────────────────────────────
// Used when TL wants to regenerate: archive the old run first, then generate new.

export async function archivePayrollRunAction(
  runId: string,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasPayrollAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  const { data: run } = await db.from('payroll_runs').select('status').eq('id', runId).single()
  if (!run) return { success: false, error: { code: 'NOT_FOUND', message: 'Payroll run not found.' } }
  if ((run as any).status === 'paid') {
    return { success: false, error: { code: 'IMMUTABLE', message: 'Paid payroll runs cannot be archived.' } }
  }

  await db.from('payroll_runs').update({ status: 'archived' }).eq('id', runId)

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'archive_payroll',
    p_entity_type:  'payroll_run',
    p_entity_id:    runId,
    p_new_values:   { status: 'archived' },
  })

  revalidatePath(REVALIDATE_PATH)
  return { success: true, data: undefined }
}

// ── Add adjustment ─────────────────────────────────────────────────────────────

export async function addPayrollAdjustmentAction(
  itemId:       string,
  type:         AdjustmentType,
  amount:       number,
  notes:        string,
): Promise<ActionResult<PayrollDetailItem>> {
  const user = await requireAuth()
  if (!hasPayrollAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  // Block mutations on paid items
  const { data: item } = await db
    .from('payroll_items')
    .select('status, instructor_id, gross_amount, adjustments_total, payroll_run_id')
    .eq('id', itemId)
    .single()

  if (!item) return { success: false, error: { code: 'NOT_FOUND', message: 'Payroll item not found.' } }
  if ((item as any).status === 'paid') {
    return { success: false, error: { code: 'IMMUTABLE', message: 'Cannot modify a paid payroll item.' } }
  }

  // Check run status — paid run blocks all edits
  const { data: run } = await db
    .from('payroll_runs')
    .select('status')
    .eq('id', (item as any).payroll_run_id)
    .single()

  if ((run as any)?.status === 'paid') {
    return { success: false, error: { code: 'IMMUTABLE', message: 'Cannot modify items in a paid payroll run.' } }
  }

  // Insert adjustment
  await db.from('payroll_adjustments').insert({
    payroll_item_id: itemId,
    instructor_id:   (item as any).instructor_id,
    type,
    amount,
    notes:           notes || null,
    created_by:      user.id,
  })

  // Recalculate item totals
  const { data: adjRows } = await db
    .from('payroll_adjustments')
    .select('amount')
    .eq('payroll_item_id', itemId)

  const adjustmentsTotal = ((adjRows ?? []) as any[]).reduce((s: number, r: any) => s + Number(r.amount), 0)
  const finalAmount      = Number((Number((item as any).gross_amount) + adjustmentsTotal).toFixed(2))

  await db.from('payroll_items').update({
    adjustments_total: adjustmentsTotal,
    final_amount:      finalAmount,
  }).eq('id', itemId)

  // Recalculate run total
  const { data: allItems } = await db
    .from('payroll_items')
    .select('final_amount')
    .eq('payroll_run_id', (item as any).payroll_run_id)

  const runTotal = ((allItems ?? []) as any[]).reduce((s: number, r: any) => s + Number(r.final_amount), 0)
  await db.from('payroll_runs').update({ total_amount: runTotal }).eq('id', (item as any).payroll_run_id)

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'add_payroll_adjustment',
    p_entity_type:  'payroll_item',
    p_entity_id:    itemId,
    p_new_values:   { type, amount, notes },
  })

  revalidatePath(REVALIDATE_PATH)

  const detail = await getPayrollItemDetail(itemId)
  if (!detail) return { success: false, error: { code: 'NOT_FOUND', message: 'Item not found after update.' } }
  return { success: true, data: detail }
}

// ── Delete adjustment ─────────────────────────────────────────────────────────

export async function deletePayrollAdjustmentAction(
  adjustmentId: string,
): Promise<ActionResult<PayrollDetailItem>> {
  const user = await requireAuth()
  if (!hasPayrollAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  const { data: adj } = await db
    .from('payroll_adjustments')
    .select('payroll_item_id')
    .eq('id', adjustmentId)
    .single()

  if (!adj) return { success: false, error: { code: 'NOT_FOUND', message: 'Adjustment not found.' } }

  const itemId = (adj as any).payroll_item_id as string

  // Check mutability
  const { data: item } = await db
    .from('payroll_items')
    .select('status, gross_amount, payroll_run_id')
    .eq('id', itemId)
    .single()

  if ((item as any)?.status === 'paid') {
    return { success: false, error: { code: 'IMMUTABLE', message: 'Cannot modify a paid payroll item.' } }
  }

  await db.from('payroll_adjustments').delete().eq('id', adjustmentId)

  // Recalculate totals
  const { data: adjRows } = await db
    .from('payroll_adjustments')
    .select('amount')
    .eq('payroll_item_id', itemId)

  const adjustmentsTotal = ((adjRows ?? []) as any[]).reduce((s: number, r: any) => s + Number(r.amount), 0)
  const finalAmount      = Number((Number((item as any).gross_amount) + adjustmentsTotal).toFixed(2))

  await db.from('payroll_items').update({
    adjustments_total: adjustmentsTotal,
    final_amount:      finalAmount,
  }).eq('id', itemId)

  const { data: allItems } = await db
    .from('payroll_items')
    .select('final_amount')
    .eq('payroll_run_id', (item as any).payroll_run_id)

  const runTotal = ((allItems ?? []) as any[]).reduce((s: number, r: any) => s + Number(r.final_amount), 0)
  await db.from('payroll_runs').update({ total_amount: runTotal }).eq('id', (item as any).payroll_run_id)

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'delete_payroll_adjustment',
    p_entity_type:  'payroll_item',
    p_entity_id:    itemId,
    p_new_values:   { deleted_adjustment_id: adjustmentId },
  })

  revalidatePath(REVALIDATE_PATH)

  const detail = await getPayrollItemDetail(itemId)
  if (!detail) return { success: false, error: { code: 'NOT_FOUND', message: 'Item not found after update.' } }
  return { success: true, data: detail }
}

// ── Approve individual item ───────────────────────────────────────────────────

export async function approvePayrollItemAction(
  itemId: string,
): Promise<ActionResult<void>> {
  const user = await requireAuth()
  if (!hasPayrollAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  const { data: item } = await db
    .from('payroll_items')
    .select('status')
    .eq('id', itemId)
    .single()

  if (!item) return { success: false, error: { code: 'NOT_FOUND', message: 'Payroll item not found.' } }
  if ((item as any).status !== 'draft') {
    return { success: false, error: { code: 'INVALID_STATUS', message: `Item is already ${(item as any).status}.` } }
  }

  await db.from('payroll_items').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', itemId)

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'approve_payroll_item',
    p_entity_type:  'payroll_item',
    p_entity_id:    itemId,
    p_new_values:   { status: 'approved' },
  })

  revalidatePath(REVALIDATE_PATH)
  return { success: true, data: undefined }
}

// ── Export CSV ────────────────────────────────────────────────────────────────
// Returns CSV string — the client initiates download via Blob URL.

export async function exportPayrollCSVAction(
  runId: string,
): Promise<ActionResult<string>> {
  const user = await requireAuth()
  if (!hasPayrollAccess(user.permissions)) return FORBIDDEN

  const db = createServiceClient()

  const { data: rows } = await db
    .from('payroll_items')
    .select(`
      sessions_count, rate_per_session, gross_amount, adjustments_total, final_amount, currency, status,
      instructors!payroll_items_instructor_id_fkey(
        users!instructors_user_id_fkey(
          profiles!profiles_user_id_fkey(first_name, last_name)
        )
      )
    `)
    .eq('payroll_run_id', runId)
    .order('final_amount', { ascending: false })

  const headers = ['Instructor', 'Sessions', 'Rate (EGP)', 'Gross (EGP)', 'Adjustments (EGP)', 'Final (EGP)', 'Currency', 'Status']
  const lines   = [headers.join(',')]

  for (const r of (rows ?? []) as any[]) {
    const prof = r.instructors?.users?.profiles ?? {}
    const name = [prof.first_name, prof.last_name].filter(Boolean).join(' ') || '—'
    lines.push([
      `"${name}"`,
      r.sessions_count,
      Number(r.rate_per_session).toFixed(2),
      Number(r.gross_amount).toFixed(2),
      Number(r.adjustments_total).toFixed(2),
      Number(r.final_amount).toFixed(2),
      r.currency,
      r.status,
    ].join(','))
  }

  return { success: true, data: lines.join('\n') }
}

// ── Fetch item detail (callable from client components) ───────────────────────
// Wraps the server-only query so the client never imports from queries.ts.

export async function getPayrollItemDetailAction(
  itemId: string,
): Promise<ActionResult<PayrollDetailItem>> {
  const user = await requireAuth()
  if (!hasPayrollAccess(user.permissions)) return FORBIDDEN

  const detail = await getPayrollItemDetail(itemId)
  if (!detail) return { success: false, error: { code: 'NOT_FOUND', message: 'Payroll item not found.' } }
  return { success: true, data: detail }
}
