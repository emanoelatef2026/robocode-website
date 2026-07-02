import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { computeAdjTotals } from '@/modules/staff-finance/types'
import type { FinanceAdjustment, StaffPaymentRecord } from '@/modules/staff-finance/types'
import type {
  InstructorSessionEarning, SessionEarningFilters, SessionEarningType,
  InstructorPaymentOverview, InstructorMonthlyPaymentSummary, InstructorPaymentRecordRow,
  InstructorPaymentMethods,
} from './types'

const COMPLETING_STATUSES  = new Set(['completed'])
const PROJECTED_STATUSES   = new Set(['scheduled', 'ongoing'])

function sessionType(type: string | null): SessionEarningType {
  if (type === 'trial')  return 'trial'
  if (type === 'makeup') return 'makeup'
  return 'primary'
}

function monthBounds(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

// ── Resolve the branches an instructor works at ────────────────────────────────

export async function getInstructorBranchIds(instructorId: string, primaryBranchId: string): Promise<string[]> {
  const db = createServiceClient()
  const { data } = await db
    .from('instructor_branches')
    .select('branch_id')
    .eq('instructor_id', instructorId)

  const ids = new Set<string>([primaryBranchId])
  for (const r of (data ?? []) as any[]) ids.add(r.branch_id as string)
  return [...ids]
}

// ── Resolve (or lazily create) the staff_payroll_profiles row backing         ──
// ── this instructor's "paid" ledger (staff_payment_records).                 ──
// One row per (user_id, branch_id) — reuses the primary branch for the profile
// since staff_payment_records is recorded per-branch.

export async function resolveInstructorStaffProfileId(
  userId:   string,
  branchId: string,
): Promise<string> {
  const db = createServiceClient()

  const { data: existing } = await db
    .from('staff_payroll_profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('branch_id', branchId)
    .maybeSingle()

  if (existing) return (existing as any).id as string

  const { data: created, error } = await db
    .from('staff_payroll_profiles')
    .insert({
      user_id:            userId,
      branch_id:          branchId,
      role:               'instructor',
      payroll_type:       'per_session',
      basic_salary:       0,
      session_rate:       0,
      payment_method:     'cash',
      employment_status:  'active',
      works_all_branches: false,
    })
    .select('id')
    .single()

  if (created) return (created as any).id as string

  // Unique-violation race: another request created it first — re-select.
  if ((error as any)?.code === '23505') {
    const { data: retry } = await db
      .from('staff_payroll_profiles')
      .select('id')
      .eq('user_id', userId)
      .eq('branch_id', branchId)
      .single()
    if (retry) return (retry as any).id as string
  }

  throw new Error(`Failed to resolve staff payroll profile: ${error?.message ?? 'unknown error'}`)
}

// ── Session earnings (unified: regular group sessions + standalone trial/makeup) ─

export async function getInstructorSessionEarnings(
  instructorId: string,
  branchIds:    string[],
): Promise<InstructorSessionEarning[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  // 1. Base rate
  const { data: instrRow } = await db
    .from('instructors')
    .select('salary_per_session')
    .eq('id', instructorId)
    .maybeSingle()
  const baseRate = Number((instrRow as any)?.salary_per_session ?? 0)

  // 2. Group courses this instructor is linked to (direct lead OR group_instructors member)
  const [{ data: gcDirect }, { data: giRows }] = await Promise.all([
    db.from('group_courses').select('id, group_id').eq('instructor_id', instructorId),
    db.from('group_instructors').select('group_id, session_rate').eq('instructor_id', instructorId),
  ])

  const giGroupIds  = [...new Set((giRows ?? []).map((r: any) => r.group_id as string))]
  const groupRateMap = new Map<string, number | null>()
  for (const gi of (giRows ?? []) as any[]) {
    groupRateMap.set(gi.group_id, gi.session_rate != null ? Number(gi.session_rate) : null)
  }

  let gcFromGroups: any[] = []
  if (giGroupIds.length) {
    const { data } = await db.from('group_courses').select('id, group_id').in('group_id', giGroupIds)
    gcFromGroups = data ?? []
  }

  const gcMap = new Map<string, string>() // gcId -> groupId
  for (const gc of [...(gcDirect ?? []), ...gcFromGroups] as any[]) {
    gcMap.set(gc.id, gc.group_id)
  }
  const gcIds = [...gcMap.keys()]

  // 3. Session-instructor direct assignments (covers trial/makeup + explicit regular assignments)
  const { data: siRows } = await db
    .from('session_instructors')
    .select('session_id')
    .eq('instructor_id', instructorId)
  const directSessionIds = new Set<string>((siRows ?? []).map((r: any) => r.session_id as string))

  // 4. Fallback: regular sessions attributed via group_courses (historical, no session_instructors row)
  let fallbackSchedules: any[] = []
  if (gcIds.length) {
    const { data } = await db
      .from('schedules')
      .select('id, group_course_id, scheduled_at, type, status, topic, branch_id')
      .in('group_course_id', gcIds)
      .in('branch_id', branchIds)
    fallbackSchedules = (data ?? []).filter((s: any) => !directSessionIds.has(s.id))
  }

  // 5. Direct-assignment schedules (regular + standalone trial/makeup)
  let directSchedules: any[] = []
  if (directSessionIds.size) {
    const { data } = await db
      .from('schedules')
      .select('id, group_course_id, scheduled_at, type, status, topic, branch_id')
      .in('id', [...directSessionIds])
      .in('branch_id', branchIds)
    directSchedules = data ?? []
  }

  const allSchedules = [...fallbackSchedules, ...directSchedules]
  if (!allSchedules.length) return []

  // 6. Rate overrides
  const schedIds = allSchedules.map((s: any) => s.id as string)
  const { data: overrideData } = await db
    .from('payroll_session_overrides')
    .select('schedule_id, override_rate')
    .eq('instructor_id', instructorId)
    .in('schedule_id', schedIds)
  const overrideMap = new Map<string, number>()
  for (const ov of (overrideData ?? []) as any[]) {
    overrideMap.set(ov.schedule_id, Number(ov.override_rate))
  }

  // 7. Group names
  const groupIds = [...new Set([...gcMap.values()])]
  const { data: groupData } = groupIds.length
    ? await db.from('groups').select('id, name').in('id', groupIds)
    : { data: [] }
  const groupNames = new Map<string, string>()
  for (const g of (groupData ?? []) as any[]) groupNames.set(g.id, g.name)

  return allSchedules.map((s: any) => {
    const groupId    = s.group_course_id ? (gcMap.get(s.group_course_id) ?? null) : null
    const groupRate  = groupId ? (groupRateMap.get(groupId) ?? null) : null
    const overrideR  = overrideMap.get(s.id) ?? null
    const amount     = overrideR ?? groupRate ?? baseRate

    return {
      schedule_id:  s.id,
      scheduled_at: s.scheduled_at,
      session_type: sessionType(s.type),
      group_id:     groupId,
      group_name:   groupId ? (groupNames.get(groupId) ?? '—') : '—',
      topic:        s.topic ?? null,
      amount,
      status:       s.status,
    } satisfies InstructorSessionEarning
  }).sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
}

export function applySessionEarningFilters(
  rows:    InstructorSessionEarning[],
  filters: SessionEarningFilters,
): InstructorSessionEarning[] {
  let out = rows

  if (filters.month && filters.year) {
    const { from, to } = monthBounds(filters.year, filters.month)
    out = out.filter(r => r.scheduled_at.slice(0, 10) >= from && r.scheduled_at.slice(0, 10) <= to)
  } else if (filters.year) {
    out = out.filter(r => r.scheduled_at.slice(0, 4) === String(filters.year))
  }
  if (filters.from) out = out.filter(r => r.scheduled_at.slice(0, 10) >= filters.from!)
  if (filters.to)   out = out.filter(r => r.scheduled_at.slice(0, 10) <= filters.to!)
  if (filters.status)      out = out.filter(r => r.status === filters.status)
  if (filters.sessionType) out = out.filter(r => r.session_type === filters.sessionType)

  return out
}

// ── Lifetime adjustments (bonus/penalty etc.) for this instructor ─────────────

async function getInstructorAdjustments(instructorId: string, from?: string, to?: string): Promise<FinanceAdjustment[]> {
  const db = createServiceClient()
  let q = db.from('finance_adjustments').select('*').eq('instructor_id', instructorId)
  if (from) q = q.gte('adjustment_date', from)
  if (to)   q = q.lte('adjustment_date', to)
  const { data } = await q
  return (data ?? []) as FinanceAdjustment[]
}

// ── Overview (Estimated / Approved / Paid / Outstanding / Lifetime) ───────────

export async function getInstructorPaymentOverview(
  instructorId: string,
  userId:       string,
  branchId:     string,
): Promise<InstructorPaymentOverview> {
  const branchIds = await getInstructorBranchIds(instructorId, branchId)
  const sessions   = await getInstructorSessionEarnings(instructorId, branchIds)

  const now         = new Date()
  const year        = now.getFullYear()
  const month       = now.getMonth() + 1
  const { from: mFrom, to: mTo } = monthBounds(year, month)

  const thisMonth = sessions.filter(s => s.scheduled_at.slice(0, 10) >= mFrom && s.scheduled_at.slice(0, 10) <= mTo)
  const approvedSessionsThisMonth = thisMonth.filter(s => COMPLETING_STATUSES.has(s.status))
  const projectedSessionsThisMonth = thisMonth.filter(s => PROJECTED_STATUSES.has(s.status))

  const [adjThisMonth, adjLifetime] = await Promise.all([
    getInstructorAdjustments(instructorId, mFrom, mTo),
    getInstructorAdjustments(instructorId),
  ])
  const adjThisMonthTotals = computeAdjTotals(adjThisMonth)
  const adjLifetimeTotals  = computeAdjTotals(adjLifetime)

  const approvedThisMonth = approvedSessionsThisMonth.reduce((s, r) => s + r.amount, 0) + adjThisMonthTotals.adj_net
  const estimatedThisMonth = approvedThisMonth + projectedSessionsThisMonth.reduce((s, r) => s + r.amount, 0)

  const lifetimeCompleted = sessions.filter(s => COMPLETING_STATUSES.has(s.status))
  const lifetimeApproved  = lifetimeCompleted.reduce((s, r) => s + r.amount, 0) + adjLifetimeTotals.adj_net

  const staffProfileId = await resolveInstructorStaffProfileId(userId, branchId)
  const allPayments    = await getAllPaymentRecords(staffProfileId)
  const lifetimePaid    = allPayments.reduce((s, r) => s + r.amount, 0)
  const paidThisMonth   = allPayments
    .filter(p => p.month === month && p.year === year)
    .reduce((s, r) => s + r.amount, 0)

  const outstanding = Math.max(0, lifetimeApproved - lifetimePaid)

  const { data: instrRow } = await createServiceClient()
    .from('instructors').select('currency').eq('id', instructorId).maybeSingle()

  return {
    estimated_this_month: estimatedThisMonth,
    approved_this_month:  approvedThisMonth,
    paid_this_month:      paidThisMonth,
    outstanding,
    lifetime_earnings:    lifetimeApproved,
    currency:             (instrRow as any)?.currency ?? 'EGP',
  }
}

// ── Payment records (paid ledger, via resolved staff profile) ─────────────────

export async function getAllPaymentRecords(staffProfileId: string): Promise<StaffPaymentRecord[]> {
  const db = createServiceClient()
  const { data } = await db
    .from('staff_payment_records')
    .select('*')
    .eq('staff_profile_id', staffProfileId)
    .order('payment_date', { ascending: false })
  return ((data ?? []) as any[]).map(pr => ({ ...pr, amount: Number(pr.amount) })) as StaffPaymentRecord[]
}

// ── Payment history (monthly summaries, last N months) ─────────────────────────

export async function getInstructorPaymentHistory(
  instructorId: string,
  userId:       string,
  branchId:     string,
  monthsBack    = 12,
): Promise<InstructorMonthlyPaymentSummary[]> {
  const branchIds = await getInstructorBranchIds(instructorId, branchId)
  const sessions  = await getInstructorSessionEarnings(instructorId, branchIds)
  const completed = sessions.filter(s => COMPLETING_STATUSES.has(s.status))

  const staffProfileId = await resolveInstructorStaffProfileId(userId, branchId)
  const allPayments    = await getAllPaymentRecords(staffProfileId)
  const allAdjustments = await getInstructorAdjustments(instructorId)

  const now = new Date()
  const out: InstructorMonthlyPaymentSummary[] = []

  for (let i = 0; i < monthsBack; i++) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year  = d.getFullYear()
    const month = d.getMonth() + 1
    const { from, to } = monthBounds(year, month)

    const earnedSessions = completed.filter(s => s.scheduled_at.slice(0, 10) >= from && s.scheduled_at.slice(0, 10) <= to)
    const monthAdj        = allAdjustments.filter(a => a.adjustment_date >= from && a.adjustment_date <= to)
    const earned = earnedSessions.reduce((s, r) => s + r.amount, 0) + computeAdjTotals(monthAdj).adj_net

    const monthPayments: InstructorPaymentRecordRow[] = allPayments
      .filter(p => p.month === month && p.year === year)
      .map(p => ({ id: p.id, amount: p.amount, payment_date: p.payment_date, payment_method: p.payment_method, notes: p.notes }))
    const paid = monthPayments.reduce((s, r) => s + r.amount, 0)

    if (earned === 0 && paid === 0) continue

    out.push({
      month, year,
      earned,
      paid,
      outstanding: Math.max(0, earned - paid),
      payments: monthPayments,
    })
  }

  return out
}

// ── Payment methods (instructors table columns) ────────────────────────────────

export async function getInstructorPaymentMethods(instructorId: string): Promise<InstructorPaymentMethods> {
  const db = createServiceClient()
  const { data } = await db
    .from('instructors')
    .select('id, payment_method, wallet_number, instapay_number, payment_link, bank_account_number')
    .eq('id', instructorId)
    .single()

  const row = data as any
  return {
    instructor_id:       row.id,
    payment_method:      row.payment_method ?? null,
    wallet_number:       row.wallet_number ?? null,
    instapay_number:     row.instapay_number ?? null,
    payment_link:        row.payment_link ?? null,
    bank_account_number: row.bank_account_number ?? null,
  }
}
