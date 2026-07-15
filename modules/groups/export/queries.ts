'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { getGroupPnLRows }      from '@/modules/finance/queries'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import type { BatchStudentRow, ExportServerResult } from './types'

export async function fetchGroupsExportData(
  groupIds:  string[],
  branchIds: string[],
): Promise<ExportServerResult> {
  if (!groupIds.length || !branchIds.length) {
    return { pnlRows: [], students: [] }
  }

  const user = await requirePermission('manage_groups')
  // Caller-supplied branchIds are untrusted — only branches the user can actually access are honored.
  const authorizedBranchIds = branchIds.filter(id => isBranchAccessible(user, id))
  if (!authorizedBranchIds.length) {
    return { pnlRows: [], students: [] }
  }

  const db = createServiceClient()

  // Caller-supplied groupIds are also untrusted — only honor the ones that
  // actually belong to an authorized branch.
  const { data: groupBranchRows } = await db
    .from('groups')
    .select('id, branch_id')
    .in('id', groupIds)
  const authorizedGroupIds = ((groupBranchRows ?? []) as { id: string; branch_id: string | null }[])
    .filter(g => isBranchAccessible(user, g.branch_id))
    .map(g => g.id)

  if (!authorizedGroupIds.length) {
    return { pnlRows: [], students: [] }
  }

  // 1. Financial data — reuse canonical PnL query, then filter to visible groups
  const allPnl     = await getGroupPnLRows(authorizedBranchIds)
  const visibleSet = new Set(authorizedGroupIds)
  const pnlRows    = allPnl.filter(r => visibleSet.has(r.group_id))

  // 2. All active students across the visible groups
  const { data: gsData } = await db
    .from('group_students')
    .select(`
      group_id, student_id, joined_at,
      students!group_students_student_id_fkey(
        student_code, age, date_of_birth,
        users!students_user_id_fkey(
          phone,
          profiles!profiles_user_id_fkey(first_name, last_name)
        )
      )
    `)
    .in('group_id', authorizedGroupIds)
    .eq('status', 'active')
    .order('joined_at')

  const gsRows     = (gsData ?? []) as any[]
  const studentIds = [...new Set(gsRows.map((r: any) => r.student_id as string))]

  if (!studentIds.length) return { pnlRows, students: [] }

  const none = Promise.resolve({ data: [] as any[] })

  // 3. Batch-fetch all supplemental data in parallel — no N+1
  const [progressRes, enrollRes, guardianRes, financeRes] = await Promise.all([
    // Per-group attendance score (same source as single-group detail view)
    db.from('student_course_progress')
      .select('student_id, group_id, attendance_score')
      .in('group_id', authorizedGroupIds)
      .in('student_id', studentIds)
      .eq('status', 'active'),

    // Active enrollment — oldest first (FIFO, consistent with detail view)
    db.from('student_enrollments')
      .select('student_id, remaining_sessions, consumed_sessions, enrolled_sessions')
      .in('student_id', studentIds)
      .eq('status', 'ACTIVE')
      .order('start_date',  { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),

    // Guardian contacts (name + phone)
    studentIds.length
      ? db.from('student_parent_contacts')
          .select('student_id, name, phone1')
          .in('student_id', studentIds)
          .not('phone1', 'is', null)
      : none,

    // Financial accounts
    db.from('student_financial_accounts')
      .select('student_id, paid_amount, remaining_amount, status')
      .in('student_id', studentIds),
  ])

  // Build lookup maps — one O(n) pass each

  // progress key: `${student_id}:${group_id}`
  const progressMap = new Map<string, number>()
  for (const p of (progressRes.data ?? []) as any[]) {
    progressMap.set(`${p.student_id}:${p.group_id}`, Number(p.attendance_score ?? 0))
  }

  // first ACTIVE enrollment per student
  const enrollMap = new Map<string, { remaining: number | null; total: number | null }>()
  for (const e of (enrollRes.data ?? []) as any[]) {
    if (!enrollMap.has(e.student_id)) {
      enrollMap.set(e.student_id, {
        remaining: e.remaining_sessions != null ? Number(e.remaining_sessions) : null,
        total:     e.enrolled_sessions  != null ? Number(e.enrolled_sessions)  : null,
      })
    }
  }

  // first guardian contact per student
  const guardianMap = new Map<string, { name: string | null; phone: string | null }>()
  for (const g of (guardianRes.data ?? []) as any[]) {
    if (!guardianMap.has(g.student_id)) {
      guardianMap.set(g.student_id, { name: g.name ?? null, phone: g.phone1 ?? null })
    }
  }

  // first financial account per student
  const finMap = new Map<string, { paid: number; balance: number; status: string | null }>()
  for (const f of (financeRes.data ?? []) as any[]) {
    if (!finMap.has(f.student_id)) {
      finMap.set(f.student_id, {
        paid:    Number(f.paid_amount      ?? 0),
        balance: Number(f.remaining_amount ?? 0),
        status:  f.status ?? null,
      })
    }
  }

  const students: BatchStudentRow[] = gsRows.map((r: any): BatchStudentRow => {
    const s    = r.students ?? {}
    const prof = s.users?.profiles ?? {}
    const name = [prof.first_name, prof.last_name].filter(Boolean).join(' ') || '—'
    const age  = s.age != null
      ? Number(s.age)
      : s.date_of_birth
        ? Math.floor((Date.now() - new Date(s.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : null

    const att      = progressMap.get(`${r.student_id}:${r.group_id}`) ?? 0
    const enroll   = enrollMap.get(r.student_id)
    const guardian = guardianMap.get(r.student_id)
    const fin      = finMap.get(r.student_id)

    const sessLeft    = enroll?.remaining ?? null
    const isExhausted = sessLeft != null && sessLeft <= 0
    const isOverdue   = fin?.status === 'OVERDUE'
    const isBlocked   = fin?.status === 'BLOCKED'

    // Canonical risk thresholds — aligned with operational-engine and detail.ts
    const risk_level: 'HIGH' | 'MEDIUM' | 'LOW' =
      (att < 60 || isExhausted || isOverdue || isBlocked) ? 'HIGH' :
      (att < 80 || (sessLeft != null && sessLeft <= 2))   ? 'MEDIUM' : 'LOW'

    return {
      group_id:           r.group_id,
      student_id:         r.student_id,
      student_name:       name,
      student_code:       s.student_code  ?? null,
      age,
      phone:              s.users?.phone  ?? null,
      parent_name:        guardian?.name  ?? null,
      parent_phone:       guardian?.phone ?? null,
      joined_at:          r.joined_at,
      attendance_pct:     att,
      sessions_remaining: sessLeft,
      sessions_total:     enroll?.total   ?? null,
      paid_amount:        fin?.paid        ?? 0,
      remaining_balance:  fin?.balance     ?? 0,
      payment_status:     fin?.status      ?? null,
      risk_level,
    }
  })

  return { pnlRows, students }
}
