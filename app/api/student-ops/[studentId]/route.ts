import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/service'
import { getCurrentUser }            from '@/modules/rbac/guards'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const user = await getCurrentUser()
  if (!user || !user.permissions.includes('manage_financials')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { studentId } = await params

  // Optional: enrollment_id from query param for enrollment-aware filtering
  const enrollmentId = req.nextUrl.searchParams.get('enrollmentId')

  const db = createServiceClient()

  // ── Branch access guard ───────────────────────────────────────────────────
  if (user.globalRole !== 'super_admin') {
    const { data: stu } = await db
      .from('students').select('branch_id').eq('id', studentId).maybeSingle()
    if (!stu || !user.branchIds.includes((stu as any).branch_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // ── Resolve enrollment context ────────────────────────────────────────────
  let enrollmentStartDate: string | null = null
  let resolvedGroupId: string | null = null
  let resolvedGcId: string | null    = null

  if (enrollmentId) {
    // Enrollment-centric: use the specific enrollment's start_date and group_course
    const { data: enRow } = await db
      .from('student_enrollments')
      .select('start_date, group_id, group_course_id')
      .eq('id', enrollmentId)
      .eq('student_id', studentId)
      .maybeSingle()
    if (enRow) {
      enrollmentStartDate = (enRow as any).start_date ?? null
      resolvedGroupId     = (enRow as any).group_id ?? null
      resolvedGcId        = (enRow as any).group_course_id ?? null
    }
  }

  // If no enrollment_id supplied, use the student's active primary enrollment
  if (!resolvedGcId) {
    const { data: primaryEnroll } = await db
      .from('group_students')
      .select('group_id')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .eq('enrollment_type', 'primary')
      .maybeSingle()
    resolvedGroupId = (primaryEnroll as any)?.group_id ?? null

    if (resolvedGroupId) {
      const { data: gcRow } = await db
        .from('group_courses')
        .select('id')
        .eq('group_id', resolvedGroupId)
        .eq('status', 'active')
        .maybeSingle()
      resolvedGcId = (gcRow as any)?.id ?? null
    }
  }

  // ── Resolve account_id ────────────────────────────────────────────────────
  let accountId: string | null = null

  if (enrollmentId) {
    const { data: accByEnroll } = await db
      .from('student_financial_accounts')
      .select('id')
      .eq('enrollment_id', enrollmentId)
      .maybeSingle()
    accountId = (accByEnroll as any)?.id ?? null
  }

  // Fallback: account linked to student
  if (!accountId) {
    const { data: accRow } = await db
      .from('student_financial_accounts')
      .select('id')
      .eq('student_id', studentId)
      .maybeSingle()
    accountId = (accRow as any)?.id ?? null
  }

  // ── Payments: fetch by enrollment_id OR account_id (Phase 5 fix) ──────────
  // Payments may be linked to enrollment only, account only, or both.
  // We union both queries and deduplicate by id so no payment is missed.
  let payData: any[] = []
  if (enrollmentId || accountId) {
    const [byEnroll, byAccount] = await Promise.all([
      enrollmentId
        ? db.from('finance_payments')
            .select(`*, users!finance_payments_created_by_fkey(profiles!profiles_user_id_fkey(first_name, last_name))`)
            .eq('enrollment_id', enrollmentId)
            .order('payment_date', { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      accountId
        ? db.from('finance_payments')
            .select(`*, users!finance_payments_created_by_fkey(profiles!profiles_user_id_fkey(first_name, last_name))`)
            .eq('account_id', accountId)
            .order('payment_date', { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
    ])
    const seen = new Set<string>()
    for (const p of [...(byEnroll.data ?? []), ...(byAccount.data ?? [])]) {
      if (!seen.has(p.id)) { seen.add(p.id); payData.push(p) }
    }
    payData.sort((a, b) => (b.payment_date as string).localeCompare(a.payment_date as string))
  }

  // ── Parallel fetches ──────────────────────────────────────────────────────
  const [instRes, actRes, noteRes, promRes, sessRes, revRes, sfaRes, allEnrollRes] = await Promise.all([
    // (payments already resolved above)

    // Installments
    accountId
      ? db.from('finance_installments')
          .select('*')
          .eq('account_id', accountId)
          .order('installment_number', { ascending: true })
      : Promise.resolve({ data: [] }),

    // Collection activities
    accountId
      ? db.from('collection_activities')
          .select(`*, users!collection_activities_created_by_fkey(profiles!profiles_user_id_fkey(first_name, last_name))`)
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),

    // Finance notes
    accountId
      ? db.from('finance_notes')
          .select(`*, users!finance_notes_created_by_fkey(profiles!profiles_user_id_fkey(first_name, last_name))`)
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),

    // Payment promises
    accountId
      ? db.from('payment_promises')
          .select(`*, users!payment_promises_created_by_fkey(profiles!profiles_user_id_fkey(first_name, last_name))`)
          .eq('account_id', accountId)
          .order('promised_date', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),

    // Attendance sessions — enrollment-aware: only sessions >= enrollment.start_date
    resolvedGcId
      ? (() => {
          let q = db.from('schedules')
            .select(`
              id, scheduled_at, topic, status,
              attendance_records!attendance_records_schedule_id_fkey(
                student_id, status, late_minutes, notes
              )
            `)
            .eq('group_course_id', resolvedGcId)
            .neq('status', 'cancelled')
            .order('scheduled_at', { ascending: false })
            .limit(60)

          if (enrollmentStartDate) {
            q = q.gte('scheduled_at', `${enrollmentStartDate}T00:00:00`)
          }
          return q
        })()
      : Promise.resolve({ data: [] }),

    // Payment reversals (Sprint 45)
    accountId
      ? db.from('finance_payment_reversals')
          .select('*')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),

    // SFA balance (authoritative running balance)
    accountId
      ? db.from('student_financial_accounts')
          .select('net_amount, paid_amount, remaining_amount')
          .eq('id', accountId)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    // All active enrollments for this student (packages overview)
    db.from('student_enrollments')
      .select('id, course_name_snapshot, group_name_snapshot, instructor_name_snapshot, enrolled_sessions, remaining_sessions, financial_status')
      .eq('student_id', studentId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: true })
      .limit(20),
  ])

  const mapCreatedBy = (r: any) => {
    const p = r.users?.profiles
    return p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || null : null
  }

  const payments = (payData as any[]).map(r => ({
    id: r.id, student_id: r.student_id, account_id: r.account_id,
    enrollment_id: r.enrollment_id ?? null,
    installment_id: r.installment_id,
    amount: Number(r.amount), payment_date: r.payment_date,
    payment_method: r.payment_method, reference_number: r.reference_number,
    notes: r.notes,
    allocation_strategy: r.allocation_strategy ?? null,
    receipt_url:   r.receipt_url   ?? null,
    receipt_image: r.receipt_image ?? null,
    receipt_notes: r.receipt_notes ?? null,
    created_by: r.created_by, created_at: r.created_at,
    created_by_name: mapCreatedBy(r),
  }))

  const reversals = ((revRes.data ?? []) as any[]).map(r => ({
    id: r.id,
    original_payment_id: r.original_payment_id,
    enrollment_id:  r.enrollment_id  ?? null,
    account_id:     r.account_id     ?? null,
    student_id:     r.student_id,
    amount:         Number(r.amount),
    reversal_type:  r.reversal_type,
    reason:         r.reason ?? null,
    created_by:     r.created_by ?? null,
    created_at:     r.created_at,
  }))

  const sfaBalance = sfaRes.data as any
  const balanceInfo = {
    net_amount:       Number(sfaBalance?.net_amount       ?? 0),
    paid_amount:      Number(sfaBalance?.paid_amount      ?? 0),
    remaining_amount: Number(sfaBalance?.remaining_amount ?? 0),
  }

  // Build all_enrollments with account_ids + per-enrollment balance
  const aeIds = ((allEnrollRes as any).data ?? []).map((e: any) => e.id as string)
  type AeAccEntry = { account_id: string; net_amount: number; paid_amount: number; remaining_amount: number }
  const aeAccMap = new Map<string, AeAccEntry>()
  if (aeIds.length) {
    const { data: aeAccData } = await db
      .from('student_financial_accounts')
      .select('id, enrollment_id, net_amount, paid_amount, remaining_amount')
      .in('enrollment_id', aeIds)
    for (const a of (aeAccData ?? []) as any[]) {
      if (a.enrollment_id) {
        aeAccMap.set(a.enrollment_id as string, {
          account_id:       a.id,
          net_amount:       Number(a.net_amount       ?? 0),
          paid_amount:      Number(a.paid_amount      ?? 0),
          remaining_amount: Number(a.remaining_amount ?? 0),
        })
      }
    }
  }
  const all_enrollments = ((allEnrollRes as any).data ?? []).map((e: any) => {
    const acc = aeAccMap.get(e.id)
    return {
      enrollment_id:      e.id as string,
      account_id:         acc?.account_id ?? null,
      course_name:        (e.course_name_snapshot    as string | null) ?? null,
      group_name:         (e.group_name_snapshot     as string | null) ?? null,
      instructor_name:    (e.instructor_name_snapshot as string | null) ?? null,
      enrolled_sessions:  Number(e.enrolled_sessions  ?? 0),
      remaining_sessions: Number(e.remaining_sessions ?? 0),
      financial_status:   (e.financial_status as string | null) ?? null,
      net_amount:         acc?.net_amount       ?? 0,
      paid_amount:        acc?.paid_amount      ?? 0,
      remaining_amount:   acc?.remaining_amount ?? 0,
    }
  })

  const installments = ((instRes.data ?? []) as any[]).map(r => ({
    id: r.id, account_id: r.account_id,
    installment_number: r.installment_number,
    amount: Number(r.amount), due_date: r.due_date,
    paid_amount: Number(r.paid_amount), status: r.status,
    notes: r.notes, created_at: r.created_at, updated_at: r.updated_at,
  }))

  const activities = ((actRes.data ?? []) as any[]).map(r => ({
    id: r.id, student_id: r.student_id, account_id: r.account_id,
    activity_type: r.activity_type, notes: r.notes,
    created_by: r.created_by, created_at: r.created_at,
    created_by_name: mapCreatedBy(r),
  }))

  const notes = ((noteRes.data ?? []) as any[]).map(r => ({
    id: r.id, student_id: r.student_id, account_id: r.account_id,
    note_text: r.note_text, is_internal: r.is_internal,
    created_by: r.created_by, created_at: r.created_at,
    created_by_name: mapCreatedBy(r),
  }))

  const promises = ((promRes.data ?? []) as any[]).map(r => ({
    id: r.id, student_id: r.student_id, account_id: r.account_id,
    promised_amount: Number(r.promised_amount), promised_date: r.promised_date,
    notes: r.notes, status: r.status,
    created_by: r.created_by, created_at: r.created_at, updated_at: r.updated_at,
    created_by_name: mapCreatedBy(r),
  }))

  const attendance_sessions = ((sessRes.data ?? []) as any[]).map(sched => {
    const rec = (sched.attendance_records ?? []).find((a: any) => a.student_id === studentId)
    return {
      schedule_id:       sched.id,
      scheduled_at:      sched.scheduled_at,
      topic:             sched.topic ?? null,
      session_status:    sched.status,
      attendance_status: rec?.status ?? null,
      late_minutes:      rec?.late_minutes ?? null,
      notes:             rec?.notes ?? null,
    }
  })

  return NextResponse.json({
    enrollment_id:        enrollmentId,
    enrollment_start_date: enrollmentStartDate,
    payments,
    reversals,
    installments,
    activities,
    notes,
    promises,
    attendance_sessions,
    all_enrollments,
    ...balanceInfo,
  })
}
