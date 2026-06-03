import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import {
  computePriority, computeDaysOverdue,
  type FinanceListItem, type FinanceKPIs, type StudentFinanceDetail,
  type FinanceFilters, type GroupFinanceSummary, type DashboardFinanceSummary,
  type AccountStatus, type ActivityType,
} from './types'

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
         ),
         emergency_contact
       ),
       branches!student_financial_accounts_branch_id_fkey(name),
       groups!student_financial_accounts_group_id_fkey(
         name,
         group_courses(
           status,
           courses!group_courses_course_id_fkey(title)
         )
       )`,
      { count: 'exact' }
    )
    .order('updated_at', { ascending: false })

  if (filters.branch_id) q = q.eq('branch_id', filters.branch_id)
  if (filters.group_id)  q = q.eq('group_id', filters.group_id)
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

  const items: FinanceListItem[] = ((data ?? []) as any[]).map(row => {
    const student  = row.students   ?? {}
    const branch   = row.branches   ?? {}
    const group    = row.groups     ?? null
    const user     = student.users  ?? {}
    const profile  = user.profiles  ?? {}
    const ec       = (student.emergency_contact ?? {}) as Record<string, string>

    const gc = Array.isArray(group?.group_courses)
      ? (group.group_courses as any[]).find((c: any) => c.status === 'active')
      : null
    const courseTitle = gc?.courses?.title ?? null

    const account = {
      status:       row.status    as any,
      remaining_amount: Number(row.remaining_amount),
      next_due_date: row.next_due_date,
    }

    return {
      account_id:      row.id,
      status:          row.status,
      total_amount:    Number(row.total_amount),
      discount_amount: Number(row.discount_amount),
      net_amount:      Number(row.net_amount),
      paid_amount:     Number(row.paid_amount),
      remaining_amount:Number(row.remaining_amount),
      next_due_date:   row.next_due_date,
      student_id:      row.student_id,
      student_name:    [profile.first_name, profile.last_name].filter(Boolean).join(' ') || user.email || 'Unknown',
      student_email:   user.email ?? '',
      student_phone:   user.phone ?? null,
      student_code:    student.student_code ?? null,
      parent_name:     ec.name  ?? null,
      parent_phone_1:  ec.phone1 ?? null,
      parent_phone_2:  ec.phone2 ?? null,
      branch_id:       row.branch_id,
      branch_name:     branch.name ?? '',
      group_id:        row.group_id,
      group_name:      group?.name ?? null,
      course_title:    courseTitle,
      priority:        computePriority(account),
      days_overdue:    computeDaysOverdue(row.next_due_date),
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
           ),
           emergency_contact
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
  const ec       = (student.emergency_contact ?? {}) as Record<string, string>

  const gc = Array.isArray(group?.group_courses)
    ? (group.group_courses as any[]).find((c: any) => c.status === 'active')
    : null

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
      installment_id: r.installment_id,
      amount: Number(r.amount), payment_date: r.payment_date,
      payment_method: r.payment_method, reference_number: r.reference_number,
      notes: r.notes, created_by: r.created_by, created_at: r.created_at,
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
      id:            student.id ?? row.student_id,
      name:          [profile.first_name, profile.last_name].filter(Boolean).join(' ') || user.email || 'Unknown',
      email:         user.email  ?? '',
      phone:         user.phone  ?? null,
      student_code:  student.student_code ?? null,
      branch_name:   branch.name ?? '',
      group_name:    group?.name  ?? null,
      course_title:  gc?.courses?.title ?? null,
      parent_name:   ec.name   ?? null,
      parent_phone_1: ec.phone1 ?? null,
      parent_phone_2: ec.phone2 ?? null,
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
         id, student_code, emergency_contact,
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
    const ec      = (student.emergency_contact ?? {}) as Record<string, string>
    const last    = lastActivityMap[row.id]
    const days    = computeDaysOverdue(row.next_due_date)

    return {
      account_id:         row.id as string,
      student_id:         row.student_id as string,
      student_name:       [profile.first_name, profile.last_name].filter(Boolean).join(' ') || user.email || 'Unknown',
      student_code:       student.student_code as string | null,
      parent_name:        ec.name   ?? null,
      parent_phone_1:     ec.phone1 ?? null,
      parent_phone_2:     ec.phone2 ?? null,
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
         student_code, emergency_contact,
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
      const ec = (r.students?.emergency_contact ?? {}) as Record<string, string>
      return {
        student_id:      r.student_id as string,
        student_name:    p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || r.students?.users?.email : r.students?.users?.email,
        account_id:      r.id as string,
        remaining_amount: Number(r.remaining_amount),
        days_overdue:    computeDaysOverdue(r.next_due_date),
        parent_phone_1:  ec.phone1 ?? null,
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
