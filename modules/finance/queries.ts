import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { getInstructorFilterOptions } from '@/modules/query-standards'
import {
  computePriority, computeDaysOverdue, computeStudentRisk,
  type FinanceListItem, type FinanceKPIs, type StudentFinanceDetail,
  type FinanceFilters, type GroupFinanceSummary, type DashboardFinanceSummary,
  type AccountStatus, type ActivityType,
  type StudentOperationsRow, type StudentOpsFilters, type RiskLevel,
  type RecurringExpense, type GroupExpenseDetail, type ExpenseType,
} from './types'

// ── Recurring expense helpers ──────────────────────────────────────────────────

function countActiveMonthsInRange(
  startDate: string,
  endDate: string | null,
  from: Date,
  to: Date
): number {
  const s = new Date(startDate)
  const e = endDate ? new Date(endDate) : to

  const effectiveStart = s > from ? s : from
  const effectiveEnd   = e < to   ? e : to

  if (effectiveEnd < effectiveStart) return 0

  const months =
    (effectiveEnd.getFullYear()  - effectiveStart.getFullYear())  * 12 +
    (effectiveEnd.getMonth()     - effectiveStart.getMonth()) + 1

  return Math.max(0, months)
}

function sumRecurring(
  recurring: RecurringExpense[],
  from: Date,
  to: Date,
  groupId?: string,
  branchId?: string,
  scope?: 'GROUP' | 'BRANCH' | 'ACADEMY'
): number {
  return recurring
    .filter(r => {
      if (!r.is_active) return false
      if (scope    && r.expense_scope !== scope)   return false
      if (groupId  && r.group_id      !== groupId) return false
      if (branchId && r.branch_id     !== branchId) return false
      return true
    })
    .reduce((sum, r) => {
      const months = countActiveMonthsInRange(r.start_date, r.end_date, from, to)
      return sum + r.amount * months
    }, 0)
}

// ── KPI Cards ──────────────────────────────────────────────────────────────────

export async function getFinanceKPIs(branchIds?: string[]): Promise<FinanceKPIs> {
  const db = createServiceClient()

  const now       = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  const weekEnd    = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const today      = now.toISOString().slice(0, 10)

  let baseQ = db.from('student_financial_accounts').select('id, status, remaining_amount, net_amount, next_due_date, paid_amount')
  if (branchIds?.length) baseQ = (baseQ as any).in('branch_id', branchIds)
  const { data: accounts } = await baseQ

  const rows = (accounts ?? []) as any[]

  // Scope account IDs to these branches for sub-queries
  const scopedAccountIds = rows.map((r: any) => r.id as string).filter(Boolean)

  // Payments: scope to accounts in this branch scope
  let payQ = db.from('finance_payments').select('amount, payment_date, account_id')
  if (branchIds?.length && scopedAccountIds.length > 0) {
    payQ = (payQ as any).in('account_id', scopedAccountIds)
  } else if (branchIds?.length && scopedAccountIds.length === 0) {
    // No accounts in scope — return empty
    return { expected_this_month: 0, collected_this_month: 0, outstanding_total: 0, collection_rate_pct: 0, overdue_count: 0, due_this_week: 0, due_this_month: 0, total_students: 0, paid_students: 0 }
  }
  const { data: payments } = await payQ

  const pmts = (payments ?? []) as any[]

  // Filter payments to this month
  const collectedThisMonth = pmts
    .filter((p: any) => p.payment_date >= monthStart && p.payment_date <= monthEnd)
    .reduce((s: number, p: any) => s + Number(p.amount), 0)

  // Expected this month = installments due this month, scoped to same accounts
  let instQ = db.from('finance_installments')
    .select('amount, due_date, account_id')
    .gte('due_date', monthStart)
    .lte('due_date', monthEnd)
    .in('status', ['PENDING','PARTIAL','OVERDUE'])
  if (branchIds?.length && scopedAccountIds.length > 0) {
    instQ = (instQ as any).in('account_id', scopedAccountIds)
  }
  const { data: instRows } = await instQ
  const expectedThisMonth = ((instRows ?? []) as any[]).reduce((s: number, r: any) => s + Number(r.amount), 0)

  const outstanding    = rows.filter(r => r.status !== 'PAID').reduce((s: number, r: any) => s + Number(r.remaining_amount), 0)
  const overdue        = rows.filter(r => r.status === 'OVERDUE').length
  const dueThisWeek    = rows.filter(r => r.next_due_date && r.next_due_date >= today && r.next_due_date <= weekEnd && r.status !== 'PAID').length
  const dueThisMonth   = rows.filter(r => r.next_due_date && r.next_due_date >= monthStart && r.next_due_date <= monthEnd && r.status !== 'PAID').length
  const totalStudents  = rows.length
  const paidStudents   = rows.filter(r => r.status === 'PAID').length

  const collectedTotal = rows.reduce((s: number, r: any) => s + Number(r.paid_amount), 0)
  const netTotal       = rows.reduce((s: number, r: any) => s + Number(r.net_amount), 0)
  const collectionRate = netTotal > 0 ? Math.round((collectedTotal / netTotal) * 100) : 0

  return {
    expected_this_month:  expectedThisMonth,
    collected_this_month: collectedThisMonth,
    outstanding_total:    outstanding,
    collection_rate_pct:  collectionRate,
    overdue_count:        overdue,
    due_this_week:        dueThisWeek,
    due_this_month:       dueThisMonth,
    total_students:       totalStudents,
    paid_students:        paidStudents,
  }
}

// ── Finance list (admin table) ─────────────────────────────────────────────────

export async function listFinancialAccounts(
  filters: FinanceFilters = {}
): Promise<{ data: FinanceListItem[]; total: number; page: number; totalPages: number }> {
  const db      = createServiceClient()
  const page    = filters.page    ?? 1
  const perPage = filters.perPage ?? 30
  const from    = (page - 1) * perPage
  const to      = from + perPage - 1

  let q = db
    .from('student_financial_accounts')
    .select(
      `id, student_id, branch_id, group_id,
       total_amount, discount_amount, net_amount, paid_amount, remaining_amount,
       status, next_due_date,
       students!student_financial_accounts_student_id_fkey(
         id, student_code,
         users!students_user_id_fkey(
           email, phone,
           profiles!profiles_user_id_fkey(first_name, last_name)
         )
       ),
       branches!student_financial_accounts_branch_id_fkey(name),
       groups!student_financial_accounts_group_id_fkey(
         name,
         group_courses!group_courses_group_id_fkey(
           status,
           courses!group_courses_course_id_fkey(title)
         )
       )`,
      { count: 'exact' }
    )
    .order('updated_at', { ascending: false })

  if (filters.branch_ids?.length) q = (q as any).in('branch_id', filters.branch_ids)
  else if (filters.branch_id)     q = q.eq('branch_id', filters.branch_id)
  if (filters.group_id)           q = q.eq('group_id', filters.group_id)
  if (filters.status)    q = q.eq('status', filters.status)

  if (filters.search) {
    const sq = `%${filters.search}%`
    const [profileHits, codeHits] = await Promise.all([
      db.from('profiles').select('user_id').or(`first_name.ilike.${sq},last_name.ilike.${sq}`),
      db.from('students').select('id').ilike('student_code', sq).is('deleted_at', null),
    ])
    const userIds    = (profileHits.data ?? []).map((r: any) => r.user_id as string)
    const studentIds = (codeHits.data ?? []).map((r: any) => r.id as string)

    if (userIds.length === 0 && studentIds.length === 0) {
      return { data: [], total: 0, page, totalPages: 0 }
    }

    const matchStudentIds: string[] = []
    if (userIds.length > 0) {
      const { data: sRows } = await db.from('students').select('id').in('user_id', userIds)
      matchStudentIds.push(...(sRows ?? []).map((r: any) => r.id as string))
    }
    matchStudentIds.push(...studentIds)
    q = q.in('student_id', [...new Set(matchStudentIds)])
  }

  const { data, count, error } = await q.range(from, to)
  if (error) throw new Error(error.message)

  const studentIds = (data ?? []).map((r: any) => r.student_id as string)
  const accountIds = (data ?? []).map((r: any) => r.id as string)

  const [parentRes, lastPayRes] = await Promise.all([
    studentIds.length
      ? db.from('student_parent_contacts').select('student_id, name, phone1, phone2').in('student_id', studentIds)
      : { data: [] as any[] },
    accountIds.length
      ? db.from('finance_payments').select('account_id, payment_date').in('account_id', accountIds).order('payment_date', { ascending: false })
      : { data: [] as any[] },
  ])

  const parentMap = new Map<string, { name: string | null; phone1: string | null; phone2: string | null }>()
  for (const p of (parentRes.data ?? []) as any[]) {
    if (!parentMap.has(p.student_id)) {
      parentMap.set(p.student_id, { name: p.name ?? null, phone1: p.phone1 ?? null, phone2: p.phone2 ?? null })
    }
  }

  const lastPayMap = new Map<string, string>()
  for (const p of (lastPayRes.data ?? []) as any[]) {
    if (!lastPayMap.has(p.account_id)) lastPayMap.set(p.account_id, p.payment_date)
  }

  const items: FinanceListItem[] = ((data ?? []) as any[]).map(row => {
    const student  = row.students   ?? {}
    const branch   = row.branches   ?? {}
    const group    = row.groups     ?? null
    const user     = student.users  ?? {}
    const profile  = user.profiles  ?? {}
    const guardian = parentMap.get(row.student_id)
    const gc = Array.isArray(group?.group_courses)
      ? (group.group_courses as any[]).find((c: any) => c.status === 'active')
      : null
    const courseTitle = gc?.courses?.title ?? null

    const account = {
      status:           row.status    as any,
      remaining_amount: Number(row.remaining_amount),
      next_due_date:    row.next_due_date,
    }

    return {
      account_id:        row.id,
      status:            row.status,
      total_amount:      Number(row.total_amount),
      discount_amount:   Number(row.discount_amount),
      net_amount:        Number(row.net_amount),
      paid_amount:       Number(row.paid_amount),
      remaining_amount:  Number(row.remaining_amount),
      next_due_date:     row.next_due_date,
      student_id:        row.student_id,
      student_name:      [profile.first_name, profile.last_name].filter(Boolean).join(' ') || user.email || 'Unknown',
      student_email:     user.email ?? '',
      student_phone:     user.phone ?? null,
      student_code:      student.student_code ?? null,
      parent_name:       guardian?.name   ?? null,
      parent_phone_1:    guardian?.phone1 ?? null,
      parent_phone_2:    guardian?.phone2 ?? null,
      branch_id:         row.branch_id,
      branch_name:       branch.name ?? '',
      group_id:          row.group_id,
      group_name:        group?.name ?? null,
      course_title:      courseTitle,
      priority:          computePriority(account),
      days_overdue:      computeDaysOverdue(row.next_due_date),
      last_payment_date: lastPayMap.get(row.id) ?? null,
    } satisfies FinanceListItem
  })

  return {
    data:       items,
    total:      count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / perPage),
  }
}

// ── Student finance detail (for the modal) ─────────────────────────────────────

export async function getStudentFinanceDetail(accountId: string): Promise<StudentFinanceDetail | null> {
  const db = createServiceClient()

  const [accountRes, installRes, paymentRes, noteRes, activityRes] = await Promise.all([
    db.from('student_financial_accounts')
      .select(
        `*,
         students!student_financial_accounts_student_id_fkey(
           id, student_code,
           users!students_user_id_fkey(
             email, phone,
             profiles!profiles_user_id_fkey(first_name, last_name)
           )
         ),
         branches!student_financial_accounts_branch_id_fkey(name),
         groups!student_financial_accounts_group_id_fkey(
           name,
           group_courses(
             status,
             courses!group_courses_course_id_fkey(title)
           )
         )`
      )
      .eq('id', accountId)
      .single(),

    db.from('finance_installments')
      .select('*')
      .eq('account_id', accountId)
      .order('installment_number', { ascending: true }),

    db.from('finance_payments')
      .select(`*, users!finance_payments_created_by_fkey(profiles!profiles_user_id_fkey(first_name, last_name))`)
      .eq('account_id', accountId)
      .order('payment_date', { ascending: false }),

    db.from('finance_notes')
      .select(`*, users!finance_notes_created_by_fkey(profiles!profiles_user_id_fkey(first_name, last_name))`)
      .eq('account_id', accountId)
      .order('created_at', { ascending: false }),

    db.from('collection_activities')
      .select(`*, users!collection_activities_created_by_fkey(profiles!profiles_user_id_fkey(first_name, last_name))`)
      .eq('account_id', accountId)
      .order('created_at', { ascending: false }),
  ])

  if (accountRes.error || !accountRes.data) return null

  const row      = accountRes.data as any
  const student  = row.students  ?? {}
  const user     = student.users ?? {}
  const profile  = user.profiles ?? {}
  const branch   = row.branches  ?? {}
  const group    = row.groups    ?? null
  const gc = Array.isArray(group?.group_courses)
    ? (group.group_courses as any[]).find((c: any) => c.status === 'active')
    : null

  const { data: parentData } = await db
    .from('student_parent_contacts')
    .select('name, phone1, phone2')
    .eq('student_id', row.student_id)
    .limit(1)
    .maybeSingle()
  const guardian = parentData as { name: string | null; phone1: string | null; phone2: string | null } | null

  const mapCreatedBy = (r: any) => {
    const p = r.users?.profiles
    return p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || null : null
  }

  return {
    account: {
      id:               row.id,
      student_id:       row.student_id,
      branch_id:        row.branch_id,
      group_id:         row.group_id,
      total_amount:     Number(row.total_amount),
      discount_amount:  Number(row.discount_amount),
      net_amount:       Number(row.net_amount),
      paid_amount:      Number(row.paid_amount),
      remaining_amount: Number(row.remaining_amount),
      status:           row.status,
      next_due_date:    row.next_due_date,
      notes:            row.notes,
      created_by:       row.created_by,
      created_at:       row.created_at,
      updated_at:       row.updated_at,
    },
    installments: ((installRes.data ?? []) as any[]).map(r => ({
      id: r.id, account_id: r.account_id,
      installment_number: r.installment_number,
      amount: Number(r.amount), due_date: r.due_date,
      paid_amount: Number(r.paid_amount), status: r.status,
      notes: r.notes, created_at: r.created_at, updated_at: r.updated_at,
    })),
    payments: ((paymentRes.data ?? []) as any[]).map(r => ({
      id: r.id, student_id: r.student_id, account_id: r.account_id,
      enrollment_id:       r.enrollment_id       ?? null,
      installment_id:      r.installment_id      ?? null,
      allocation_strategy: r.allocation_strategy ?? null,
      amount: Number(r.amount), payment_date: r.payment_date,
      payment_method: r.payment_method, reference_number: r.reference_number,
      notes: r.notes,
      receipt_url:   r.receipt_url   ?? null,
      receipt_image: r.receipt_image ?? null,
      receipt_notes: r.receipt_notes ?? null,
      created_by: r.created_by, created_at: r.created_at,
      created_by_name: mapCreatedBy(r),
    })),
    notes: ((noteRes.data ?? []) as any[]).map(r => ({
      id: r.id, student_id: r.student_id, account_id: r.account_id,
      note_text: r.note_text, is_internal: r.is_internal,
      created_by: r.created_by, created_at: r.created_at,
      created_by_name: mapCreatedBy(r),
    })),
    activities: ((activityRes.data ?? []) as any[]).map(r => ({
      id: r.id, student_id: r.student_id, account_id: r.account_id,
      activity_type: r.activity_type, notes: r.notes,
      created_by: r.created_by, created_at: r.created_at,
      created_by_name: mapCreatedBy(r),
    })),
    student: {
      id:             student.id ?? row.student_id,
      name:           [profile.first_name, profile.last_name].filter(Boolean).join(' ') || user.email || 'Unknown',
      email:          user.email  ?? '',
      phone:          user.phone  ?? null,
      student_code:   student.student_code ?? null,
      branch_name:    branch.name ?? '',
      group_name:     group?.name  ?? null,
      course_title:   gc?.courses?.title ?? null,
      parent_name:    guardian?.name   ?? null,
      parent_phone_1: guardian?.phone1 ?? null,
      parent_phone_2: guardian?.phone2 ?? null,
    },
  }
}

// ── Branch finance analytics ───────────────────────────────────────────────────

export async function getBranchFinanceStats() {
  const db = createServiceClient()

  const { data: branches } = await db
    .from('branches').select('id, name').eq('is_active', true).is('deleted_at', null).order('name')
  if (!branches?.length) return []

  const bIds = (branches as any[]).map(b => b.id as string)

  const { data: accounts } = await db
    .from('student_financial_accounts')
    .select('branch_id, net_amount, paid_amount, remaining_amount, status')
    .in('branch_id', bIds)

  const map: Record<string, { net: number; paid: number; outstanding: number; overdue: number; total: number }> = {}
  for (const r of (accounts ?? []) as any[]) {
    if (!map[r.branch_id]) map[r.branch_id] = { net: 0, paid: 0, outstanding: 0, overdue: 0, total: 0 }
    map[r.branch_id].net     += Number(r.net_amount)
    map[r.branch_id].paid    += Number(r.paid_amount)
    map[r.branch_id].total   += 1
    if (r.status !== 'PAID') map[r.branch_id].outstanding += Number(r.remaining_amount)
    if (r.status === 'OVERDUE') map[r.branch_id].overdue  += 1
  }

  return (branches as any[]).map(b => {
    const s = map[b.id] ?? { net: 0, paid: 0, outstanding: 0, overdue: 0, total: 0 }
    const rate = s.net > 0 ? Math.round((s.paid / s.net) * 100) : 0
    return {
      branch_id:       b.id as string,
      branch_name:     b.name as string,
      net_amount:      s.net,
      paid_amount:     s.paid,
      outstanding:     s.outstanding,
      collection_rate: rate,
      overdue_count:   s.overdue,
      total_students:  s.total,
    }
  }).sort((a, b) => b.net_amount - a.net_amount)
}

// ── Get account by student ID ──────────────────────────────────────────────────

export async function getAccountByStudentId(studentId: string) {
  const db = createServiceClient()
  const { data } = await db
    .from('student_financial_accounts')
    .select('id')
    .eq('student_id', studentId)
    .maybeSingle()
  return (data as any)?.id as string | null
}

// ── Collection queue ───────────────────────────────────────────────────────────

export async function getCollectionQueue(branchIds?: string[]) {
  const db    = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const week  = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  let q = db
    .from('student_financial_accounts')
    .select(
      `id, student_id, branch_id, group_id, remaining_amount, status, next_due_date,
       students!student_financial_accounts_student_id_fkey(
         id, student_code,
         users!students_user_id_fkey(email, phone, profiles!profiles_user_id_fkey(first_name, last_name))
       ),
       branches!student_financial_accounts_branch_id_fkey(name),
       groups!student_financial_accounts_group_id_fkey(name)`
    )
    .neq('status', 'PAID')
    .gt('remaining_amount', 0)
    .order('next_due_date', { ascending: true, nullsFirst: false })

  if (branchIds?.length) q = (q as any).in('branch_id', branchIds)

  const { data: accounts } = await q

  if (!accounts?.length) return { overdue30: [], overdue14: [], dueThisWeek: [], dueSoon: [] }

  const accountIds = (accounts as any[]).map(a => a.id as string)

  // Fetch last activity per account
  const { data: activities } = await db
    .from('collection_activities')
    .select('account_id, activity_type, created_at')
    .in('account_id', accountIds)
    .order('created_at', { ascending: false })

  const lastActivityMap: Record<string, { type: string; at: string }> = {}
  for (const a of (activities ?? []) as any[]) {
    if (!lastActivityMap[a.account_id]) {
      lastActivityMap[a.account_id] = { type: a.activity_type, at: a.created_at }
    }
  }

  // Fetch active promises
  const { data: promises } = await db
    .from('payment_promises')
    .select('account_id, promised_amount, promised_date')
    .in('account_id', accountIds)
    .eq('status', 'ACTIVE')

  const promiseMap: Record<string, { amount: number; date: string }> = {}
  for (const p of (promises ?? []) as any[]) {
    promiseMap[p.account_id] = { amount: Number(p.promised_amount), date: p.promised_date }
  }

  const now30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const now14 = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)

  const items = (accounts as any[]).map(row => {
    const student = row.students ?? {}
    const user    = student.users ?? {}
    const profile = user.profiles ?? {}
    const last    = lastActivityMap[row.id]
    const days    = computeDaysOverdue(row.next_due_date)

    return {
      account_id:         row.id as string,
      student_id:         row.student_id as string,
      student_name:       [profile.first_name, profile.last_name].filter(Boolean).join(' ') || user.email || 'Unknown',
      student_code:       student.student_code as string | null,
      parent_name:        null,
      parent_phone_1:     null,
      parent_phone_2:     null,
      branch_name:        (row.branches as any)?.name ?? '',
      group_name:         (row.groups as any)?.name ?? null,
      remaining_amount:   Number(row.remaining_amount),
      days_overdue:       days,
      next_due_date:      row.next_due_date as string | null,
      status:             row.status as AccountStatus,
      priority:           computePriority({ status: row.status, remaining_amount: Number(row.remaining_amount), next_due_date: row.next_due_date }),
      last_activity_at:   last?.at ?? null,
      last_activity_type: (last?.type ?? null) as ActivityType | null,
      active_promise:     promiseMap[row.id] ?? null,
    }
  })

  return {
    overdue30:    items.filter(i => i.next_due_date !== null && i.next_due_date <= now30),
    overdue14:    items.filter(i => i.next_due_date !== null && i.next_due_date > now30 && i.next_due_date <= now14),
    dueThisWeek:  items.filter(i => i.next_due_date !== null && i.next_due_date > today && i.next_due_date <= week),
    dueSoon:      items.filter(i => i.next_due_date !== null && i.next_due_date > week),
  }
}

// ── Group finance summary ──────────────────────────────────────────────────────

export async function getGroupFinanceSummary(groupId: string): Promise<GroupFinanceSummary | null> {
  const db = createServiceClient()

  // Get students in this group
  const { data: enrollments } = await db
    .from('group_students')
    .select('student_id')
    .eq('group_id', groupId)
    .eq('status', 'active')

  if (!enrollments?.length) return { group_id: groupId, expected_revenue: 0, collected: 0, outstanding: 0, collection_rate: 0, overdue_count: 0, student_accounts: [] }

  const studentIds = (enrollments as any[]).map(e => e.student_id as string)

  const { data: accounts } = await db
    .from('student_financial_accounts')
    .select(
      `id, student_id, net_amount, paid_amount, remaining_amount, status,
       students!student_financial_accounts_student_id_fkey(
         users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
       )`
    )
    .in('student_id', studentIds)

  const rows = (accounts ?? []) as any[]

  const expected = rows.reduce((s, r) => s + Number(r.net_amount), 0)
  const collected = rows.reduce((s, r) => s + Number(r.paid_amount), 0)
  const outstanding = rows.reduce((s, r) => s + (r.status !== 'PAID' ? Number(r.remaining_amount) : 0), 0)
  const overdue = rows.filter(r => r.status === 'OVERDUE').length
  const rate = expected > 0 ? Math.round((collected / expected) * 100) : 0

  return {
    group_id:         groupId,
    expected_revenue: expected,
    collected,
    outstanding,
    collection_rate:  rate,
    overdue_count:    overdue,
    student_accounts: rows.map(r => {
      const p = r.students?.users?.profiles
      return {
        student_id:      r.student_id,
        student_name:    p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown' : 'Unknown',
        account_id:      r.id,
        net_amount:      Number(r.net_amount),
        paid_amount:     Number(r.paid_amount),
        remaining_amount: Number(r.remaining_amount),
        status:          r.status,
        priority:        computePriority({ status: r.status, remaining_amount: Number(r.remaining_amount), next_due_date: null }),
      }
    }),
  }
}

// ── Branch finance snapshot ────────────────────────────────────────────────────

export async function getBranchFinanceSnapshot(branchId: string) {
  const db    = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const week  = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const { data: accounts } = await db
    .from('student_financial_accounts')
    .select(
      `id, student_id, net_amount, paid_amount, remaining_amount, status, next_due_date,
       students!student_financial_accounts_student_id_fkey(
         student_code,
         users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))
       )`
    )
    .eq('branch_id', branchId)

  const rows = (accounts ?? []) as any[]
  const net  = rows.reduce((s, r) => s + Number(r.net_amount), 0)
  const paid = rows.reduce((s, r) => s + Number(r.paid_amount), 0)
  const outstanding = rows.filter(r => r.status !== 'PAID').reduce((s, r) => s + Number(r.remaining_amount), 0)
  const overdue = rows.filter(r => r.status === 'OVERDUE')
  const dueThisWeek = rows.filter(r => r.next_due_date && r.next_due_date > today && r.next_due_date <= week && r.status !== 'PAID').length
  const rate = net > 0 ? Math.round((paid / net) * 100) : 0

  const top5Outstanding = overdue
    .sort((a, b) => Number(b.remaining_amount) - Number(a.remaining_amount))
    .slice(0, 5)
    .map(r => {
      const p = r.students?.users?.profiles
      return {
        student_id:      r.student_id as string,
        student_name:    p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || r.students?.users?.email : r.students?.users?.email,
        account_id:      r.id as string,
        remaining_amount: Number(r.remaining_amount),
        days_overdue:    computeDaysOverdue(r.next_due_date),
        parent_phone_1:  null,
      }
    })

  return {
    net_amount:      net,
    paid_amount:     paid,
    outstanding,
    collection_rate: rate,
    overdue_count:   overdue.length,
    due_this_week:   dueThisWeek,
    total_students:  rows.length,
    top_outstanding: top5Outstanding,
  }
}

// ── Dashboard finance summary ─────────────────────────────────────────────────

export async function getDashboardFinanceSummary(branchIds?: string[]): Promise<DashboardFinanceSummary> {
  const db    = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const week  = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  let accQ = db.from('student_financial_accounts').select('id, net_amount, paid_amount, remaining_amount, status, next_due_date')
  if (branchIds?.length) accQ = (accQ as any).in('branch_id', branchIds)

  const { data: accounts } = await accQ
  const rows = (accounts ?? []) as any[]

  // Scope sub-queries to same accounts
  const scopedAccIds = rows.map((r: any) => r.id as string)

  let pmtQ = db.from('finance_payments').select('amount, payment_date')
  if (branchIds?.length && scopedAccIds.length > 0) {
    pmtQ = (pmtQ as any).in('account_id', scopedAccIds)
  } else if (branchIds?.length && scopedAccIds.length === 0) {
    pmtQ = (pmtQ as any).eq('account_id', '00000000-0000-0000-0000-000000000000') // no results
  }

  let ppQ = db.from('payment_promises').select('id, status')
  if (branchIds?.length && scopedAccIds.length > 0) {
    ppQ = (ppQ as any).in('account_id', scopedAccIds)
  } else if (branchIds?.length && scopedAccIds.length === 0) {
    ppQ = (ppQ as any).eq('account_id', '00000000-0000-0000-0000-000000000000')
  }

  const [{ data: payments }, { data: promises }] = await Promise.all([pmtQ, ppQ])

  const pmts  = (payments  ?? []) as any[]
  const proms = (promises  ?? []) as any[]

  const outstanding = rows.filter(r => r.status !== 'PAID').reduce((s: number, r: any) => s + Number(r.remaining_amount), 0)
  const overdue    = rows.filter(r => r.status === 'OVERDUE').length
  const dueWeek    = rows.filter(r => r.next_due_date && r.next_due_date > today && r.next_due_date <= week && r.status !== 'PAID').length

  // Collection rate from same scoped data
  const totalNet  = rows.reduce((s: number, r: any) => s + Number(r.net_amount), 0)
  const totalPaid = rows.reduce((s: number, r: any) => s + Number(r.paid_amount), 0)
  const rate = totalNet > 0 ? Math.round((totalPaid / totalNet) * 100) : 0

  const collectedToday = pmts.filter(p => p.payment_date === today).reduce((s: number, p: any) => s + Number(p.amount), 0)
  const collectedMonth = pmts.filter(p => p.payment_date >= monthStart).reduce((s: number, p: any) => s + Number(p.amount), 0)

  return {
    outstanding,
    collection_rate:      rate,
    overdue_count:        overdue,
    due_this_week:        dueWeek,
    broken_promises:      proms.filter(p => p.status === 'BROKEN').length,
    active_promises:      proms.filter(p => p.status === 'ACTIVE').length,
    collected_today:      collectedToday,
    collected_this_month: collectedMonth,
  }
}

// ── Payment promises ──────────────────────────────────────────────────────────

export async function getAccountPromises(accountId: string) {
  const db = createServiceClient()
  const { data } = await db
    .from('payment_promises')
    .select(`*, users!payment_promises_created_by_fkey(profiles!profiles_user_id_fkey(first_name, last_name))`)
    .eq('account_id', accountId)
    .order('promised_date', { ascending: false })

  return ((data ?? []) as any[]).map(r => {
    const p = r.users?.profiles
    return {
      id:              r.id,
      student_id:      r.student_id,
      account_id:      r.account_id,
      promised_amount: Number(r.promised_amount),
      promised_date:   r.promised_date,
      notes:           r.notes,
      status:          r.status,
      created_by:      r.created_by,
      created_at:      r.created_at,
      updated_at:      r.updated_at,
      created_by_name: p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || null : null,
    }
  })
}

// ── All broken/active promises ────────────────────────────────────────────────

export async function getBrokenPromises(branchIds?: string[]) {
  const db = createServiceClient()

  // When branch-scoped: first get account_ids for those branches
  let accountFilter: string[] | null = null
  if (branchIds?.length) {
    const { data: accs } = await db
      .from('student_financial_accounts')
      .select('id')
      .in('branch_id', branchIds)
    accountFilter = (accs ?? []).map((a: any) => a.id as string)
    if (accountFilter.length === 0) return []
  }

  let q = db
    .from('payment_promises')
    .select(
      `id, promised_amount, promised_date, status, notes, created_at,
       student_financial_accounts!payment_promises_account_id_fkey(branch_id, remaining_amount),
       students!payment_promises_student_id_fkey(
         student_code,
         users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))
       )`
    )
    .eq('status', 'BROKEN')
    .order('promised_date', { ascending: false })
    .limit(50)

  if (accountFilter !== null) {
    q = (q as any).in('account_id', accountFilter)
  }

  const { data } = await q

  return ((data ?? []) as any[]).map(r => {
    const s = r.students ?? {}
    const p = s.users?.profiles
    return {
      id:              r.id as string,
      student_name:    p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || s.users?.email : s.users?.email,
      promised_amount: Number(r.promised_amount),
      promised_date:   r.promised_date as string,
      status:          r.status as string,
      notes:           r.notes as string | null,
      remaining_amount: Number(r.student_financial_accounts?.remaining_amount ?? 0),
    }
  })
}

// ── Parent: own child's finance ────────────────────────────────────────────────

export async function getParentChildFinance(parentUserId: string, studentId: string) {
  const db = createServiceClient()

  // Verify the calling user IS a parent for this student (both parent_id AND student_id)
  const { data: parentRec } = await db
    .from('parents')
    .select('id')
    .eq('user_id', parentUserId)
    .single()

  if (!parentRec) return null

  const { data: link } = await db
    .from('parent_students')
    .select('id, can_view_financials')
    .eq('parent_id', (parentRec as any).id)
    .eq('student_id', studentId)
    .single()

  if (!link || !(link as any).can_view_financials) return null

  const { data: account } = await db
    .from('student_financial_accounts')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle()

  if (!account) return null

  const [installRes, paymentRes] = await Promise.all([
    db.from('finance_installments').select('*').eq('account_id', (account as any).id).order('installment_number'),
    db.from('finance_payments').select('amount, payment_date, payment_method, reference_number').eq('account_id', (account as any).id).order('payment_date', { ascending: false }),
  ])

  return {
    account: {
      total_amount:     Number((account as any).total_amount),
      discount_amount:  Number((account as any).discount_amount),
      net_amount:       Number((account as any).net_amount),
      paid_amount:      Number((account as any).paid_amount),
      remaining_amount: Number((account as any).remaining_amount),
      status:           (account as any).status as string,
      next_due_date:    (account as any).next_due_date as string | null,
    },
    installments: (installRes.data ?? []) as any[],
    payments:     (paymentRes.data ?? []) as any[],
  }
}

// ── Student Operations Center — enrollment-centric main list ──────────────────
// Sprint 41: one row per ACTIVE enrollment (not per student).
// Attendance is filtered to sessions on/after enrollment.start_date so late-joining
// or transferred students never see pre-enrollment history.
//
// FALLBACK: if sprint41 migration hasn't been applied yet (student_enrollments is
// empty for these branches), the function falls back to the Sprint 40 student-centric
// approach so the page keeps working in all environments.

export async function listStudentOperations(
  branchIds: string[],
  _filters: StudentOpsFilters = {}
): Promise<StudentOperationsRow[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  // ── Determine which code path to use ─────────────────────────────────────
  // A single COUNT(head=true) tells us if the sprint41 migration has run.
  const { count: enrollCount } = await db
    .from('student_enrollments')
    .select('id', { count: 'exact', head: true })
    .in('branch_id', branchIds)

  if ((enrollCount ?? 0) > 0) {
    const rows = await _listFromEnrollments(db, branchIds)
    // Sprint 50.1: surface students who have no active enrollment
    return _appendNoContractStudents(db, branchIds, rows)
  }
  // Pre-migration fallback (Sprint 40 logic)
  return _listFromStudents(db, branchIds)
}

// ── Post-migration: enrollment-centric ───────────────────────────────────────

async function _listFromEnrollments(db: ReturnType<typeof createServiceClient>, branchIds: string[]): Promise<StudentOperationsRow[]> {

  // ── 1. Active enrollments with nested student + group + gc/instructor ──────
  const { data: enrollData, error: enrollErr } = await db
    .from('student_enrollments')
    .select(`
      id, student_id, branch_id, group_id, group_course_id,
      start_date, net_amount, total_amount, discount_amount,
      enrolled_sessions, consumed_sessions, remaining_sessions,
      financial_status, course_name_snapshot,
      students!student_enrollments_student_id_fkey(
        id, student_code, branch_id,
        users!students_user_id_fkey(
          email, phone,
          profiles!profiles_user_id_fkey(first_name, last_name)
        )
      ),
      groups!student_enrollments_group_id_fkey(id, name, start_date),
      group_courses!student_enrollments_group_course_id_fkey(
        id,
        instructors!group_courses_instructor_id_fkey(
          id,
          users!instructors_user_id_fkey(
            profiles!profiles_user_id_fkey(first_name, last_name)
          )
        )
      )
    `)
    .in('branch_id', branchIds)
    .eq('status', 'ACTIVE')
    .limit(1000)

  if (enrollErr) throw new Error(enrollErr.message)
  const enrollments = (enrollData ?? []) as any[]
  if (!enrollments.length) return []

  const studentIds    = [...new Set(enrollments.map(e => e.student_id as string))]
  const enrollmentIds = enrollments.map(e => e.id as string)
  const gcIds         = [...new Set(enrollments.map(e => e.group_course_id as string).filter(Boolean))]

  // ── 2. Branch names ────────────────────────────────────────────────────────
  const { data: branchData } = await db
    .from('branches').select('id, name').in('id', branchIds)
  const branchNameMap = new Map<string, string>()
  for (const b of (branchData ?? []) as any[]) branchNameMap.set(b.id, b.name)

  // ── 3. Financial accounts — enrollment-linked first, then student fallback ─
  const accByEnrollMap = new Map<string, any>()
  const { data: accEnrollData } = await db
    .from('student_financial_accounts')
    .select('id, student_id, enrollment_id, status, total_amount, net_amount, paid_amount, remaining_amount, next_due_date')
    .in('enrollment_id', enrollmentIds)
  for (const a of (accEnrollData ?? []) as any[]) {
    if (a.enrollment_id) accByEnrollMap.set(a.enrollment_id as string, a)
  }

  // Students whose enrollment has no linked account yet → use student-level account
  const missingStudentIds = enrollments
    .filter(e => !accByEnrollMap.has(e.id))
    .map(e => e.student_id as string)

  const accByStudentMap = new Map<string, any>()
  if (missingStudentIds.length) {
    const { data: accStuData } = await db
      .from('student_financial_accounts')
      .select('id, student_id, enrollment_id, status, total_amount, net_amount, paid_amount, remaining_amount, next_due_date')
      .in('student_id', [...new Set(missingStudentIds)])
    for (const a of (accStuData ?? []) as any[]) {
      if (!accByStudentMap.has(a.student_id)) accByStudentMap.set(a.student_id as string, a)
    }
  }

  // ── 4. Schedules (non-cancelled, last 18 months) ───────────────────────────
  const cutoff = new Date(Date.now() - 548 * 86400000).toISOString()
  const schedsByGc   = new Map<string, any[]>()
  const schedInfoMap = new Map<string, any>()

  if (gcIds.length) {
    const { data: schedData } = await db
      .from('schedules')
      .select('id, group_course_id, scheduled_at, status')
      .in('group_course_id', gcIds)
      .neq('status', 'cancelled')
      .gte('scheduled_at', cutoff)
    for (const s of (schedData ?? []) as any[]) {
      if (!schedsByGc.has(s.group_course_id)) schedsByGc.set(s.group_course_id, [])
      schedsByGc.get(s.group_course_id)!.push(s)
      schedInfoMap.set(s.id, s)
    }
  }

  // ── 5. Attendance records for completed sessions ───────────────────────────
  const completedIds = [...schedInfoMap.values()]
    .filter(s => s.status === 'completed')
    .map(s => s.id as string)

  const attByKey = new Map<string, Map<string, { status: string; scheduled_at: string }>>()

  if (completedIds.length && studentIds.length) {
    const { data: arData } = await db
      .from('attendance_records')
      .select('student_id, schedule_id, status')
      .in('student_id', studentIds)
      .in('schedule_id', completedIds)
    for (const ar of (arData ?? []) as any[]) {
      const sched = schedInfoMap.get(ar.schedule_id)
      if (!sched) continue
      const key = `${ar.student_id}:${sched.group_course_id}`
      if (!attByKey.has(key)) attByKey.set(key, new Map())
      attByKey.get(key)!.set(ar.schedule_id, { status: ar.status, scheduled_at: sched.scheduled_at })
    }
  }

  // ── 6. Installment counts ─────────────────────────────────────────────────
  const allAccIds = [
    ...[...accByEnrollMap.values()].map(a => a.id as string),
    ...[...accByStudentMap.values()].map(a => a.id as string),
  ]
  const instMap = new Map<string, { total: number; paid: number }>()
  if (allAccIds.length) {
    const { data: instData } = await db
      .from('finance_installments').select('account_id, status').in('account_id', allAccIds)
    for (const i of (instData ?? []) as any[]) {
      if (!instMap.has(i.account_id)) instMap.set(i.account_id, { total: 0, paid: 0 })
      const m = instMap.get(i.account_id)!
      m.total++
      if (i.status === 'PAID') m.paid++
    }
  }

  // ── 7. Parent contacts ───────────────────────────────────────────────────────
  const guardianByStudent = new Map<string, { name: string | null; phone1: string | null; phone2: string | null }>()
  if (studentIds.length) {
    const { data: guardData } = await db
      .from('student_parent_contacts')
      .select('student_id, name, phone1, phone2')
      .in('student_id', studentIds)
    for (const g of (guardData ?? []) as any[]) {
      if (!guardianByStudent.has(g.student_id)) {
        guardianByStudent.set(g.student_id, {
          name:   g.name   ?? null,
          phone1: g.phone1 ?? null,
          phone2: g.phone2 ?? null,
        })
      }
    }
  }

  // ── 8. Build rows (one per enrollment) ────────────────────────────────────
  const POSITIVE = new Set(['present', 'late', 'makeup'])
  const rows: StudentOperationsRow[] = []

  for (const enroll of enrollments) {
    const student  = enroll.students   ?? {}
    const user     = student.users     ?? {}
    const profile  = user.profiles     ?? {}
    const guardian = guardianByStudent.get(enroll.student_id)
    const group    = enroll.groups     ?? null
    const gc       = enroll.group_courses ?? null

    const instrProf     = gc?.instructors?.users?.profiles
    const instructorName = instrProf
      ? [instrProf.first_name, instrProf.last_name].filter(Boolean).join(' ') || null
      : null

    // Financial account: enrollment-linked > student-fallback
    const account = accByEnrollMap.get(enroll.id) ?? accByStudentMap.get(enroll.student_id)

    // ── Enrollment-aware session filtering ─────────────────────────────────
    // Only count sessions AFTER the student's enrollment start_date.
    const enrollStart = enroll.start_date as string  // 'YYYY-MM-DD'
    const gcId        = enroll.group_course_id as string | null

    const allGcScheds = gcId ? (schedsByGc.get(gcId) ?? []) : []
    const eligibleScheds = enrollStart
      ? allGcScheds.filter((s: any) => s.scheduled_at >= `${enrollStart}T00:00:00`)
      : allGcScheds

    const totalSessions = eligibleScheds.filter((s: any) => s.status !== 'cancelled').length

    const completedEligible = eligibleScheds
      .filter((s: any) => s.status === 'completed')
      .sort((a: any, b: any) => b.scheduled_at.localeCompare(a.scheduled_at))

    const attKey  = `${enroll.student_id}:${gcId ?? ''}`
    const stuAttM = attByKey.get(attKey) ?? new Map()

    let sessionsAttended    = 0
    let lastAttendanceDate: string | null = null
    let consecutiveAbsences = 0
    let streakDone          = false

    for (const session of completedEligible) {
      const rec      = stuAttM.get(session.id)
      const attended = rec ? POSITIVE.has(rec.status) : false
      if (attended) {
        sessionsAttended++
        if (!lastAttendanceDate) lastAttendanceDate = session.scheduled_at.slice(0, 10)
        if (!streakDone) streakDone = true
      } else {
        if (!streakDone) consecutiveAbsences++
      }
    }

    const totalCompleted = completedEligible.length
    const attendancePct  = totalCompleted > 0
      ? Math.round((sessionsAttended / totalCompleted) * 100)
      : 0

    // Finance
    const financialStatus = (account?.status ?? null) as AccountStatus | null
    const netAmount       = account ? Number(account.net_amount) : Number(enroll.net_amount ?? 0)
    const paidAmount      = account ? Number(account.paid_amount) : 0
    const remainingAmount = account ? Number(account.remaining_amount) : netAmount
    const nextDueDate     = (account?.next_due_date as string | null) ?? null
    const daysOverdue     = computeDaysOverdue(nextDueDate)
    const paymentPct      = netAmount > 0 ? Math.round((paidAmount / netAmount) * 100) : 0

    const inst = account ? (instMap.get(account.id) ?? { total: 0, paid: 0 }) : { total: 0, paid: 0 }

    const { level: riskLevel, flags: riskFlags } = computeStudentRisk({
      attendance_pct:       attendancePct,
      financial_status:     financialStatus,
      days_overdue:         daysOverdue,
      consecutive_absences: consecutiveAbsences,
      sessions_attended:    sessionsAttended,
      remaining_amount:     remainingAmount,
    })

    rows.push({
      enrollment_id: enroll.id,
      student_id:    enroll.student_id,
      account_id:    account?.id ?? null,
      group_id:      enroll.group_id,
      instructor_id: gc?.instructors?.id ?? null,
      student_name:   [profile.first_name, profile.last_name].filter(Boolean).join(' ') || user.email || 'Unknown',
      student_code:   student.student_code ?? null,
      student_phone:  user.phone ?? null,
      student_status: 'active',
      parent_name:    guardian?.name   ?? null,
      parent_phone_1: guardian?.phone1 ?? null,
      parent_phone_2: guardian?.phone2 ?? null,
      branch_id:   enroll.branch_id,
      branch_name: branchNameMap.get(enroll.branch_id) ?? '',
      group_name:       group?.name     ?? null,
      course_name:      (enroll.course_name_snapshot as string | null) ?? null,
      group_start_date: enroll.start_date ?? null,
      instructor_name:  instructorName,
      total_sessions:     totalSessions,
      sessions_attended:  sessionsAttended,
      attendance_pct:     attendancePct,
      last_attendance_date: lastAttendanceDate,
      consecutive_absences: consecutiveAbsences,
      // Sprint 44: session contract fields
      enrolled_sessions:  Number(enroll.enrolled_sessions  ?? 0),
      consumed_sessions:  Number(enroll.consumed_sessions  ?? 0),
      remaining_sessions: Number(enroll.remaining_sessions ?? Math.max(0, (enroll.enrolled_sessions ?? 0) - (enroll.consumed_sessions ?? 0))),
      financial_status:   (enroll.financial_status ?? financialStatus) as any,
      total_amount:       account ? Number(account.total_amount) : Number(enroll.total_amount ?? 0),
      net_amount:         netAmount,
      paid_amount:        paidAmount,
      remaining_amount:   remainingAmount,
      installments_total:     inst.total,
      installments_paid:      inst.paid,
      installments_remaining: inst.total - inst.paid,
      next_due_date:          nextDueDate,
      payment_progress_pct:   paymentPct,
      days_overdue:           daysOverdue,
      risk_level: riskLevel,
      risk_flags: riskFlags,
    })
  }

  const riskOrder: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  rows.sort((a, b) => {
    const d = riskOrder[a.risk_level] - riskOrder[b.risk_level]
    return d !== 0 ? d : b.remaining_amount - a.remaining_amount
  })
  return rows
}

// ── Filter options for Operations Center dropdowns ────────────────────────────
// Loads branches, groups, and instructors independently (not derived from rows).
// All instructors who teach any active group_course in the TL's branches are included.

export async function getFilterOptions(branchIds: string[]): Promise<{
  branches:    { id: string; name: string }[]
  groups:      { id: string; name: string }[]
  instructors: { id: string; name: string }[]
  courses:     { id: string; name: string }[]
}> {
  if (!branchIds.length) return { branches: [], groups: [], instructors: [], courses: [] }
  const db = createServiceClient()

  const [branchRes, groupRes, courseRes, instructors] = await Promise.all([
    db.from('branches').select('id, name').in('id', branchIds).eq('is_active', true).is('deleted_at', null).order('name'),
    db.from('groups').select('id, name').in('branch_id', branchIds).is('deleted_at', null).order('name'),
    db.from('courses').select('id, title').is('deleted_at', null).order('title').limit(200),
    getInstructorFilterOptions(branchIds),
  ])

  return {
    branches:    (branchRes.data ?? []).map((b: any) => ({ id: b.id as string, name: b.name as string })),
    groups:      (groupRes.data ?? []).map((g: any) => ({ id: g.id as string, name: g.name as string })),
    instructors,
    courses:     ((courseRes.data ?? []) as any[]).map(c => ({ id: c.id as string, name: c.title as string })),
  }
}

// ── Pre-migration fallback: student-centric (Sprint 40 behavior) ──────────────

async function _listFromStudents(db: ReturnType<typeof createServiceClient>, branchIds: string[]): Promise<StudentOperationsRow[]> {

  const { data: stuData, error: stuErr } = await db
    .from('students')
    .select(`
      id, student_code, branch_id, status,
      users!students_user_id_fkey(
        email, phone,
        profiles!profiles_user_id_fkey(first_name, last_name)
      )
    `)
    .in('branch_id', branchIds)
    .eq('status', 'active')
    .is('deleted_at', null)
    .limit(1000)
  if (stuErr) throw new Error(stuErr.message)
  const students = (stuData ?? []) as any[]
  if (!students.length) return []

  const studentIds = students.map(s => s.id as string)

  const { data: branchData } = await db.from('branches').select('id, name').in('id', branchIds)
  const branchNameMap = new Map<string, string>()
  for (const b of (branchData ?? []) as any[]) branchNameMap.set(b.id, b.name)

  const { data: accData } = await db
    .from('student_financial_accounts')
    .select('id, student_id, status, total_amount, net_amount, paid_amount, remaining_amount, next_due_date')
    .in('student_id', studentIds)
  const accountMap = new Map<string, any>()
  for (const a of (accData ?? []) as any[]) accountMap.set(a.student_id as string, a)

  const { data: enrollData } = await db
    .from('group_students')
    .select('student_id, group_id')
    .in('student_id', studentIds)
    .eq('status', 'active')
    .eq('enrollment_type', 'primary')
  const enrollMap = new Map<string, string>()
  for (const e of (enrollData ?? []) as any[]) {
    if (!enrollMap.has(e.student_id)) enrollMap.set(e.student_id as string, e.group_id as string)
  }

  const groupIds = [...new Set([...enrollMap.values()])]
  const groupMap = new Map<string, any>()
  const gcMap    = new Map<string, any>()

  if (groupIds.length) {
    const [{ data: gData }, { data: gcData }] = await Promise.all([
      db.from('groups').select('id, name, start_date').in('id', groupIds),
      db.from('group_courses').select(`id, group_id, instructors!group_courses_instructor_id_fkey(id,users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name,last_name)))`).in('group_id', groupIds).eq('status', 'active'),
    ])
    for (const g of (gData ?? []) as any[]) groupMap.set(g.id, g)
    for (const gc of (gcData ?? []) as any[]) { if (!gcMap.has(gc.group_id)) gcMap.set(gc.group_id, gc) }
  }

  const gcIds = [...gcMap.values()].map(gc => gc.id as string)
  const cutoff = new Date(Date.now() - 548 * 86400000).toISOString()
  const schedsByGc = new Map<string, any[]>()
  const schedInfoMap = new Map<string, any>()

  if (gcIds.length) {
    const { data: sData } = await db.from('schedules').select('id,group_course_id,scheduled_at,status').in('group_course_id', gcIds).neq('status','cancelled').gte('scheduled_at', cutoff)
    for (const s of (sData ?? []) as any[]) {
      if (!schedsByGc.has(s.group_course_id)) schedsByGc.set(s.group_course_id, [])
      schedsByGc.get(s.group_course_id)!.push(s)
      schedInfoMap.set(s.id, s)
    }
  }

  const completedIds = [...schedInfoMap.values()].filter(s => s.status === 'completed').map(s => s.id as string)
  const attByKey = new Map<string, Map<string, { status: string; scheduled_at: string }>>()

  if (completedIds.length && studentIds.length) {
    const { data: arData } = await db.from('attendance_records').select('student_id,schedule_id,status').in('student_id', studentIds).in('schedule_id', completedIds)
    for (const ar of (arData ?? []) as any[]) {
      const sched = schedInfoMap.get(ar.schedule_id)
      if (!sched) continue
      const key = `${ar.student_id}:${sched.group_course_id}`
      if (!attByKey.has(key)) attByKey.set(key, new Map())
      attByKey.get(key)!.set(ar.schedule_id, { status: ar.status, scheduled_at: sched.scheduled_at })
    }
  }

  const accIds = [...accountMap.values()].map(a => a.id as string)
  const instMap = new Map<string, { total: number; paid: number }>()
  if (accIds.length) {
    const { data: instData } = await db.from('finance_installments').select('account_id,status').in('account_id', accIds)
    for (const i of (instData ?? []) as any[]) {
      if (!instMap.has(i.account_id)) instMap.set(i.account_id, { total: 0, paid: 0 })
      const m = instMap.get(i.account_id)!
      m.total++
      if (i.status === 'PAID') m.paid++
    }
  }

  const POSITIVE = new Set(['present', 'late', 'makeup'])
  const rows: StudentOperationsRow[] = []

  for (const s of students) {
    const user     = s.users    ?? {}
    const profile  = user.profiles ?? {}
    const account  = accountMap.get(s.id)
    const groupId  = enrollMap.get(s.id) ?? null
    const group    = groupId ? groupMap.get(groupId) : null
    const gc       = groupId ? gcMap.get(groupId) : null
    const gcId     = gc?.id as string | undefined

    const instrProf = gc?.instructors?.users?.profiles
    const instructorName = instrProf ? [instrProf.first_name, instrProf.last_name].filter(Boolean).join(' ') || null : null
    const totalSessions = gcId ? (schedsByGc.get(gcId) ?? []).length : 0

    const completedGcScheds = gcId ? (schedsByGc.get(gcId) ?? []).filter((s: any) => s.status === 'completed').sort((a: any, b: any) => b.scheduled_at.localeCompare(a.scheduled_at)) : []
    const attKey  = `${s.id}:${gcId ?? ''}`
    const stuAttM = attByKey.get(attKey) ?? new Map()

    let sessionsAttended = 0, lastAttendanceDate: string | null = null, consecutiveAbsences = 0, streakDone = false
    for (const session of completedGcScheds) {
      const rec = stuAttM.get(session.id)
      const attended = rec ? POSITIVE.has(rec.status) : false
      if (attended) { sessionsAttended++; if (!lastAttendanceDate) lastAttendanceDate = session.scheduled_at.slice(0, 10); if (!streakDone) streakDone = true }
      else { if (!streakDone) consecutiveAbsences++ }
    }

    const totalCompleted = completedGcScheds.length
    const attendancePct  = totalCompleted > 0 ? Math.round((sessionsAttended / totalCompleted) * 100) : 0
    const financialStatus = (account?.status ?? null) as AccountStatus | null
    const netAmount = account ? Number(account.net_amount) : 0
    const paidAmount = account ? Number(account.paid_amount) : 0
    const remainingAmount = account ? Number(account.remaining_amount) : 0
    const nextDueDate = (account?.next_due_date as string | null) ?? null
    const daysOverdue = computeDaysOverdue(nextDueDate)
    const paymentPct = netAmount > 0 ? Math.round((paidAmount / netAmount) * 100) : 0
    const inst = account ? (instMap.get(account.id) ?? { total: 0, paid: 0 }) : { total: 0, paid: 0 }

    const { level: riskLevel, flags: riskFlags } = computeStudentRisk({ attendance_pct: attendancePct, financial_status: financialStatus, days_overdue: daysOverdue, consecutive_absences: consecutiveAbsences, sessions_attended: sessionsAttended, remaining_amount: remainingAmount })

    rows.push({
      enrollment_id:  null,   // no enrollment record yet (pre-migration)
      student_id:     s.id,
      account_id:     account?.id ?? null,
      group_id:       groupId,
      instructor_id:  gc?.instructors?.id ?? null,
      student_name:   [profile.first_name, profile.last_name].filter(Boolean).join(' ') || user.email || 'Unknown',
      student_code:   s.student_code ?? null,
      student_phone:  user.phone ?? null,
      student_status: s.status,
      parent_name:    null,
      parent_phone_1: null,
      parent_phone_2: null,
      branch_id:   s.branch_id,
      branch_name: branchNameMap.get(s.branch_id) ?? '',
      group_name:       group?.name       ?? null,
      course_name:      null,
      group_start_date: group?.start_date ?? null,
      instructor_name:  instructorName,
      total_sessions:  totalSessions,
      sessions_attended: sessionsAttended,
      attendance_pct:  attendancePct,
      last_attendance_date: lastAttendanceDate,
      consecutive_absences: consecutiveAbsences,
      // Sprint 44 defaults (pre-migration path has no session contract)
      enrolled_sessions:  0,
      consumed_sessions:  0,
      remaining_sessions: 0,
      financial_status: financialStatus,
      total_amount:    account ? Number(account.total_amount) : 0,
      net_amount:      netAmount,
      paid_amount:     paidAmount,
      remaining_amount: remainingAmount,
      installments_total:     inst.total,
      installments_paid:      inst.paid,
      installments_remaining: inst.total - inst.paid,
      next_due_date:   nextDueDate,
      payment_progress_pct: paymentPct,
      days_overdue:    daysOverdue,
      risk_level: riskLevel,
      risk_flags: riskFlags,
    })
  }

  const riskOrder: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  rows.sort((a, b) => { const d = riskOrder[a.risk_level] - riskOrder[b.risk_level]; return d !== 0 ? d : b.remaining_amount - a.remaining_amount })
  return rows
}

// ── Sprint 50.1: append students with no active enrollment ────────────────────
// These students are created in the system but haven't been enrolled yet.
// They must appear in the Students page (with NO_CONTRACT badge) but NOT in Finance.

async function _appendNoContractStudents(
  db: ReturnType<typeof createServiceClient>,
  branchIds: string[],
  existingRows: StudentOperationsRow[]
): Promise<StudentOperationsRow[]> {
  const enrolledStudentIds = new Set(existingRows.map(r => r.student_id))

  // Fetch branch names (reuse or re-fetch cheaply)
  const { data: branchData } = await db.from('branches').select('id, name').in('id', branchIds)
  const branchNameMap = new Map<string, string>()
  for (const b of (branchData ?? []) as any[]) branchNameMap.set(b.id, b.name)

  // Fetch all active students in these branches
  const { data: stuData } = await db
    .from('students')
    .select(`
      id, student_code, branch_id,
      users!students_user_id_fkey(
        email, phone,
        profiles!profiles_user_id_fkey(first_name, last_name)
      )
    `)
    .in('branch_id', branchIds)
    .eq('status', 'active')
    .is('deleted_at', null)
    .limit(1000)

  const noContractRows: StudentOperationsRow[] = []

  for (const stu of (stuData ?? []) as any[]) {
    // Skip students who already have an active enrollment row
    if (enrolledStudentIds.has(stu.id)) continue

    const user    = stu.users    ?? {}
    const profile = user.profiles ?? {}

    noContractRows.push({
      enrollment_id:           null,
      student_id:              stu.id,
      account_id:              null,
      group_id:                null,
      instructor_id:           null,
      student_name:            [profile.first_name, profile.last_name].filter(Boolean).join(' ') || user.email || 'Unknown',
      student_code:            stu.student_code ?? null,
      student_phone:           user.phone       ?? null,
      student_status:          'active',
      parent_name:             null,
      parent_phone_1:          null,
      parent_phone_2:          null,
      branch_id:               stu.branch_id,
      branch_name:             branchNameMap.get(stu.branch_id) ?? '',
      group_name:              null,
      course_name:             null,
      group_start_date:        null,
      instructor_name:         null,
      total_sessions:          0,
      sessions_attended:       0,
      attendance_pct:          0,
      last_attendance_date:    null,
      consecutive_absences:    0,
      enrolled_sessions:       0,
      consumed_sessions:       0,
      remaining_sessions:      0,
      financial_status:        null,
      total_amount:            0,
      net_amount:              0,
      paid_amount:             0,
      remaining_amount:        0,
      installments_total:      0,
      installments_paid:       0,
      installments_remaining:  0,
      next_due_date:           null,
      payment_progress_pct:    0,
      days_overdue:            0,
      risk_level:              'LOW' as RiskLevel,
      risk_flags:              ['no_contract'],
    })
  }

  // No-contract rows go at the END (after all risk-sorted enrollment rows)
  return [...existingRows, ...noContractRows]
}

// ── Phase XXVII: Expense listing ───────────────────────────────────────────────

export async function listExpenses(
  filters: import('./types').ExpenseFilters = {}
): Promise<import('./types').FinancialExpense[]> {
  const db = createServiceClient()

  // Bug fix: do NOT join users!created_by_fkey — that FK points to auth.users
  // (cross-schema), which PostgREST cannot traverse. Attempting it causes the
  // entire query to error and return null data. Creator name is left as null.
  let q = db
    .from('financial_expenses')
    .select(`
      id, expense_scope, expense_type, group_id, branch_id,
      amount, expense_date, notes, created_by, created_at, updated_at,
      groups!financial_expenses_group_id_fkey(name),
      branches!financial_expenses_branch_id_fkey(name)
    `)
    .order('expense_date', { ascending: false })

  if (filters.scope)        q = (q as any).eq('expense_scope',  filters.scope)
  if (filters.expense_type) q = (q as any).eq('expense_type',   filters.expense_type)
  if (filters.group_id)     q = (q as any).eq('group_id',       filters.group_id)
  if (filters.branch_id)    q = (q as any).eq('branch_id',      filters.branch_id)
  if (filters.date_from)    q = (q as any).gte('expense_date',  filters.date_from)
  if (filters.date_to)      q = (q as any).lte('expense_date',  filters.date_to)
  if (filters.branch_ids?.length) {
    // Bug fix: PostgREST .or() does NOT support SQL subqueries.
    // Pre-fetch group IDs that belong to these branches, then use explicit UUID lists.
    const { data: gidRows } = await db
      .from('groups')
      .select('id')
      .in('branch_id', filters.branch_ids)
    const groupIds = ((gidRows ?? []) as any[]).map(g => g.id as string)

    const parts: string[] = [`branch_id.in.(${filters.branch_ids.join(',')})`]
    if (groupIds.length > 0) {
      parts.push(`group_id.in.(${groupIds.join(',')})`)
    }
    q = (q as any).or(parts.join(','))
  }

  const { data, error } = await (q as any)
  if (error) {
    console.error('[listExpenses] query error:', error.message)
    return []
  }
  return ((data ?? []) as any[]).map(r => {
    return {
      id:             r.id,
      expense_scope:  r.expense_scope,
      expense_type:   r.expense_type,
      group_id:       r.group_id,
      branch_id:      r.branch_id,
      amount:         Number(r.amount),
      expense_date:   r.expense_date,
      notes:          r.notes,
      created_by:     r.created_by,
      created_at:     r.created_at,
      updated_at:     r.updated_at,
      group_name:      r.groups?.name ?? null,
      branch_name:     r.branches?.name ?? null,
      created_by_name: null,
    } as import('./types').FinancialExpense
  })
}

// ── Phase XXX: Group P&L — accrual model, all group statuses ──────────────────

export async function getGroupPnLRows(
  branchIds?: string[],
  opts?: { dateFrom?: string; dateTo?: string }
): Promise<import('./types').GroupPnL[]> {
  const db = createServiceClient()
  const dateFrom = opts?.dateFrom
  const dateTo   = opts?.dateTo
  const today    = new Date().toISOString().slice(0, 10)
  const from     = new Date(dateFrom ?? '2020-01-01')
  const to       = new Date(dateTo   ?? today)

  // 1. ALL groups — no status filter (finance must show every group regardless of status)
  let groupQ = db
    .from('groups')
    .select('id, name, branch_id, status, robocode_share_percent, branches!groups_branch_id_fkey(name)')
    .is('deleted_at', null)
  if (branchIds?.length) groupQ = (groupQ as any).in('branch_id', branchIds)
  const { data: groupData, error: groupErr } = await groupQ
  if (groupErr) console.error('[getGroupPnLRows] groups query error:', groupErr.message)
  const groups = (groupData ?? []) as any[]
  const groupIds = groups.map((g: any) => g.id as string)
  if (!groupIds.length) return []

  // 2. Group courses — title only; instructor data resolved via group_instructors below
  const { data: gcData, error: gcErr } = await db
    .from('group_courses')
    .select('id, group_id, total_sessions, instructor_id, courses!group_courses_course_id_fkey(title)')
    .in('group_id', groupIds)
  if (gcErr) console.error('[getGroupPnLRows] group_courses query error:', gcErr.message)
  const gcList = (gcData ?? []) as any[]

  const gcByGroup:     Record<string, any>    = {}
  const gcIdToGroupId: Record<string, string> = {}
  const gcIdToTotal:   Record<string, number>  = {}
  for (const gc of gcList) {
    if (!gcByGroup[gc.group_id]) gcByGroup[gc.group_id] = gc
    gcIdToGroupId[gc.id] = gc.group_id
    gcIdToTotal[gc.id]   = Number(gc.total_sessions ?? 0)
  }
  const gcIds = gcList.map(gc => gc.id as string)

  // 3. group_instructors — same lead+rate resolution as Payroll (getLiveInstructorFinance)
  const { data: giData } = await db
    .from('group_instructors')
    .select('group_id, instructor_id, role, session_rate')
    .in('group_id', groupIds)
  const groupLeadMap   = new Map<string, string>()         // group_id → lead instructor_id
  const groupRateByKey = new Map<string, number | null>()  // `${instructor_id}:${group_id}` → rate
  for (const gi of (giData ?? []) as any[]) {
    if (!groupLeadMap.has(gi.group_id) || gi.role === 'lead') {
      groupLeadMap.set(gi.group_id, gi.instructor_id)
    }
    groupRateByKey.set(`${gi.instructor_id}:${gi.group_id}`, gi.session_rate != null ? Number(gi.session_rate) : null)
  }

  // Resolve effective instructor per gc: gc.instructor_id ?? group lead (matches Payroll)
  const gcInstructorMap: Record<string, string | null> = {}
  const instrIdByGroup:  Record<string, string>         = {}
  const collectInstrIds  = new Set<string>()
  for (const gc of gcList) {
    const iid = gc.instructor_id ?? groupLeadMap.get(gc.group_id) ?? null
    gcInstructorMap[gc.id] = iid
    if (iid) {
      if (!instrIdByGroup[gc.group_id]) instrIdByGroup[gc.group_id] = iid
      collectInstrIds.add(iid)
    }
  }
  const allInstrIds = [...collectInstrIds]

  // Instructor base rates + user_id for name lookup
  const instrBaseRate:  Record<string, number> = {}
  const instrUserIdMap: Record<string, string> = {}
  if (allInstrIds.length) {
    const { data: instrData } = await db
      .from('instructors')
      .select('id, user_id, salary_per_session')
      .in('id', allInstrIds)
    for (const i of (instrData ?? []) as any[]) {
      instrBaseRate[i.id]  = Number(i.salary_per_session ?? 0)
      instrUserIdMap[i.id] = i.user_id
    }
  }

  // Effective display rate per gc: group_instructors.session_rate ?? base
  const gcIdToRate: Record<string, number> = {}
  for (const gc of gcList) {
    const iid  = gcInstructorMap[gc.id]
    const gid  = gc.group_id
    const base = iid ? (instrBaseRate[iid] ?? 0) : 0
    const grR  = iid ? (groupRateByKey.get(`${iid}:${gid}`) ?? null) : null
    gcIdToRate[gc.id] = grR ?? base
  }

  // Instructor names
  const instrUserIds = [...new Set(Object.values(instrUserIdMap).filter(Boolean))] as string[]
  const instrNameByUserId: Record<string, string> = {}
  if (instrUserIds.length) {
    const { data: profData } = await db
      .from('profiles')
      .select('user_id, first_name, last_name')
      .in('user_id', instrUserIds)
    for (const p of (profData ?? []) as any[]) {
      instrNameByUserId[p.user_id] = [p.first_name, p.last_name].filter(Boolean).join(' ')
    }
  }

  // 4. Session overrides keyed by instructor_id:schedule_id (matches Payroll exactly)
  const overrideByKey = new Map<string, number>()
  if (gcIds.length) {
    const { data: overrideData } = await (db
      .from('payroll_session_overrides')
      .select('schedule_id, instructor_id, override_rate') as any)
    for (const o of (overrideData ?? []) as any[]) {
      overrideByKey.set(`${o.instructor_id}:${o.schedule_id}`, Number(o.override_rate))
    }
  }

  // 5. Completed sessions — 3-level rate hierarchy: override → group_rate → base (matches Payroll)
  const completedByGroup: Record<string, number> = {}
  const earnedByGroup:    Record<string, number> = {}
  if (gcIds.length) {
    let schedQ = db
      .from('schedules')
      .select('id, group_course_id, status, scheduled_at')
      .in('group_course_id', gcIds)
    if (dateFrom) schedQ = (schedQ as any).gte('scheduled_at', dateFrom)
    if (dateTo)   schedQ = (schedQ as any).lte('scheduled_at', dateTo + 'T23:59:59')
    const { data: schedData } = await schedQ
    for (const s of (schedData ?? []) as any[]) {
      if (s.status !== 'completed') continue
      const gid = gcIdToGroupId[s.group_course_id]
      if (!gid) continue
      completedByGroup[gid] = (completedByGroup[gid] ?? 0) + 1
      const iid  = gcInstructorMap[s.group_course_id] ?? null
      if (!iid) continue
      const baseR = instrBaseRate[iid] ?? 0
      const grR   = groupRateByKey.get(`${iid}:${gid}`) ?? null
      const ovR   = overrideByKey.get(`${iid}:${s.id}`) ?? null
      earnedByGroup[gid] = (earnedByGroup[gid] ?? 0) + (ovR ?? grR ?? baseR)
    }
  }

  // 6. Instructor paid — from instructor_payouts attributed to each group
  //    payouts are per-instructor, not per-group; we sum all payouts for the instructor
  //    teaching each group (status='paid' records only)
  const instrPaidByGroup: Record<string, number> = {}
  if (allInstrIds.length) {
    const { data: payoutData } = await (db
      .from('instructor_payouts')
      .select('instructor_id, amount, status')
      .in('instructor_id', allInstrIds)
      .eq('status', 'paid') as any)
    // Total paid per instructor
    const paidByInstr: Record<string, number> = {}
    for (const p of (payoutData ?? []) as any[]) {
      paidByInstr[p.instructor_id] = (paidByInstr[p.instructor_id] ?? 0) + Number(p.amount)
    }
    // Attribution: how many groups does each instructor teach? Divide paid proportionally.
    const groupsPerInstr: Record<string, number> = {}
    for (const [gid, iid] of Object.entries(instrIdByGroup)) {
      if (groupIds.includes(gid)) groupsPerInstr[iid] = (groupsPerInstr[iid] ?? 0) + 1
    }
    for (const [gid, iid] of Object.entries(instrIdByGroup)) {
      const totalPaid = paidByInstr[iid] ?? 0
      const share     = groupsPerInstr[iid] ?? 1
      instrPaidByGroup[gid] = totalPaid / share
    }
  }

  // 7. Revenue via group_students → student_financial_accounts
  const { data: gsData } = await db
    .from('group_students')
    .select('group_id, student_id')
    .in('group_id', groupIds)
    .eq('status', 'active')
  const gsRows = (gsData ?? []) as any[]

  const studentCountByGroup: Record<string, number> = {}
  const groupsByStudent:     Record<string, string[]> = {}
  for (const gs of gsRows) {
    studentCountByGroup[gs.group_id] = (studentCountByGroup[gs.group_id] ?? 0) + 1
    if (!groupsByStudent[gs.student_id]) groupsByStudent[gs.student_id] = []
    groupsByStudent[gs.student_id].push(gs.group_id)
  }

  const revenueByGroup: Record<string, { expected: number; collected: number; outstanding: number }> = {}
  const allMemberStudentIds = Object.keys(groupsByStudent)
  if (allMemberStudentIds.length) {
    const { data: accData } = await db
      .from('student_financial_accounts')
      .select('student_id, net_amount, paid_amount, remaining_amount, status')
      .in('student_id', allMemberStudentIds)
    for (const a of (accData ?? []) as any[]) {
      for (const gid of (groupsByStudent[a.student_id] ?? [])) {
        if (!revenueByGroup[gid]) revenueByGroup[gid] = { expected: 0, collected: 0, outstanding: 0 }
        revenueByGroup[gid].expected   += Number(a.net_amount)
        revenueByGroup[gid].collected  += Number(a.paid_amount)
        revenueByGroup[gid].outstanding += a.status !== 'PAID' ? Number(a.remaining_amount) : 0
      }
    }
  }

  // 8. Manual group expenses (date-filtered, exclude INSTRUCTOR type)
  let expQ = db
    .from('financial_expenses')
    .select('group_id, amount, expense_type')
    .eq('expense_scope', 'GROUP')
    .in('group_id', groupIds)
  if (dateFrom) expQ = (expQ as any).gte('expense_date', dateFrom)
  if (dateTo)   expQ = (expQ as any).lte('expense_date', dateTo)
  const { data: expData } = await expQ
  const manualExpByGroup: Record<string, number> = {}
  for (const e of (expData ?? []) as any[]) {
    if (e.expense_type === 'INSTRUCTOR') continue
    manualExpByGroup[e.group_id] = (manualExpByGroup[e.group_id] ?? 0) + Number(e.amount)
  }

  // 9. Recurring group expenses (prorated by months active in date range)
  const { data: recurData } = await db
    .from('recurring_expenses')
    .select('id, group_id, branch_id, expense_scope, expense_type, amount, start_date, end_date, is_active, notes, created_by, created_at, updated_at')
    .eq('expense_scope', 'GROUP')
    .in('group_id', groupIds)
  const allRecurring = ((recurData ?? []) as any[]).map(r => ({
    ...r, amount: Number(r.amount), expense_type: r.expense_type as ExpenseType,
  })) as RecurringExpense[]
  const recurByGroup: Record<string, number> = {}
  for (const gid of groupIds) {
    recurByGroup[gid] = sumRecurring(allRecurring, from, to, gid, undefined, 'GROUP')
  }

  // 10. Build rows — EVERY group included regardless of status
  return groups.map((g: any) => {
    const gc            = gcByGroup[g.id]
    const instrId       = instrIdByGroup[g.id] ?? null
    const instrUId      = instrId ? (instrUserIdMap[instrId] ?? null) : null
    const instrName     = instrUId ? (instrNameByUserId[instrUId] ?? null) : null
    const courseName    = gc?.courses?.title ?? null

    // Instructor accrual
    const gcId          = gc?.id
    const sessionRate   = gcId ? (gcIdToRate[gcId] ?? 0) : 0
    const totalPlanned  = gcId ? (gcIdToTotal[gcId] ?? 0) : 0
    const completed     = completedByGroup[g.id] ?? 0
    const earned        = earnedByGroup[g.id] ?? 0
    const paid          = instrPaidByGroup[g.id] ?? 0
    const remaining_sessions = Math.max(totalPlanned - completed, 0)
    const futureLiability   = remaining_sessions * sessionRate
    const finalInstrCost    = earned + futureLiability

    // Revenue
    const rev           = revenueByGroup[g.id] ?? { expected: 0, collected: 0, outstanding: 0 }

    // Phase XXXII: revenue share
    const sharePct       = Number(g.robocode_share_percent ?? 100)
    const netExpected    = rev.expected  * sharePct / 100
    const netCollected   = rev.collected * sharePct / 100

    // Expenses
    const manualExp     = manualExpByGroup[g.id] ?? 0
    const recurExp      = recurByGroup[g.id]      ?? 0
    const otherExp      = manualExp + recurExp
    const totalExp      = finalInstrCost + otherExp

    const collRate      = rev.expected > 0 ? Math.round((rev.collected / rev.expected) * 100) : 0

    return {
      group_id:                g.id,
      group_name:              g.name,
      group_status:            g.status ?? 'active',
      branch_id:               g.branch_id,
      branch_name:             (g.branches as any)?.name ?? '',
      course_name:             courseName,
      instructor_name:         instrName,
      student_count:           studentCountByGroup[g.id] ?? 0,
      robocode_share_percent:  sharePct,
      gross_expected_revenue:  rev.expected,
      gross_collected_revenue: rev.collected,
      outstanding:             rev.outstanding,
      collection_rate:         collRate,
      net_expected_revenue:    netExpected,
      net_collected_revenue:   netCollected,
      total_sessions:          totalPlanned,
      completed_sessions:      completed,
      remaining_sessions,
      session_rate:            sessionRate,
      instructor_earned:       earned,
      instructor_paid:         paid,
      instructor_remaining:    earned - paid,
      future_liability:        futureLiability,
      final_instructor_cost:   finalInstrCost,
      manual_expenses:         manualExp,
      recurring_expenses:      recurExp,
      other_expenses:          otherExp,
      total_expenses:          totalExp,
      expected_profit:         netExpected  - totalExp,
      actual_profit:           netCollected - (earned + otherExp),
    } as import('./types').GroupPnL
  })
}

// ── Phase XXX: Branch P&L — accrual model, all group statuses ─────────────────

export async function getBranchPnLRows(
  branchIds?: string[],
  opts?: { dateFrom?: string; dateTo?: string }
): Promise<import('./types').BranchPnL[]> {
  const db      = createServiceClient()
  const dateFrom = opts?.dateFrom
  const dateTo   = opts?.dateTo
  const today    = new Date().toISOString().slice(0, 10)
  const from     = new Date(dateFrom ?? '2020-01-01')
  const to       = new Date(dateTo   ?? today)

  // 1. Branches
  let branchQ = db.from('branches').select('id, name').eq('is_active', true).is('deleted_at', null)
  if (branchIds?.length) branchQ = (branchQ as any).in('id', branchIds)
  const { data: branchData } = await branchQ
  const branches = (branchData ?? []) as any[]
  const allBranchIds = branches.map((b: any) => b.id as string)
  if (!allBranchIds.length) return []

  const branchNameById: Record<string, string> = Object.fromEntries(
    branches.map((b: any) => [b.id as string, b.name as string])
  )

  // 2. Revenue by branch_id (all-time; branch_id is populated on financial accounts)
  const { data: accData } = await db
    .from('student_financial_accounts')
    .select('branch_id, group_id, net_amount, paid_amount, remaining_amount, status')
    .in('branch_id', allBranchIds)
  const accRows = (accData ?? []) as any[]

  // Phase XXXII: fetch share% for every group that appears on accounts
  const accGroupIds = [...new Set(accRows.map((a: any) => a.group_id as string | null).filter(Boolean))] as string[]
  const shareByGroupBranch: Record<string, number> = {}
  if (accGroupIds.length) {
    const { data: grpShareData } = await db
      .from('groups')
      .select('id, robocode_share_percent')
      .in('id', accGroupIds)
    for (const g of (grpShareData ?? []) as any[]) {
      shareByGroupBranch[g.id as string] = Number(g.robocode_share_percent ?? 100)
    }
  }

  const revByBranch: Record<string, {
    gross_expected: number; gross_collected: number; outstanding: number; students: number
    net_expected: number; net_collected: number
  }> = {}
  for (const a of accRows) {
    const bid   = a.branch_id as string
    const share = a.group_id ? (shareByGroupBranch[a.group_id] ?? 100) : 100
    if (!revByBranch[bid]) revByBranch[bid] = { gross_expected: 0, gross_collected: 0, outstanding: 0, students: 0, net_expected: 0, net_collected: 0 }
    revByBranch[bid].gross_expected  += Number(a.net_amount)
    revByBranch[bid].gross_collected += Number(a.paid_amount)
    revByBranch[bid].outstanding     += a.status !== 'PAID' ? Number(a.remaining_amount) : 0
    revByBranch[bid].students        += 1
    revByBranch[bid].net_expected    += Number(a.net_amount)  * share / 100
    revByBranch[bid].net_collected   += Number(a.paid_amount) * share / 100
  }

  // 3. Group IDs + count per branch (ALL statuses)
  const { data: groupsForBranch } = await db
    .from('groups')
    .select('id, branch_id')
    .in('branch_id', allBranchIds)
    .is('deleted_at', null)
  const groupCountByBranch:  Record<string, number> = {}
  const branchIdByGroupId:   Record<string, string> = {}
  const allBranchGroupIds:   string[]               = []
  for (const g of (groupsForBranch ?? []) as any[]) {
    groupCountByBranch[g.branch_id] = (groupCountByBranch[g.branch_id] ?? 0) + 1
    branchIdByGroupId[g.id]         = g.branch_id
    allBranchGroupIds.push(g.id)
  }

  // 4. Instructor earned + future liability — 3-level hierarchy matching Payroll exactly
  const instrEarnedByBranch: Record<string, number> = {}
  const futureLiabByBranch:  Record<string, number> = {}

  if (allBranchGroupIds.length) {
    // 4a. Group courses — no nested joins needed
    const { data: gcData4 } = await db
      .from('group_courses')
      .select('id, group_id, total_sessions, instructor_id')
      .in('group_id', allBranchGroupIds)
    const gcList4 = (gcData4 ?? []) as any[]
    const totalByGcId4: Record<string, number> = {}
    const gcGroupMap4:  Record<string, string>  = {}
    for (const gc of gcList4) {
      totalByGcId4[gc.id] = Number(gc.total_sessions ?? 0)
      gcGroupMap4[gc.id]  = gc.group_id
    }
    const gcIds4 = gcList4.map(gc => gc.id as string)

    // 4b. group_instructors — lead + group-specific rates
    const { data: giData4 } = await db
      .from('group_instructors')
      .select('group_id, instructor_id, role, session_rate')
      .in('group_id', allBranchGroupIds)
    const leadMap4   = new Map<string, string>()
    const rateKey4   = new Map<string, number | null>()
    for (const gi of (giData4 ?? []) as any[]) {
      if (!leadMap4.has(gi.group_id) || gi.role === 'lead') leadMap4.set(gi.group_id, gi.instructor_id)
      rateKey4.set(`${gi.instructor_id}:${gi.group_id}`, gi.session_rate != null ? Number(gi.session_rate) : null)
    }

    // 4c. Effective instructor per gc
    const gcInstr4: Record<string, string | null> = {}
    const iids4 = new Set<string>()
    for (const gc of gcList4) {
      const iid = gc.instructor_id ?? leadMap4.get(gc.group_id) ?? null
      gcInstr4[gc.id] = iid
      if (iid) iids4.add(iid)
    }

    // 4d. Instructor base rates
    const base4: Record<string, number> = {}
    const instrIdsList4 = [...iids4]
    if (instrIdsList4.length) {
      const { data: iData4 } = await db
        .from('instructors')
        .select('id, salary_per_session')
        .in('id', instrIdsList4)
      for (const i of (iData4 ?? []) as any[]) base4[i.id] = Number(i.salary_per_session ?? 0)
    }

    // 4e. Completed sessions + overrides
    const completedByGcId: Record<string, number> = {}
    if (gcIds4.length) {
      let schedQ4 = db
        .from('schedules')
        .select('id, group_course_id')
        .eq('status', 'completed')
        .in('group_course_id', gcIds4)
      if (dateFrom) schedQ4 = (schedQ4 as any).gte('scheduled_at', `${dateFrom}T00:00:00`)
      if (dateTo)   schedQ4 = (schedQ4 as any).lte('scheduled_at', `${dateTo}T23:59:59`)
      const { data: schedData4 } = await schedQ4
      const schedIds4 = ((schedData4 ?? []) as any[]).map(s => s.id as string)

      const ovMap4: Record<string, number> = {}
      if (schedIds4.length) {
        const { data: ovData4 } = await db
          .from('payroll_session_overrides')
          .select('schedule_id, instructor_id, override_rate')
          .in('schedule_id', schedIds4)
        for (const o of (ovData4 ?? []) as any[]) {
          ovMap4[`${o.instructor_id}:${o.schedule_id}`] = Number(o.override_rate)
        }
      }

      for (const s of (schedData4 ?? []) as any[]) {
        const gid = gcGroupMap4[s.group_course_id]
        const bid = gid ? branchIdByGroupId[gid] : undefined
        if (!bid) continue
        completedByGcId[s.group_course_id] = (completedByGcId[s.group_course_id] ?? 0) + 1
        const iid = gcInstr4[s.group_course_id] ?? null
        if (!iid) continue
        const b = base4[iid] ?? 0
        const g = gid ? (rateKey4.get(`${iid}:${gid}`) ?? null) : null
        const o = ovMap4[`${iid}:${s.id}`] ?? null
        instrEarnedByBranch[bid] = (instrEarnedByBranch[bid] ?? 0) + (o ?? g ?? b)
      }

      // Future liability
      for (const gc of gcList4) {
        const gid  = gcGroupMap4[gc.id]
        const bid  = gid ? branchIdByGroupId[gid] : undefined
        const iid  = gcInstr4[gc.id] ?? null
        if (!bid || !iid) continue
        const comp   = completedByGcId[gc.id] ?? 0
        const remain = Math.max(totalByGcId4[gc.id] - comp, 0)
        const b      = base4[iid] ?? 0
        const g      = gid ? (rateKey4.get(`${iid}:${gid}`) ?? null) : null
        futureLiabByBranch[bid] = (futureLiabByBranch[bid] ?? 0) + remain * (g ?? b)
      }
    }
  }

  // 5. Instructor paid by branch (from instructor_payouts)
  const instrPaidByBranch: Record<string, number> = {}
  const { data: payoutData } = await (db
    .from('instructor_payouts')
    .select('branch_id, amount, status')
    .in('branch_id', allBranchIds)
    .eq('status', 'paid') as any)
  for (const p of (payoutData ?? []) as any[]) {
    instrPaidByBranch[p.branch_id] = (instrPaidByBranch[p.branch_id] ?? 0) + Number(p.amount)
  }

  // 6. Branch manual expenses (BRANCH scope)
  let branchExpQ = db
    .from('financial_expenses')
    .select('branch_id, amount')
    .eq('expense_scope', 'BRANCH')
    .in('branch_id', allBranchIds)
  if (dateFrom) branchExpQ = (branchExpQ as any).gte('expense_date', dateFrom)
  if (dateTo)   branchExpQ = (branchExpQ as any).lte('expense_date', dateTo)
  const { data: branchExpData } = await branchExpQ
  const branchExpByBranch: Record<string, number> = {}
  for (const e of (branchExpData ?? []) as any[]) {
    branchExpByBranch[e.branch_id] = (branchExpByBranch[e.branch_id] ?? 0) + Number(e.amount)
  }

  // 7. Group manual expenses → allocated to branch
  let groupExpQ = db
    .from('financial_expenses')
    .select('group_id, amount, expense_type, groups!financial_expenses_group_id_fkey(branch_id)')
    .eq('expense_scope', 'GROUP')
  if (dateFrom) groupExpQ = (groupExpQ as any).gte('expense_date', dateFrom)
  if (dateTo)   groupExpQ = (groupExpQ as any).lte('expense_date', dateTo)
  const { data: groupExpData } = await groupExpQ
  const groupExpByBranch: Record<string, number> = {}
  for (const e of (groupExpData ?? []) as any[]) {
    if (e.expense_type === 'INSTRUCTOR') continue
    const bid = e.groups?.branch_id as string | undefined
    if (!bid || !allBranchIds.includes(bid)) continue
    groupExpByBranch[bid] = (groupExpByBranch[bid] ?? 0) + Number(e.amount)
  }

  // 8. Recurring expenses
  const { data: recurData } = await db
    .from('recurring_expenses')
    .select('group_id, branch_id, expense_scope, amount, start_date, end_date, is_active, expense_type')
  const allRecurring = ((recurData ?? []) as any[]).map(r => ({
    ...r, id: '', created_by: null, notes: null, created_at: '', updated_at: '',
    expense_type: r.expense_type as ExpenseType,
  })) as RecurringExpense[]

  // 9. Build rows
  return branches.map((b: any) => {
    const rev            = revByBranch[b.id] ?? { gross_expected: 0, gross_collected: 0, outstanding: 0, students: 0, net_expected: 0, net_collected: 0 }
    const earned         = instrEarnedByBranch[b.id] ?? 0
    const paid           = instrPaidByBranch[b.id]   ?? 0
    const futLiab        = futureLiabByBranch[b.id]  ?? 0
    const finalInstr     = earned + futLiab
    const branchExp      = branchExpByBranch[b.id]   ?? 0
    const groupExp       = groupExpByBranch[b.id]     ?? 0
    const branchRecur    = sumRecurring(allRecurring, from, to, undefined, b.id, 'BRANCH')
    const totalExp       = finalInstr + branchExp + branchRecur + groupExp
    const rate           = rev.gross_expected > 0 ? Math.round((rev.gross_collected / rev.gross_expected) * 100) : 0

    return {
      branch_id:                   b.id,
      branch_name:                 branchNameById[b.id] ?? b.name,
      student_count:               rev.students,
      group_count:                 groupCountByBranch[b.id] ?? 0,
      gross_expected_revenue:      rev.gross_expected,
      gross_collected_revenue:     rev.gross_collected,
      outstanding:                 rev.outstanding,
      collection_rate:             rate,
      net_expected_revenue:        rev.net_expected,
      net_collected_revenue:       rev.net_collected,
      instructor_earned:           earned,
      instructor_paid:             paid,
      instructor_remaining:        earned - paid,
      future_liability:            futLiab,
      final_instructor_cost:       finalInstr,
      branch_expenses:             branchExp,
      branch_recurring_expenses:   branchRecur,
      group_expenses:              groupExp,
      group_recurring_expenses:    0,
      total_expenses:              totalExp,
      expected_profit:             rev.net_expected - totalExp,
      actual_profit:               rev.net_collected - (earned + branchExp + branchRecur + groupExp),
    } as import('./types').BranchPnL
  }).sort((a, b) => b.gross_expected_revenue - a.gross_expected_revenue)
}

// ── Phase XXX: Academy P&L — accrual model, monthly trend ─────────────────────

export async function getAcademyPnL(
  branchIds?: string[],
  opts?: { dateFrom?: string; dateTo?: string }
): Promise<import('./types').AcademyPnL> {
  const db  = createServiceClient()
  const now = new Date()

  // Last 6 months for trend
  const months: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const rangeStart = `${months[0]}-01`
  const rangeEnd   = now.toISOString().slice(0, 10)

  // 1. Revenue totals (all-time) — fetch group_id so we can apply share%
  let accQ = db.from('student_financial_accounts').select('id, net_amount, paid_amount, remaining_amount, status, group_id')
  if (branchIds?.length) accQ = (accQ as any).in('branch_id', branchIds)
  const { data: accData } = await accQ
  const accounts = (accData ?? []) as any[]

  // Phase XXXII: fetch share% for every group referenced by accounts
  const acGroupIds = [...new Set(accounts.map((a: any) => a.group_id as string | null).filter(Boolean))] as string[]
  const shareByGroupAcademy: Record<string, number> = {}
  if (acGroupIds.length) {
    const { data: grpShareRows } = await db
      .from('groups')
      .select('id, robocode_share_percent')
      .in('id', acGroupIds)
    for (const g of (grpShareRows ?? []) as any[]) {
      shareByGroupAcademy[g.id as string] = Number(g.robocode_share_percent ?? 100)
    }
  }

  // Also build account_id → group_id map for payment-level net calculation in monthly trend
  const accGroupMapAcademy: Record<string, string | null> = {}
  let totalGrossExpected = 0, totalGrossCollected = 0, totalNetExpected = 0, totalNetCollected = 0, totalOutstanding = 0
  for (const a of accounts) {
    const share = a.group_id ? (shareByGroupAcademy[a.group_id] ?? 100) : 100
    totalGrossExpected  += Number(a.net_amount)
    totalGrossCollected += Number(a.paid_amount)
    totalNetExpected    += Number(a.net_amount)  * share / 100
    totalNetCollected   += Number(a.paid_amount) * share / 100
    if (a.status !== 'PAID') totalOutstanding += Number(a.remaining_amount)
    if (a.id) accGroupMapAcademy[a.id as string] = a.group_id ?? null
  }
  const collectionRate = totalGrossExpected > 0 ? Math.round((totalGrossCollected / totalGrossExpected) * 100) : 0

  // 2. Monthly payments (for trend)
  let payQ = db.from('finance_payments')
    .select('amount, payment_date, account_id')
    .gte('payment_date', rangeStart)
    .lte('payment_date', rangeEnd)
  if (branchIds?.length) {
    const { data: idRows } = await (db.from('student_financial_accounts').select('id') as any).in('branch_id', branchIds)
    const scopedAccIds = ((idRows ?? []) as any[]).map((r: any) => r.id as string)
    if (scopedAccIds.length) payQ = (payQ as any).in('account_id', scopedAccIds)
  }
  const { data: payData } = await payQ
  const payments = (payData ?? []) as any[]

  // 3. All completed sessions — for earned + monthly trend (no nested FK for rate)
  let allSessQ = db.from('schedules')
    .select('id, scheduled_at, group_course_id')
    .eq('status', 'completed')
  if (branchIds?.length) allSessQ = (allSessQ as any).in('branch_id', branchIds)
  const { data: allSessData } = await allSessQ
  const allSessions = (allSessData ?? []) as any[]

  // Resolve instructor rates for all group_courses (3-level hierarchy — matches Payroll)
  const acGcIds = [...new Set(allSessions.map(s => s.group_course_id as string).filter(Boolean))]
  const acGcInstr:  Record<string, string | null> = {}
  const acGcGroup:  Record<string, string>         = {}
  const acBase:     Record<string, number>          = {}
  const acGrRate  = new Map<string, number | null>()

  if (acGcIds.length) {
    const { data: acGcRows } = await db
      .from('group_courses')
      .select('id, group_id, instructor_id')
      .in('id', acGcIds)
    for (const gc of (acGcRows ?? []) as any[]) acGcGroup[gc.id] = gc.group_id

    const acGrpIds = [...new Set(Object.values(acGcGroup))]
    const { data: acGiRows } = await db
      .from('group_instructors')
      .select('group_id, instructor_id, role, session_rate')
      .in('group_id', acGrpIds)
    const acLead = new Map<string, string>()
    for (const gi of (acGiRows ?? []) as any[]) {
      if (!acLead.has(gi.group_id) || gi.role === 'lead') acLead.set(gi.group_id, gi.instructor_id)
      acGrRate.set(`${gi.instructor_id}:${gi.group_id}`, gi.session_rate != null ? Number(gi.session_rate) : null)
    }
    for (const gc of (acGcRows ?? []) as any[]) {
      acGcInstr[gc.id] = gc.instructor_id ?? acLead.get(gc.group_id) ?? null
    }
    const acInstrIds = [...new Set(Object.values(acGcInstr).filter(Boolean) as string[])]
    if (acInstrIds.length) {
      const { data: acIRows } = await db
        .from('instructors')
        .select('id, salary_per_session')
        .in('id', acInstrIds)
      for (const i of (acIRows ?? []) as any[]) acBase[i.id] = Number(i.salary_per_session ?? 0)
    }
  }

  // Per-session overrides keyed by instructor_id:schedule_id (matches Payroll)
  const allSessIds = allSessions.map(s => s.id as string)
  const overrideMap: Record<string, number> = {}
  if (allSessIds.length) {
    const { data: ovData } = await (db.from('payroll_session_overrides').select('schedule_id, instructor_id, override_rate').in('schedule_id', allSessIds) as any)
    for (const o of (ovData ?? []) as any[]) overrideMap[`${o.instructor_id}:${o.schedule_id}`] = Number(o.override_rate)
  }

  function acRate(sess: any): number {
    const iid  = acGcInstr[sess.group_course_id] ?? null
    if (!iid) return 0
    const gid  = acGcGroup[sess.group_course_id] ?? null
    const base = acBase[iid] ?? 0
    const grR  = gid ? (acGrRate.get(`${iid}:${gid}`) ?? null) : null
    const ovR  = overrideMap[`${iid}:${sess.id}`] ?? null
    return ovR ?? grR ?? base
  }

  // Total instructor earned (all-time)
  const totalInstrEarned = allSessions.reduce((s, sess) => s + acRate(sess), 0)

  // Monthly sessions (for trend)
  const monthlySessions = allSessions.filter(s =>
    (s.scheduled_at as string) >= `${rangeStart}T00:00:00`
  )

  // 4. Future liability — remaining planned sessions × effective rate (3-level hierarchy)
  const completedByGcId: Record<string, number> = {}
  for (const s of allSessions) {
    completedByGcId[s.group_course_id] = (completedByGcId[s.group_course_id] ?? 0) + 1
  }

  const gcAllQ = db.from('group_courses')
    .select('id, group_id, total_sessions, instructor_id, groups!group_courses_group_id_fkey(branch_id, deleted_at)')
  const { data: gcAllData } = await gcAllQ
  const gcAll = ((gcAllData ?? []) as any[]).filter(gc => {
    if (gc.groups?.deleted_at) return false
    if (branchIds?.length && !branchIds.includes(gc.groups?.branch_id)) return false
    return true
  })

  // For group_courses not in acGcInstr (0 completed sessions), resolve instructor inline
  const totalFutureLiab = gcAll.reduce((sum, gc) => {
    const completed = completedByGcId[gc.id] ?? 0
    const remaining = Math.max(Number(gc.total_sessions ?? 0) - completed, 0)
    if (remaining === 0) return sum
    // Use pre-computed instructor data if available (gc was in allSessions)
    const iid  = acGcInstr[gc.id] ?? gc.instructor_id ?? null
    const gid  = acGcGroup[gc.id] ?? gc.group_id ?? null
    const base = iid ? (acBase[iid] ?? 0) : 0
    const grR  = (iid && gid) ? (acGrRate.get(`${iid}:${gid}`) ?? null) : null
    return sum + remaining * (grR ?? base)
  }, 0)

  const totalFinalInstrCost = totalInstrEarned + totalFutureLiab

  // 5. Instructor paid (from instructor_payouts, status='paid')
  let payoutsQ = db.from('instructor_payouts').select('amount').eq('status', 'paid')
  if (branchIds?.length) payoutsQ = (payoutsQ as any).in('branch_id', branchIds)
  const { data: payoutsData } = await payoutsQ
  const totalInstrPaid = ((payoutsData ?? []) as any[]).reduce((s, p) => s + Number(p.amount), 0)

  // 6. Manual expenses (all-time)
  const totalExpQ = db.from('financial_expenses').select('amount, expense_scope, expense_type')
  const { data: allExpData } = await totalExpQ
  const allExpenses = (allExpData ?? []) as any[]
  const totalBranchExp  = allExpenses.filter(e => e.expense_scope === 'BRANCH').reduce((s, e) => s + Number(e.amount), 0)
  const totalGroupExp   = allExpenses.filter(e => e.expense_scope === 'GROUP' && e.expense_type !== 'INSTRUCTOR').reduce((s, e) => s + Number(e.amount), 0)
  const totalAcademyExp = allExpenses.filter(e => e.expense_scope === 'ACADEMY').reduce((s, e) => s + Number(e.amount), 0)

  // Monthly expenses (for trend)
  const { data: expData } = await db.from('financial_expenses')
    .select('amount, expense_date, expense_scope, expense_type')
    .gte('expense_date', rangeStart)
    .lte('expense_date', rangeEnd)
  const monthlyExpenses = (expData ?? []) as any[]

  // 7. Recurring expenses (all-time)
  const { data: recurData } = await db
    .from('recurring_expenses')
    .select('group_id, branch_id, expense_scope, amount, start_date, end_date, is_active, expense_type')
  const allRecurring = ((recurData ?? []) as any[]).map(r => ({
    ...r, id: '', created_by: null, notes: null, created_at: '', updated_at: '',
    expense_type: r.expense_type as ExpenseType,
  })) as RecurringExpense[]
  const allTimeFrom   = new Date('2020-01-01')
  const allTimeTo     = new Date()
  const totalBranchRecur  = sumRecurring(allRecurring, allTimeFrom, allTimeTo, undefined, undefined, 'BRANCH')
  const totalGroupRecur   = sumRecurring(allRecurring, allTimeFrom, allTimeTo, undefined, undefined, 'GROUP')
  const totalAcademyRecur = sumRecurring(allRecurring, allTimeFrom, allTimeTo, undefined, undefined, 'ACADEMY')

  const totalManualExp = totalBranchExp + totalBranchRecur + totalGroupExp + totalGroupRecur + totalAcademyExp + totalAcademyRecur
  const totalExpenses  = totalFinalInstrCost + totalManualExp

  // 8. Monthly trend
  const monthly_trend: import('./types').MonthlyPnL[] = months.map(m => {
    const d     = new Date(`${m}-01`)
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' })

    const monthPayments = payments.filter((p: any) => (p.payment_date as string).startsWith(m))

    const grossCollectedRev = monthPayments.reduce((s: number, p: any) => s + Number(p.amount), 0)

    // Phase XXXII: net collected = apply each payment's group share%
    const netCollectedRev = monthPayments.reduce((s: number, p: any) => {
      const gid   = accGroupMapAcademy[p.account_id as string] ?? null
      const share = gid ? (shareByGroupAcademy[gid] ?? 100) : 100
      return s + Number(p.amount) * share / 100
    }, 0)

    const grossExpectedRev = totalGrossExpected / 6
    const netExpectedRev   = totalNetExpected   / 6

    const monthInstrEarned = monthlySessions
      .filter((s: any) => (s.scheduled_at as string).startsWith(m))
      .reduce((s: number, sess: any) => s + acRate(sess), 0)

    const monthOtherExp = monthlyExpenses
      .filter((e: any) => (e.expense_date as string).startsWith(m) && e.expense_type !== 'INSTRUCTOR')
      .reduce((s: number, e: any) => s + Number(e.amount), 0)

    const monthTotalExp = monthInstrEarned + monthOtherExp

    return {
      month:                   m,
      label,
      gross_expected_revenue:  Math.round(grossExpectedRev),
      gross_collected_revenue: grossCollectedRev,
      net_collected_revenue:   netCollectedRev,
      instructor_earned:       monthInstrEarned,
      other_expenses:          monthOtherExp,
      total_expenses:          monthTotalExp,
      expected_profit:         Math.round(netExpectedRev) - monthTotalExp,
      actual_profit:           netCollectedRev - monthTotalExp,
    }
  })

  return {
    gross_expected_revenue:      totalGrossExpected,
    gross_collected_revenue:     totalGrossCollected,
    outstanding:                 totalOutstanding,
    collection_rate:             collectionRate,
    net_expected_revenue:        totalNetExpected,
    net_collected_revenue:       totalNetCollected,
    instructor_earned:           totalInstrEarned,
    instructor_paid:             totalInstrPaid,
    instructor_remaining:        totalInstrEarned - totalInstrPaid,
    future_liability:            totalFutureLiab,
    final_instructor_cost:       totalFinalInstrCost,
    branch_expenses:             totalBranchExp,
    branch_recurring_expenses:   totalBranchRecur,
    group_expenses:              totalGroupExp,
    group_recurring_expenses:    totalGroupRecur,
    academy_expenses:            totalAcademyExp,
    academy_recurring_expenses:  totalAcademyRecur,
    total_expenses:              totalExpenses,
    expected_profit:             totalNetExpected  - (totalFinalInstrCost + totalManualExp),
    actual_profit:               totalNetCollected - (totalInstrEarned  + totalManualExp),
    monthly_trend,
  }
}

// ── Phase XXVIII: Recurring expenses listing ───────────────────────────────────

export async function listRecurringExpenses(
  filters: { scope?: import('./types').ExpenseScope; branch_id?: string; group_id?: string; active_only?: boolean } = {}
): Promise<RecurringExpense[]> {
  const db = createServiceClient()

  let q = db
    .from('recurring_expenses')
    .select(`
      id, expense_scope, expense_type, group_id, branch_id,
      amount, start_date, end_date, is_active, notes, created_by, created_at, updated_at,
      groups!recurring_expenses_group_id_fkey(name),
      branches!recurring_expenses_branch_id_fkey(name)
    `)
    .order('created_at', { ascending: false })

  if (filters.scope)      q = (q as any).eq('expense_scope', filters.scope)
  if (filters.branch_id)  q = (q as any).eq('branch_id', filters.branch_id)
  if (filters.group_id)   q = (q as any).eq('group_id', filters.group_id)
  if (filters.active_only) q = (q as any).eq('is_active', true)

  const { data, error } = await q
  if (error) {
    console.error('[listRecurringExpenses] error:', error.message)
    return []
  }

  return ((data ?? []) as any[]).map(r => ({
    id:            r.id,
    expense_scope: r.expense_scope,
    expense_type:  r.expense_type,
    group_id:      r.group_id,
    branch_id:     r.branch_id,
    amount:        Number(r.amount),
    start_date:    r.start_date,
    end_date:      r.end_date,
    is_active:     r.is_active,
    notes:         r.notes,
    created_by:    r.created_by,
    created_at:    r.created_at,
    updated_at:    r.updated_at,
    group_name:    r.groups?.name  ?? null,
    branch_name:   r.branches?.name ?? null,
  })) as RecurringExpense[]
}

// ── Phase XXVIII: Group expense detail (for modal) ─────────────────────────────

export async function getGroupExpenseDetail(
  groupId: string,
  opts?: { dateFrom?: string; dateTo?: string }
): Promise<GroupExpenseDetail | null> {
  const db = createServiceClient()
  const dateFrom = opts?.dateFrom
  const dateTo   = opts?.dateTo
  const today    = new Date().toISOString().slice(0, 10)
  const from     = new Date(dateFrom ?? '2020-01-01')
  const to       = new Date(dateTo   ?? today)

  // Load group info
  const { data: groupData } = await db
    .from('groups')
    .select(`
      id, name, branch_id,
      branches!groups_branch_id_fkey(name),
      group_courses!group_courses_group_id_fkey(
        id, session_rate,
        courses!group_courses_course_id_fkey(title),
        instructors!group_courses_instructor_id_fkey(
          users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
        )
      )
    `)
    .eq('id', groupId)
    .single()

  if (!groupData) return null
  const g = groupData as any
  const gc = ((g.group_courses as any[]) ?? [])[0]
  const instrProfile = gc?.instructors?.users?.profiles
  const instrName = instrProfile
    ? [instrProfile.first_name, instrProfile.last_name].filter(Boolean).join(' ') || null
    : null

  // Revenue
  const { data: accData } = await db
    .from('student_financial_accounts')
    .select('net_amount, paid_amount, remaining_amount, status')
    .eq('group_id', groupId)
  const rev = ((accData ?? []) as any[]).reduce(
    (acc, a) => ({
      expected:    acc.expected   + Number(a.net_amount),
      collected:   acc.collected  + Number(a.paid_amount),
      outstanding: acc.outstanding + (a.status !== 'PAID' ? Number(a.remaining_amount) : 0),
    }),
    { expected: 0, collected: 0, outstanding: 0 }
  )

  // Student count
  const { count: studentCount } = await db
    .from('group_students')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('status', 'active')

  // Instructor cost (completed sessions)
  const schedQ = db
    .from('schedules')
    .select(`group_courses!schedules_group_course_id_fkey(group_id, session_rate, instructors!group_courses_instructor_id_fkey(default_session_rate))`)
    .eq('status', 'completed')
  const { data: schedData } = await schedQ
  const instrCost = ((schedData ?? []) as any[])
    .filter(s => s.group_courses?.group_id === groupId)
    .reduce((sum, s) => {
      const gc2 = s.group_courses
      return sum + Number(gc2?.session_rate ?? gc2?.instructors?.default_session_rate ?? 0)
    }, 0)

  // Manual expenses
  let expQ = db
    .from('financial_expenses')
    .select('id, expense_scope, expense_type, group_id, branch_id, amount, expense_date, notes, created_by, created_at, updated_at')
    .eq('expense_scope', 'GROUP')
    .eq('group_id', groupId)
    .order('expense_date', { ascending: false })
  if (dateFrom) expQ = (expQ as any).gte('expense_date', dateFrom)
  if (dateTo)   expQ = (expQ as any).lte('expense_date', dateTo)
  const { data: expData } = await expQ
  const expenses = ((expData ?? []) as any[]).map(e => ({
    id: e.id, expense_scope: e.expense_scope, expense_type: e.expense_type,
    group_id: e.group_id, branch_id: e.branch_id,
    amount: Number(e.amount), expense_date: e.expense_date,
    notes: e.notes, created_by: e.created_by,
    created_at: e.created_at, updated_at: e.updated_at,
    group_name: g.name, branch_name: g.branches?.name ?? null,
    created_by_name: null,
  })) as import('./types').FinancialExpense[]
  const manualExpTotal = expenses.reduce((s, e) => s + e.amount, 0)

  // Recurring expenses for this group
  const { data: recurData } = await db
    .from('recurring_expenses')
    .select('id, expense_scope, expense_type, group_id, branch_id, amount, start_date, end_date, is_active, notes, created_by, created_at, updated_at')
    .eq('expense_scope', 'GROUP')
    .eq('group_id', groupId)
  const recurring = ((recurData ?? []) as any[]).map(r => ({
    id: r.id, expense_scope: r.expense_scope, expense_type: r.expense_type,
    group_id: r.group_id, branch_id: r.branch_id,
    amount: Number(r.amount), start_date: r.start_date, end_date: r.end_date,
    is_active: r.is_active, notes: r.notes, created_by: r.created_by,
    created_at: r.created_at, updated_at: r.updated_at,
    group_name: g.name, branch_name: null,
  })) as RecurringExpense[]
  const recurTotal = sumRecurring(recurring, from, to, groupId, undefined, 'GROUP')

  const totalExpenses = instrCost + manualExpTotal + recurTotal
  const rate = rev.expected > 0 ? Math.round((rev.collected / rev.expected) * 100) : 0

  // By category
  const categoryMap: Record<string, number> = {}
  for (const e of expenses) {
    categoryMap[e.expense_type] = (categoryMap[e.expense_type] ?? 0) + e.amount
  }
  const by_category = Object.entries(categoryMap)
    .map(([type, amount]) => ({ type: type as ExpenseType, label: type, amount }))
    .sort((a, b) => b.amount - a.amount)

  return {
    group_id:           groupId,
    group_name:         g.name,
    branch_id:          g.branch_id,
    branch_name:        g.branches?.name ?? '',
    course_name:        gc?.courses?.title ?? null,
    instructor_name:    instrName,
    student_count:      studentCount ?? 0,
    expected_revenue:   rev.expected,
    collected_revenue:  rev.collected,
    outstanding:        rev.outstanding,
    collection_rate:    rate,
    instructor_cost:    instrCost,
    manual_expenses:    manualExpTotal,
    recurring_expenses: recurTotal,
    total_expenses:     totalExpenses,
    expected_profit:    rev.expected  - totalExpenses,
    actual_profit:      rev.collected - totalExpenses,
    expenses,
    recurring,
    by_category,
  }
}
