import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import {
  computeAdjTotals,
  computeStaffNetAmount,
  derivePaymentStatus,
  type InstructorFinanceRow, type StaffFinanceRow,
  type FinanceAdjustment, type StaffFinanceSummary,
  type UserPickerOption, type InstructorSessionDetail,
  type StaffSession, type StaffPaymentRecord,
} from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fullName(profiles: any): string {
  if (!profiles) return '—'
  return [profiles.first_name, profiles.last_name].filter(Boolean).join(' ') || '—'
}

// ── Live instructor finance ────────────────────────────────────────────────────
// Starts from completed schedules (source of truth), then resolves instructor profiles.
// Applies 3-level rate hierarchy: session override > group rate > instructor default.

export async function getLiveInstructorFinance(
  branchIds: string[],
  dateFrom:  string,
  dateTo:    string,
): Promise<InstructorFinanceRow[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  // 1. Completed schedules in date range
  const { data: schedData } = await db
    .from('schedules')
    .select('id, branch_id, group_course_id')
    .in('branch_id', branchIds)
    .eq('status', 'completed')
    .gte('scheduled_at', `${dateFrom}T00:00:00`)
    .lte('scheduled_at', `${dateTo}T23:59:59`)

  const schedules = (schedData ?? []) as any[]
  if (!schedules.length) return []

  const allScheduleIds = schedules.map((s: any) => s.id as string)

  // 2. Resolve group_course_id → group_id + instructor_id
  const groupCourseIds = [...new Set(schedules.map((s: any) => s.group_course_id as string))]
  const { data: gcData } = await db
    .from('group_courses')
    .select('id, group_id, instructor_id')
    .in('id', groupCourseIds)

  const gcMap = new Map<string, { group_id: string; instructor_id: string | null }>()
  for (const gc of (gcData ?? []) as any[]) {
    gcMap.set(gc.id, { group_id: gc.group_id, instructor_id: gc.instructor_id ?? null })
  }

  // 3. Find lead instructor for groups without direct instructor_id
  //    Also fetch group-specific session rates
  const allGroupIds = [...new Set([...gcMap.values()].map(v => v.group_id))]
  const { data: giAllData } = await db
    .from('group_instructors')
    .select('group_id, instructor_id, role, session_rate')
    .in('group_id', allGroupIds)

  const groupLeadMap   = new Map<string, string>()
  const groupRateByKey = new Map<string, number | null>()

  for (const gi of (giAllData ?? []) as any[]) {
    if (!groupLeadMap.has(gi.group_id) || gi.role === 'lead') {
      groupLeadMap.set(gi.group_id, gi.instructor_id)
    }
    const key = `${gi.instructor_id}:${gi.group_id}`
    groupRateByKey.set(key, gi.session_rate != null ? Number(gi.session_rate) : null)
  }

  // 4. Session overrides (one batch query for all schedules)
  const { data: overrideData } = await db
    .from('payroll_session_overrides')
    .select('schedule_id, instructor_id, override_rate')
    .in('schedule_id', allScheduleIds)

  const overrideByKey = new Map<string, number>()
  for (const ov of (overrideData ?? []) as any[]) {
    overrideByKey.set(`${ov.instructor_id}:${ov.schedule_id}`, Number(ov.override_rate))
  }

  // 5. Accumulate per-instructor: schedules + earnings (rate hierarchy applied per session)
  type SessionEntry = {
    schedule_ids: string[]
    group_ids:    Set<string>
    branch_id:    string
  }
  const sessionMap = new Map<string, SessionEntry>()

  for (const s of schedules) {
    const gc = gcMap.get(s.group_course_id)
    if (!gc) continue
    const instructorId: string | undefined = gc.instructor_id ?? groupLeadMap.get(gc.group_id)
    if (!instructorId) continue

    if (!sessionMap.has(instructorId)) {
      sessionMap.set(instructorId, { schedule_ids: [], group_ids: new Set(), branch_id: s.branch_id })
    }
    const entry = sessionMap.get(instructorId)!
    entry.schedule_ids.push(s.id)
    entry.group_ids.add(gc.group_id)
  }

  if (!sessionMap.size) return []

  const instructorIds = [...sessionMap.keys()]

  // 6. Instructor base info
  const { data: instrData } = await db
    .from('instructors')
    .select('id, user_id, salary_per_session, currency, instapay_number, payment_notes, payment_method')
    .in('id', instructorIds)

  // 7. Profiles
  const userIds = (instrData ?? []).map((i: any) => i.user_id).filter(Boolean)
  const { data: profileData } = userIds.length
    ? await db.from('profiles').select('user_id, first_name, last_name').in('user_id', userIds)
    : { data: [] }

  const profileByUserId = new Map<string, any>()
  for (const p of (profileData ?? []) as any[]) profileByUserId.set(p.user_id, p)

  const profileMap = new Map<string, any>()
  for (const inst of (instrData ?? []) as any[]) {
    profileMap.set(inst.id, { ...inst, _profile: profileByUserId.get(inst.user_id) })
  }

  // 8. Branch names
  const uniqueBranchIds = [...new Set([...sessionMap.values()].map(e => e.branch_id).filter(Boolean))]
  const { data: branchData } = await db.from('branches').select('id, name').in('id', uniqueBranchIds)
  const branchNameMap = new Map<string, string>()
  for (const b of (branchData ?? []) as any[]) branchNameMap.set(b.id, b.name)

  // 9. Adjustments
  const { data: adjData } = await db
    .from('finance_adjustments')
    .select('*')
    .in('instructor_id', instructorIds)
    .in('branch_id', branchIds)
    .gte('adjustment_date', dateFrom)
    .lte('adjustment_date', dateTo)
    .order('adjustment_date', { ascending: false })

  const adjByInstructor = new Map<string, FinanceAdjustment[]>()
  for (const adj of (adjData ?? []) as any[]) {
    const id = adj.instructor_id as string
    if (!adjByInstructor.has(id)) adjByInstructor.set(id, [])
    adjByInstructor.get(id)!.push(adj as FinanceAdjustment)
  }

  const schedGroupMap = new Map<string, string>()
  for (const s of schedules) {
    const gc = gcMap.get(s.group_course_id)
    if (gc) schedGroupMap.set(s.id, gc.group_id)
  }

  // 10. Build result rows — compute earnings using rate hierarchy
  return instructorIds.map(instructorId => {
    const entry    = sessionMap.get(instructorId)!
    const inst     = profileMap.get(instructorId)
    const baseRate = Number(inst?.salary_per_session ?? 0)

    let session_earnings = 0
    for (const schedId of entry.schedule_ids) {
      const groupId   = schedGroupMap.get(schedId) ?? ''
      const overrideR = overrideByKey.get(`${instructorId}:${schedId}`) ?? null
      const groupR    = groupRateByKey.get(`${instructorId}:${groupId}`) ?? null
      session_earnings += overrideR ?? groupR ?? baseRate
    }

    const sessions_count = entry.schedule_ids.length
    const group_count    = entry.group_ids.size
    const adjustments    = adjByInstructor.get(instructorId) ?? []
    const totals         = computeAdjTotals(adjustments)

    return {
      instructor_id:      instructorId,
      user_id:            inst?.user_id ?? '',
      display_name:       fullName(inst?._profile),
      branch_id:          entry.branch_id,
      branch_name:        branchNameMap.get(entry.branch_id) ?? '',
      salary_per_session: baseRate,
      payment_method:     (inst?.payment_method ?? null) as any,
      instapay_number:    inst?.instapay_number ?? null,
      payment_notes:      inst?.payment_notes ?? null,
      currency:           inst?.currency ?? 'EGP',
      sessions_count,
      group_count,
      session_earnings,
      adjustments,
      ...totals,
      net_amount: session_earnings + totals.adj_net,
    } satisfies InstructorFinanceRow
  }).sort((a, b) => b.net_amount - a.net_amount)
}

// ── Live staff finance ────────────────────────────────────────────────────────
// Returns active + on_leave staff with their sessions, adjustments, and
// payment records for the selected month.
// Includes works_all_branches=true staff regardless of branch filter.

export async function getLiveStaffFinance(
  branchIds: string[],
  dateFrom:  string,
  dateTo:    string,
): Promise<StaffFinanceRow[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  // Derive month/year from dateFrom for payment records
  const d     = new Date(dateFrom)
  const month = d.getMonth() + 1
  const year  = d.getFullYear()

  // 1. Load staff profiles — branch-matched OR works_all_branches.
  //    Join to branches for name. Deliberately avoid nested auth.users join
  //    (unreliable across PostgREST schema boundaries); resolve display names
  //    via a separate profiles query below (same pattern as getLiveInstructorFinance).
  const { data: profileData, error: profileErr } = await db
    .from('staff_payroll_profiles')
    .select(`
      id, user_id, branch_id, role, department, employment_status, works_all_branches,
      payroll_type, basic_salary, session_rate,
      payment_method, payment_reference, notes,
      branches!staff_payroll_profiles_branch_id_fkey(name)
    `)
    .or(`branch_id.in.(${branchIds.map(id => id).join(',')}),works_all_branches.eq.true`)
    .order('employment_status', { ascending: true })
    .order('role',              { ascending: true })

  if (profileErr) {
    console.error('[getLiveStaffFinance] profile query error:', profileErr.message)
    return []
  }

  const profiles = (profileData ?? []) as any[]
  if (!profiles.length) return []

  const profileIds = profiles.map(p => p.id as string)

  // 1b. Resolve display names via profiles table (user_id → first_name + last_name)
  const userIds = [...new Set(profiles.map(p => p.user_id as string).filter(Boolean))]
  const { data: nameData } = userIds.length
    ? await db.from('profiles').select('user_id, first_name, last_name').in('user_id', userIds)
    : { data: [] }
  const nameByUserId = new Map<string, any>()
  for (const n of (nameData ?? []) as any[]) nameByUserId.set(n.user_id, n)

  // 2. Load adjustments for these staff profiles in date range
  const { data: adjData } = await db
    .from('finance_adjustments')
    .select('*')
    .in('staff_profile_id', profileIds)
    .gte('adjustment_date', dateFrom)
    .lte('adjustment_date', dateTo)
    .order('adjustment_date', { ascending: false })

  const adjByProfile = new Map<string, FinanceAdjustment[]>()
  for (const adj of (adjData ?? []) as any[]) {
    const id = adj.staff_profile_id as string
    if (!adjByProfile.has(id)) adjByProfile.set(id, [])
    adjByProfile.get(id)!.push(adj as FinanceAdjustment)
  }

  // 3. Load staff sessions for date range (no branch filter — works_all_branches staff
  //    may have sessions in any branch)
  const sessionsByProfile = new Map<string, StaffSession[]>()
  const { data: sessionsData } = await db
    .from('staff_sessions')
    .select('id, staff_profile_id, branch_id, session_date, activity_type, description, rate, quantity, notes, created_by, created_at, updated_at')
    .in('staff_profile_id', profileIds)
    .gte('session_date', dateFrom)
    .lte('session_date', dateTo)
    .order('session_date', { ascending: false })

  for (const s of (sessionsData ?? []) as any[]) {
    const id = s.staff_profile_id as string
    if (!sessionsByProfile.has(id)) sessionsByProfile.set(id, [])
    sessionsByProfile.get(id)!.push({
      ...s,
      rate:     Number(s.rate),
      quantity: Number(s.quantity),
      amount:   Number(s.rate) * Number(s.quantity),
    } as StaffSession)
  }

  // 4. Load payment records for the selected month
  const { data: paymentsData } = await db
    .from('staff_payment_records')
    .select('*')
    .in('staff_profile_id', profileIds)
    .eq('month', month)
    .eq('year', year)
    .order('payment_date', { ascending: false })

  const paymentsByProfile = new Map<string, StaffPaymentRecord[]>()
  for (const pr of (paymentsData ?? []) as any[]) {
    const id = pr.staff_profile_id as string
    if (!paymentsByProfile.has(id)) paymentsByProfile.set(id, [])
    paymentsByProfile.get(id)!.push({
      ...pr,
      amount: Number(pr.amount),
    } as StaffPaymentRecord)
  }

  // 5. Build result rows
  return profiles.map(p => {
    const profile      = nameByUserId.get(p.user_id)
    const basic_salary = Number(p.basic_salary ?? 0)
    const adjustments  = adjByProfile.get(p.id) ?? []
    const totals       = computeAdjTotals(adjustments)

    const sessions         = sessionsByProfile.get(p.id) ?? []
    const sessions_count   = sessions.length
    const session_earnings = sessions.reduce((sum, s) => sum + s.amount, 0)
    const net_amount       = computeStaffNetAmount(p.payroll_type, basic_salary, session_earnings, totals.adj_net)

    const payment_records = paymentsByProfile.get(p.id) ?? []
    const total_paid      = payment_records.reduce((sum, pr) => sum + pr.amount, 0)
    const remaining       = Math.max(0, net_amount - total_paid)
    const payment_status  = derivePaymentStatus(total_paid, net_amount)

    return {
      profile_id:          p.id,
      user_id:             p.user_id,
      display_name:        fullName(profile),
      branch_id:           p.branch_id,
      branch_name:         (p.branches as any)?.name ?? '',
      role:                p.role,
      department:          p.department ?? null,
      employment_status:   (p.employment_status ?? 'active') as any,
      works_all_branches:  p.works_all_branches ?? false,
      payroll_type:        p.payroll_type,
      basic_salary,
      session_rate:        Number(p.session_rate ?? 0),
      sessions_count,
      session_earnings,
      payment_method:      p.payment_method ?? 'cash',
      payment_reference:   p.payment_reference ?? null,
      notes:               p.notes ?? null,
      adjustments,
      ...totals,
      net_amount,
      payment_records,
      total_paid,
      remaining,
      payment_status,
    } satisfies StaffFinanceRow
  })
}

// ── Finance summary (aggregate) ───────────────────────────────────────────────

export async function getStaffFinanceSummary(
  branchIds: string[],
  dateFrom:  string,
  dateTo:    string,
): Promise<StaffFinanceSummary> {
  const [instructors, staff] = await Promise.all([
    getLiveInstructorFinance(branchIds, dateFrom, dateTo),
    getLiveStaffFinance(branchIds, dateFrom, dateTo),
  ])

  const total_session_earnings        = instructors.reduce((s, r) => s + r.session_earnings, 0)
  const total_staff_salaries          = staff.reduce((s, r) => s + r.basic_salary, 0)
  const total_staff_session_earnings  = staff.reduce((s, r) => s + r.session_earnings, 0)

  const allInstrAdj   = instructors.flatMap(r => r.adjustments)
  const allStaffAdj   = staff.flatMap(r => r.adjustments)
  const allAdj        = [...allInstrAdj, ...allStaffAdj]

  let total_bonus    = 0
  let total_penalty  = 0
  let total_advance  = 0
  let total_purchase = 0

  for (const a of allAdj) {
    if (a.type === 'bonus' || a.type === 'reimbursement') total_bonus    += a.amount
    if (a.type === 'penalty')                             total_penalty  += a.amount
    if (a.type === 'advance')                             total_advance  += a.amount
    if (a.type === 'purchase')                            total_purchase += a.amount
  }

  const instr_net = instructors.reduce((s, r) => s + r.net_amount, 0)
  const staff_net = staff.reduce((s, r) => s + r.net_amount, 0)

  return {
    date_from: dateFrom,
    date_to:   dateTo,
    instructor_count:            instructors.length,
    staff_count:                 staff.length,
    total_session_earnings,
    total_staff_salaries,
    total_staff_session_earnings,
    total_bonus,
    total_penalty,
    total_advance,
    total_purchase,
    total_net:  instr_net + staff_net,
    currency:   'EGP',
  }
}

// ── Get staff sessions (detail view) ─────────────────────────────────────────

export async function getStaffSessions(
  profileId: string,
  dateFrom?: string,
  dateTo?:   string,
): Promise<StaffSession[]> {
  const db = createServiceClient()
  let q = db
    .from('staff_sessions')
    .select('id, staff_profile_id, branch_id, session_date, activity_type, description, rate, quantity, notes, created_by, created_at, updated_at')
    .eq('staff_profile_id', profileId)
    .order('session_date', { ascending: false })

  if (dateFrom) q = q.gte('session_date', dateFrom)
  if (dateTo)   q = q.lte('session_date', dateTo)

  const { data, error } = await q
  if (error) return []

  return ((data ?? []) as any[]).map(s => ({
    ...s,
    rate:     Number(s.rate),
    quantity: Number(s.quantity),
    amount:   Number(s.rate) * Number(s.quantity),
  })) as StaffSession[]
}

// ── Get staff payment records (detail view) ───────────────────────────────────

export async function getStaffPaymentRecords(
  profileId: string,
  month:     number,
  year:      number,
): Promise<StaffPaymentRecord[]> {
  const db = createServiceClient()

  const { data, error } = await db
    .from('staff_payment_records')
    .select('*')
    .eq('staff_profile_id', profileId)
    .eq('month', month)
    .eq('year', year)
    .order('payment_date', { ascending: false })

  if (error) return []

  return ((data ?? []) as any[]).map(pr => ({
    ...pr,
    amount: Number(pr.amount),
  })) as StaffPaymentRecord[]
}

// ── User picker: search users not yet in a staff profile for a branch ─────────

export async function searchUsersForStaff(
  branchId: string,
  query:    string,
): Promise<UserPickerOption[]> {
  const db = createServiceClient()

  const sq = `%${query}%`

  const { data: profileHits } = await db
    .from('profiles')
    .select('user_id, first_name, last_name')
    .or(`first_name.ilike.${sq},last_name.ilike.${sq}`)
    .limit(20)

  const matchUserIds = (profileHits ?? []).map((p: any) => p.user_id as string)

  if (!matchUserIds.length) {
    const { data: emailHits } = await db
      .from('users')
      .select('id, email, profiles!profiles_user_id_fkey(first_name, last_name)')
      .ilike('email', sq)
      .limit(10)

    return ((emailHits ?? []) as any[]).map(u => ({
      user_id:      u.id,
      display_name: fullName(u.profiles) || u.email,
      email:        u.email ?? '',
    }))
  }

  const { data: userRows } = await db
    .from('users')
    .select('id, email, profiles!profiles_user_id_fkey(first_name, last_name)')
    .in('id', matchUserIds)
    .limit(20)

  return ((userRows ?? []) as any[]).map(u => ({
    user_id:      u.id,
    display_name: fullName(u.profiles) || u.email,
    email:        u.email ?? '',
  }))
}

// ── Get adjustments for a specific instructor or staff (detail view) ──────────

export async function getAdjustmentsForInstructor(
  instructorId: string,
  branchId:     string,
  dateFrom?:    string,
  dateTo?:      string,
): Promise<FinanceAdjustment[]> {
  const db = createServiceClient()
  let q = db
    .from('finance_adjustments')
    .select('*')
    .eq('instructor_id', instructorId)
    .eq('branch_id', branchId)
    .order('adjustment_date', { ascending: false })

  if (dateFrom) q = q.gte('adjustment_date', dateFrom)
  if (dateTo)   q = q.lte('adjustment_date', dateTo)

  const { data } = await q
  return (data ?? []) as FinanceAdjustment[]
}

export async function getAdjustmentsForStaff(
  profileId: string,
  branchId:  string,
  dateFrom?: string,
  dateTo?:   string,
): Promise<FinanceAdjustment[]> {
  const db = createServiceClient()
  let q = db
    .from('finance_adjustments')
    .select('*')
    .eq('staff_profile_id', profileId)
    .eq('branch_id', branchId)
    .order('adjustment_date', { ascending: false })

  if (dateFrom) q = q.gte('adjustment_date', dateFrom)
  if (dateTo)   q = q.lte('adjustment_date', dateTo)

  const { data } = await q
  return (data ?? []) as FinanceAdjustment[]
}

// ── Instructor sessions detail (drill-down popup) ─────────────────────────────
// Applies 3-level rate hierarchy: session override > group rate > instructor default.

export async function getInstructorSessionsDetail(
  instructorId: string,
  branchIds:    string[],
  dateFrom:     string,
  dateTo:       string,
): Promise<InstructorSessionDetail[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  const { data: gcDirect } = await db
    .from('group_courses')
    .select('id, group_id, course_id')
    .eq('instructor_id', instructorId)

  const { data: giData } = await db
    .from('group_instructors')
    .select('group_id, session_rate')
    .eq('instructor_id', instructorId)

  const giGroupIds = [...new Set((giData ?? []).map((g: any) => g.group_id as string))]

  const groupRateMap = new Map<string, number | null>()
  for (const gi of (giData ?? []) as any[]) {
    groupRateMap.set(gi.group_id, gi.session_rate != null ? Number(gi.session_rate) : null)
  }

  let gcFromGroups: any[] = []
  if (giGroupIds.length) {
    const { data } = await db
      .from('group_courses')
      .select('id, group_id, course_id')
      .in('group_id', giGroupIds)
    gcFromGroups = data ?? []
  }

  const gcMap = new Map<string, { group_id: string; course_id: string | null }>()
  for (const gc of [...(gcDirect ?? []), ...gcFromGroups] as any[]) {
    gcMap.set(gc.id, { group_id: gc.group_id ?? '', course_id: gc.course_id ?? null })
  }
  if (!gcMap.size) return []

  const { data: schedData } = await db
    .from('schedules')
    .select('id, group_course_id, scheduled_at, topic')
    .in('group_course_id', [...gcMap.keys()])
    .in('branch_id', branchIds)
    .eq('status', 'completed')
    .gte('scheduled_at', `${dateFrom}T00:00:00`)
    .lte('scheduled_at', `${dateTo}T23:59:59`)
    .order('scheduled_at', { ascending: false })

  const schedules = (schedData ?? []) as any[]
  if (!schedules.length) return []

  const schedIds = schedules.map((s: any) => s.id as string)

  const groupIds = [...new Set([...gcMap.values()].map(v => v.group_id).filter(Boolean))]
  const { data: groupData } = await db.from('groups').select('id, name').in('id', groupIds)
  const groupNames = new Map<string, string>()
  for (const g of (groupData ?? []) as any[]) groupNames.set(g.id, g.name)

  const courseIds = [...new Set([...gcMap.values()].map(v => v.course_id).filter(Boolean) as string[])]
  const courseNames = new Map<string, string>()
  if (courseIds.length) {
    const { data: courseData } = await db.from('courses').select('id, title').in('id', courseIds)
    for (const c of (courseData ?? []) as any[]) courseNames.set(c.id, c.title)
  }

  const { data: attData } = await db
    .from('attendance_records')
    .select('schedule_id, status')
    .in('schedule_id', schedIds)

  const PRESENT_STATUSES = new Set(['present', 'late', 'makeup'])
  const attMap = new Map<string, { total: number; present: number }>()
  for (const rec of (attData ?? []) as any[]) {
    const sid = rec.schedule_id as string
    if (!attMap.has(sid)) attMap.set(sid, { total: 0, present: 0 })
    const e = attMap.get(sid)!
    e.total++
    if (PRESENT_STATUSES.has(rec.status)) e.present++
  }

  const { data: iData } = await db
    .from('instructors')
    .select('salary_per_session')
    .eq('id', instructorId)
    .maybeSingle()
  const baseRate = Number((iData as any)?.salary_per_session ?? 0)

  const { data: overrideData } = await db
    .from('payroll_session_overrides')
    .select('id, schedule_id, override_rate, reason')
    .eq('instructor_id', instructorId)
    .in('schedule_id', schedIds)

  const overrideMap = new Map<string, { id: string; rate: number; reason: string | null }>()
  for (const ov of (overrideData ?? []) as any[]) {
    overrideMap.set(ov.schedule_id, { id: ov.id, rate: Number(ov.override_rate), reason: ov.reason ?? null })
  }

  return schedules.map((s: any) => {
    const gc        = gcMap.get(s.group_course_id) ?? { group_id: '', course_id: null }
    const att       = attMap.get(s.id) ?? { total: 0, present: 0 }
    const override  = overrideMap.get(s.id) ?? null
    const groupRate = groupRateMap.get(gc.group_id) ?? null
    const finalRate = override?.rate ?? groupRate ?? baseRate

    return {
      schedule_id:      s.id,
      scheduled_at:     s.scheduled_at,
      group_id:         gc.group_id,
      group_name:       groupNames.get(gc.group_id) ?? '—',
      course_name:      courseNames.get(gc.course_id ?? '') ?? '—',
      topic:            s.topic ?? null,
      students_total:   att.total,
      students_present: att.present,
      attendance_pct:   att.total > 0 ? Math.round((att.present / att.total) * 100) : 0,
      status:           'completed',
      base_rate:        baseRate,
      group_rate:       groupRate,
      override_rate:    override?.rate   ?? null,
      override_reason:  override?.reason ?? null,
      override_id:      override?.id     ?? null,
      final_rate:       finalRate,
      session_amount:   finalRate,
    } satisfies InstructorSessionDetail
  })
}

// ── Dashboard live payroll summary ────────────────────────────────────────────

export async function getLiveDashboardPayrollSummary(
  branchIds: string[],
): Promise<{ total_net: number; instructor_count: number; has_data: boolean; currency: string }> {
  if (!branchIds.length) return { total_net: 0, instructor_count: 0, has_data: false, currency: 'EGP' }

  const now      = new Date()
  const dateFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const dateTo   = now.toISOString().slice(0, 10)

  const instructors = await getLiveInstructorFinance(branchIds, dateFrom, dateTo)

  const total_net        = instructors.reduce((s, r) => s + r.net_amount, 0)
  const instructor_count = instructors.length
  const has_data         = instructor_count > 0

  return { total_net, instructor_count, has_data, currency: 'EGP' }
}
