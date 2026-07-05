'use server'

import { createServiceClient }     from '@/lib/supabase/service'
import { requirePermission }        from '@/modules/rbac/guards'
import { revalidatePath }           from 'next/cache'
import { logTimelineEvent }         from '@/lib/timeline'
import { _internalReconcileEnrollment } from '@/modules/attendance/reconciliation'
import type {
  CreateEnrollmentInput,
  TransferEnrollmentInput,
  UpdateEnrollmentStatusInput,
} from './types'
import type { PaymentMethod } from '@/modules/finance/types'

const MAX_INSTALLMENTS = 36               // up to 3 years of monthly installments
const MAX_INSTALLMENT_HORIZON_YEARS = 5   // last due date must fall within 5 years

// ── Full enrollment creation (Sprint 42) ─────────────────────────────────────
// Single atomic action that creates:
//   1. group_students row
//   2. student_enrollments row (with snapshots)
//   3. student_financial_accounts (linked to enrollment_id)
//   4. finance_installments (if count > 0)
//   5. initial payment (if amount > 0)

export interface EnrollStudentFullInput {
  student_id:        string
  branch_id:         string
  group_id?:         string | null   // optional — group is a delivery container
  course_id?:        string | null   // optional — course context for the enrollment
  instructor_id?:    string | null   // optional — preferred instructor
  start_date:        string          // 'YYYY-MM-DD'
  enrollment_type?:  'primary' | 'secondary'
  enrolled_sessions?: number         // Sprint 44: session package count

  // Finance
  total_amount:    number
  discount_amount: number
  installment_count: number        // 0 = no installment plan
  first_due_date:  string          // 'YYYY-MM-DD' for first installment

  // Initial payment (optional — can be 0)
  initial_payment_amount:  number
  initial_payment_method:  PaymentMethod
  initial_payment_date:    string  // 'YYYY-MM-DD'
  initial_payment_reference?: string
  initial_payment_notes?:   string
}

export async function enrollStudentFull(input: EnrollStudentFullInput): Promise<{ ok: true; enrollmentId: string } | { error: string }> {
  const user = await requirePermission('manage_financials')
  const db   = createServiceClient()

  const net = input.total_amount - input.discount_amount

  // ── 1. Resolve optional snapshot metadata ─────────────────────────────────
  let groupName:      string | null = null
  let courseName:     string | null = null
  let instructorName: string | null = null
  let gcId:           string | null = null
  let instructorId:   string | null = input.instructor_id ?? null

  const { data: branchRow } = await db
    .from('branches').select('name').eq('id', input.branch_id).single()

  // Resolve optional snapshot metadata (group/course/instructor names)
  if (input.group_id) {
    const [{ data: groupRow }, { data: gcRow }] = await Promise.all([
      db.from('groups').select('name').eq('id', input.group_id).maybeSingle(),
      db.from('group_courses')
        .select(`
          id, instructor_id,
          courses!group_courses_course_id_fkey(title),
          instructors!group_courses_instructor_id_fkey(
            id, users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
          )
        `)
        .eq('group_id', input.group_id)
        .eq('status', 'active')
        .maybeSingle(),
    ])

    groupName = (groupRow as any)?.name ?? null
    gcId = (gcRow as any)?.id ?? null
    if (!instructorId) instructorId = (gcRow as any)?.instructor_id ?? null
    const instrProf = (gcRow as any)?.instructors?.users?.profiles
    instructorName = instrProf
      ? [instrProf.first_name, instrProf.last_name].filter(Boolean).join(' ') || null
      : null
    courseName = (gcRow as any)?.courses?.title ?? null
    if (!courseName && input.course_id) {
      const { data: cr } = await db.from('courses').select('title').eq('id', input.course_id).maybeSingle()
      courseName = (cr as any)?.title ?? null
    }
  } else if (input.course_id) {
    // No group — resolve course name and instructor name directly
    const [courseRes, instrRes] = await Promise.all([
      db.from('courses').select('title').eq('id', input.course_id).maybeSingle(),
      instructorId
        ? db.from('instructors').select(`users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name,last_name))`).eq('id', instructorId).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    courseName = (courseRes.data as any)?.title ?? null
    const instrProf = (instrRes.data as any)?.users?.profiles
    instructorName = instrProf
      ? [instrProf.first_name, instrProf.last_name].filter(Boolean).join(' ') || null
      : null
  }

  // ── 3. Create student_enrollments (with snapshots) ─────────────────────────
  const { data: seRow, error: seErr } = await db
    .from('student_enrollments')
    .insert({
      student_id:       input.student_id,
      branch_id:        input.branch_id,
      group_id:         input.group_id ?? null,
      course_id:        input.course_id ?? null,
      group_course_id:  gcId,
      instructor_id:    instructorId,
      start_date:       input.start_date,
      status:           'ACTIVE',
      enrollment_type:  input.enrollment_type ?? 'primary',
      total_amount:     input.total_amount,
      discount_amount:  input.discount_amount,
      net_amount:       net,
      // Sprint 44: session contract
      enrolled_sessions: input.enrolled_sessions ?? 0,
      consumed_sessions: 0,
      // Snapshots — preserve names at enrollment time
      group_name_snapshot:      groupName,
      course_name_snapshot:     courseName,
      instructor_name_snapshot: instructorName,
      branch_name_snapshot:     (branchRow as any)?.name ?? null,
      pricing_snapshot: {
        total_amount:    input.total_amount,
        discount_amount: input.discount_amount,
        net_amount:      net,
        enrolled_sessions: input.enrolled_sessions ?? 0,
      },
      created_by: user.id,
    })
    .select('id')
    .single()

  if (seErr) {
    if (seErr.code === '23505') {
      const { data: existing } = await db
        .from('student_enrollments')
        .select('id')
        .eq('student_id', input.student_id)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const enrollmentId = (existing as any)?.id as string | null
      if (!enrollmentId) return { error: 'Duplicate enrollment — could not resolve existing record' }
      return _createFinanceForEnrollment(db, user, enrollmentId, input, net)
    }
    return { error: seErr.message }
  }

  const enrollmentId = (seRow as any).id as string
  return _createFinanceForEnrollment(db, user, enrollmentId, input, net)
}

async function _createFinanceForEnrollment(
  db: ReturnType<typeof createServiceClient>,
  user: { id: string; globalRole: string; branchIds: string[] },
  enrollmentId: string,
  input: EnrollStudentFullInput,
  net: number
): Promise<{ ok: true; enrollmentId: string } | { error: string }> {

  const initialPaid  = input.initial_payment_amount > 0 ? input.initial_payment_amount : 0
  const remaining    = Math.max(0, net - initialPaid)

  // ── 4. Create financial account (linked to enrollment) ────────────────────
  const { data: accRow, error: accErr } = await db
    .from('student_financial_accounts')
    .insert({
      student_id:       input.student_id,
      branch_id:        input.branch_id,
      group_id:         input.group_id ?? null,
      enrollment_id:    enrollmentId,
      total_amount:     input.total_amount,
      discount_amount:  input.discount_amount,
      net_amount:       net,
      paid_amount:      initialPaid,
      remaining_amount: remaining,
      status:           remaining <= 0 ? 'PAID' : (input.first_due_date < new Date().toISOString().slice(0, 10) ? 'OVERDUE' : 'CURRENT'),
      next_due_date:    input.first_due_date || null,
      created_by:       user.id,
    })
    .select('id')
    .single()

  if (accErr) {
    // If duplicate (student already has an account), update the enrollment linkage
    if (accErr.code === '23505') {
      const { data: existingAcc } = await db
        .from('student_financial_accounts')
        .select('id')
        .eq('student_id', input.student_id)
        .maybeSingle()
      if (existingAcc) {
        await db.from('student_financial_accounts')
          .update({ enrollment_id: enrollmentId })
          .eq('id', (existingAcc as any).id)
      }
    } else {
      return { error: accErr.message }
    }
  }

  const accountId = (accRow as any)?.id as string | undefined
  if (!accountId) {
    // Get the account ID for the existing account
    const { data: existingAcc } = await db
      .from('student_financial_accounts')
      .select('id')
      .eq('student_id', input.student_id)
      .maybeSingle()
    if (!existingAcc) return { error: 'Could not create or find financial account' }
    return _finishEnrollment(db, user, enrollmentId, (existingAcc as any).id, input)
  }

  return _finishEnrollment(db, user, enrollmentId, accountId, input)
}

async function _finishEnrollment(
  db: ReturnType<typeof createServiceClient>,
  user: { id: string },
  enrollmentId: string,
  accountId: string,
  input: EnrollStudentFullInput
): Promise<{ ok: true; enrollmentId: string } | { error: string }> {
  const net = input.total_amount - input.discount_amount

  // ── 5. Create installment plan ─────────────────────────────────────────────
  if (input.installment_count > 0 && net > 0) {
    const count    = Math.floor(input.installment_count)  // ensure integer

    // Guard: hard cap on installment count regardless of amount
    if (count > MAX_INSTALLMENTS) {
      return {
        error: `Installment count too high: ${count}. Maximum ${MAX_INSTALLMENTS} installments allowed.`,
      }
    }

    const perInst  = Math.floor(net / count)
    const lastAmt  = net - perInst * (count - 1)

    // Guard: per-installment amount must be at least 1 EGP
    if (perInst < 1) {
      return {
        error: `Installment amount too small: EGP ${net} ÷ ${count} installments = EGP ${perInst.toFixed(2)}. ` +
               `Maximum ${Math.floor(net)} installments allowed for this total.`,
      }
    }

    // Guard: last due date must not extend beyond a sane horizon
    const lastDue = new Date(input.first_due_date)
    lastDue.setMonth(lastDue.getMonth() + (count - 1))
    const maxHorizon = new Date()
    maxHorizon.setFullYear(maxHorizon.getFullYear() + MAX_INSTALLMENT_HORIZON_YEARS)
    if (lastDue > maxHorizon) {
      return {
        error: `Installment plan too long: last due date ${lastDue.toISOString().slice(0, 10)} exceeds the ${MAX_INSTALLMENT_HORIZON_YEARS}-year limit.`,
      }
    }

    const installments = Array.from({ length: count }, (_, i) => {
      const due = new Date(input.first_due_date)
      due.setMonth(due.getMonth() + i)
      return {
        account_id:         accountId,
        installment_number: i + 1,
        amount:             i === count - 1 ? lastAmt : perInst,
        due_date:           due.toISOString().slice(0, 10),
        paid_amount:        0,
        status:             'PENDING' as const,
      }
    })

    const { error: instErr } = await db.from('finance_installments').insert(installments)
    if (instErr && instErr.code !== '23505') {
      // Non-fatal — enrollment created, installments failed
    }
  }

  // ── 6. Record initial payment (linked directly to enrollment) ────────────
  if (input.initial_payment_amount > 0) {
    await db.from('finance_payments').insert({
      student_id:       input.student_id,
      account_id:       accountId,
      enrollment_id:    enrollmentId,   // Sprint 44: direct ledger linkage
      amount:           input.initial_payment_amount,
      payment_date:     input.initial_payment_date,
      payment_method:   input.initial_payment_method,
      reference_number: input.initial_payment_reference ?? null,
      notes:            input.initial_payment_notes ?? 'Initial enrollment payment',
      created_by:       user.id,
    })
  }

  // Log enrollment creation to timeline (non-fatal)
  await logTimelineEvent({
    student_id:    input.student_id,
    enrollment_id: enrollmentId,
    account_id:    accountId,
    event_type:    'ENROLLMENT_CREATED',
    notes:         `Contract created. Net: EGP ${net}`,
    created_by:    user.id,
    branch_id:     input.branch_id,
  })

  // Log initial payment if present
  if (input.initial_payment_amount > 0) {
    await logTimelineEvent({
      student_id:    input.student_id,
      enrollment_id: enrollmentId,
      account_id:    accountId,
      event_type:    'PAYMENT',
      notes:         `Initial payment EGP ${input.initial_payment_amount} via ${input.initial_payment_method}`,
      created_by:    user.id,
      branch_id:     input.branch_id,
    })
  }

  revalidatePath('/portal/team-leader/finance')
  revalidatePath('/admin/finance')
  revalidatePath('/portal/parent/finance')

  // Retroactive reconciliation: link historical attendance to the new enrollment.
  // Non-fatal — enrollment creation must not fail if reconciliation has an error.
  try {
    await _internalReconcileEnrollment(db, enrollmentId)
  } catch {
    // swallow — enrollment already committed, reconciliation can be re-run manually
  }

  return { ok: true, enrollmentId }
}

// ── Create enrollment ─────────────────────────────────────────────────────────
// Dual-writes: creates both a group_students row AND a student_enrollments row.

export async function createEnrollment(input: CreateEnrollmentInput) {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const startDate = input.start_date ?? new Date().toISOString().slice(0, 10)
  const net       = (input.total_amount ?? 0) - (input.discount_amount ?? 0)

  // 1. Upsert group_students (keeps existing group management working)
  const { data: gsData, error: gsErr } = await db
    .from('group_students')
    .upsert({
      group_id:        input.group_id,
      student_id:      input.student_id,
      enrollment_type: input.enrollment_type ?? 'primary',
      status:          'active',
      joined_at:       startDate,
      notes:           input.notes ?? null,
    }, { onConflict: 'group_id,student_id' })
    .select('id')
    .single()

  if (gsErr) throw new Error(gsErr.message)
  const groupStudentId = (gsData as any).id as string

  // 2. Resolve group_course_id if not provided
  let gcId = input.group_course_id ?? null
  if (!gcId) {
    const { data: gcRow } = await db
      .from('group_courses')
      .select('id, instructor_id')
      .eq('group_id', input.group_id)
      .eq('status', 'active')
      .maybeSingle()
    gcId = (gcRow as any)?.id ?? null
    if (!input.instructor_id && (gcRow as any)?.instructor_id) {
      input.instructor_id = (gcRow as any).instructor_id
    }
  }

  // 3. Get branch_id from group if not provided
  let branchId = input.branch_id
  if (!branchId) {
    const { data: gRow } = await db
      .from('groups').select('branch_id').eq('id', input.group_id).maybeSingle()
    branchId = (gRow as any)?.branch_id ?? input.branch_id
  }

  // 4. Create student_enrollments row
  const { data: seData, error: seErr } = await db
    .from('student_enrollments')
    .insert({
      student_id:      input.student_id,
      branch_id:       branchId,
      group_id:        input.group_id,
      group_course_id: gcId,
      instructor_id:   input.instructor_id ?? null,
      group_student_id: groupStudentId,
      start_date:      startDate,
      status:          'ACTIVE',
      enrollment_type: input.enrollment_type ?? 'primary',
      pricing_plan:    input.pricing_plan ?? null,
      total_amount:    input.total_amount ?? 0,
      discount_amount: input.discount_amount ?? 0,
      net_amount:      net,
      notes:           input.notes ?? null,
      created_by:      user.id,
    })
    .select('id')
    .single()

  if (seErr) {
    // If duplicate active enrollment: return the existing one
    if (seErr.code === '23505') {
      const { data: existing } = await db
        .from('student_enrollments')
        .select('id')
        .eq('student_id', input.student_id)
        .eq('group_id', input.group_id)
        .eq('status', 'ACTIVE')
        .maybeSingle()
      return { enrollmentId: (existing as any)?.id as string, groupStudentId }
    }
    throw new Error(seErr.message)
  }

  return { enrollmentId: (seData as any).id as string, groupStudentId }
}

// ── Transfer enrollment ───────────────────────────────────────────────────────
// Marks the old enrollment as TRANSFERRED and creates a new ACTIVE enrollment.
// Preserves all historical attendance, payments, notes.

export async function transferEnrollment(input: TransferEnrollmentInput) {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const transferDate = input.transfer_date ?? new Date().toISOString().slice(0, 10)

  // 1. Get the current enrollment
  const { data: currentEnroll, error: fetchErr } = await db
    .from('student_enrollments')
    .select('*')
    .eq('id', input.enrollment_id)
    .single()
  if (fetchErr || !currentEnroll) throw new Error('Enrollment not found')
  const curr = currentEnroll as any

  if (curr.status !== 'ACTIVE') throw new Error('Only ACTIVE enrollments can be transferred')

  // 2. Resolve new group details
  const { data: newGroup } = await db
    .from('groups').select('branch_id').eq('id', input.new_group_id).maybeSingle()
  const newBranchId = (newGroup as any)?.branch_id ?? curr.branch_id

  let newGcId = input.new_group_course_id ?? null
  let newInstructorId = input.new_instructor_id ?? null
  if (!newGcId) {
    const { data: gcRow } = await db
      .from('group_courses')
      .select('id, instructor_id')
      .eq('group_id', input.new_group_id)
      .eq('status', 'active')
      .maybeSingle()
    newGcId = (gcRow as any)?.id ?? null
    if (!newInstructorId) newInstructorId = (gcRow as any)?.instructor_id ?? null
  }

  // 3. Mark current enrollment as TRANSFERRED
  await db.from('student_enrollments')
    .update({ status: 'TRANSFERRED', end_date: transferDate, updated_at: new Date().toISOString() })
    .eq('id', input.enrollment_id)

  // 4. Update old group_students row to dropped/transferred
  if (curr.group_student_id) {
    await db.from('group_students')
      .update({ status: 'dropped', left_at: transferDate })
      .eq('id', curr.group_student_id)
  }

  // 5. Create new group_students row in the destination group
  const { data: newGs } = await db
    .from('group_students')
    .insert({
      group_id:        input.new_group_id,
      student_id:      curr.student_id,
      enrollment_type: curr.enrollment_type,
      status:          'active',
      joined_at:       transferDate,
      notes:           `Transferred from group ${curr.group_id ?? '—'}. ${input.notes ?? ''}`.trim(),
    })
    .select('id')
    .single()
  const newGroupStudentId = (newGs as any)?.id ?? null

  // 6. Create new ACTIVE enrollment in the destination group
  const { data: newEnroll, error: newErr } = await db
    .from('student_enrollments')
    .insert({
      student_id:       curr.student_id,
      branch_id:        newBranchId,
      group_id:         input.new_group_id,
      group_course_id:  newGcId,
      instructor_id:    newInstructorId,
      group_student_id: newGroupStudentId,
      start_date:       transferDate,
      status:           'ACTIVE',
      enrollment_type:  curr.enrollment_type,
      // Carry forward pricing from old enrollment
      pricing_plan:     curr.pricing_plan,
      total_amount:     curr.total_amount,
      discount_amount:  curr.discount_amount,
      net_amount:       input.preserve_balance ? curr.net_amount : 0,
      transferred_from: input.enrollment_id,
      notes:            input.notes ?? null,
      created_by:       user.id,
    })
    .select('id')
    .single()
  if (newErr) throw new Error(newErr.message)

  const newEnrollmentId = (newEnroll as any).id as string

  // 7. Back-link the old enrollment to the new one
  await db.from('student_enrollments')
    .update({ transferred_to: newEnrollmentId })
    .eq('id', input.enrollment_id)

  // 8. If balance preserved: link the existing financial account to the new enrollment
  if (input.preserve_balance) {
    await db.from('student_financial_accounts')
      .update({ enrollment_id: newEnrollmentId, group_id: input.new_group_id })
      .eq('enrollment_id', input.enrollment_id)
  }

  return { newEnrollmentId, oldEnrollmentId: input.enrollment_id }
}

// ── Cancel contract ───────────────────────────────────────────────────────────
// Marks enrollment CANCELLED, removes student from group, logs timeline event.
// Returns an immutable cancellation report for display to the operator.

export interface CancellationReport {
  student_name:       string
  course_name:        string | null
  group_name:         string | null
  instructor_name:    string | null
  enrolled_sessions:  number
  consumed_sessions:  number
  remaining_sessions: number
  sessions_attended:  number
  sessions_absent:    number
  net_amount:         number
  paid_amount:        number
  remaining_balance:  number
  cancelled_at:       string
  cancelled_by_name:  string
}

export async function cancelContract(
  enrollment_id: string
): Promise<{ ok: true; report: CancellationReport } | { error: string }> {
  const user = await requirePermission('manage_financials')
  const db   = createServiceClient()

  const { data: enRow, error: enErr } = await db
    .from('student_enrollments')
    .select(`
      id, status, student_id, branch_id, group_id, group_course_id,
      course_name_snapshot, group_name_snapshot, instructor_name_snapshot,
      enrolled_sessions, consumed_sessions, remaining_sessions
    `)
    .eq('id', enrollment_id)
    .single()

  if (enErr || !enRow) return { error: 'Enrollment not found' }
  const en = enRow as any
  if (en.status !== 'ACTIVE') return { error: 'Only ACTIVE enrollments can be cancelled' }

  const [stuRes, accRes, userRes] = await Promise.all([
    db.from('students').select('first_name, last_name').eq('id', en.student_id).maybeSingle(),
    db.from('student_financial_accounts')
      .select('net_amount, paid_amount, remaining_amount')
      .eq('enrollment_id', enrollment_id)
      .maybeSingle(),
    db.from('users')
      .select('profiles!profiles_user_id_fkey(first_name, last_name)')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  const stu  = stuRes.data  as any
  const acc  = accRes.data  as any
  const uprof = (userRes.data as any)?.profiles
  const studentName     = stu   ? [stu.first_name, stu.last_name].filter(Boolean).join(' ') : 'Unknown'
  const cancelledByName = uprof ? [uprof.first_name, uprof.last_name].filter(Boolean).join(' ') || user.id : user.id

  // Count attendance (present/absent) for this student in the group
  let sessionsAttended = 0
  let sessionsAbsent   = 0
  if (en.group_course_id) {
    const { data: schedIds } = await db
      .from('schedules')
      .select('id')
      .eq('group_course_id', en.group_course_id)
      .neq('status', 'cancelled')
    const ids = ((schedIds ?? []) as any[]).map(s => s.id as string)
    if (ids.length) {
      const { data: attRows } = await db
        .from('attendance_records')
        .select('status')
        .eq('student_id', en.student_id)
        .in('schedule_id', ids)
      for (const r of (attRows ?? []) as any[]) {
        if (['present', 'late', 'makeup'].includes(r.status)) sessionsAttended++
        else if (r.status === 'absent') sessionsAbsent++
      }
    }
  }

  const cancelledAt = new Date().toISOString()

  await db.from('student_enrollments')
    .update({
      status:     'CANCELLED',
      end_date:   cancelledAt.slice(0, 10),
      updated_at: cancelledAt,
      notes:      `Cancelled by ${cancelledByName} on ${cancelledAt.slice(0, 10)}`,
    })
    .eq('id', enrollment_id)

  if (en.group_id) {
    await db.from('group_students')
      .update({ status: 'dropped', left_at: cancelledAt.slice(0, 10) })
      .eq('student_id', en.student_id)
      .eq('group_id', en.group_id)
      .eq('status', 'active')
  }

  await logTimelineEvent({
    student_id:    en.student_id,
    enrollment_id: enrollment_id,
    event_type:    'ENROLLMENT_CANCELLED',
    notes:         `Contract cancelled by ${cancelledByName}. Consumed: ${en.consumed_sessions ?? 0}/${en.enrolled_sessions ?? 0} sessions.`,
    created_by:    user.id,
    branch_id:     en.branch_id,
  })

  revalidatePath('/portal/team-leader/finance')
  revalidatePath('/portal/team-leader/groups')
  revalidatePath('/admin/finance')

  return {
    ok: true,
    report: {
      student_name:       studentName,
      course_name:        en.course_name_snapshot    ?? null,
      group_name:         en.group_name_snapshot     ?? null,
      instructor_name:    en.instructor_name_snapshot ?? null,
      enrolled_sessions:  Number(en.enrolled_sessions  ?? 0),
      consumed_sessions:  Number(en.consumed_sessions  ?? 0),
      remaining_sessions: Number(en.remaining_sessions ?? 0),
      sessions_attended:  sessionsAttended,
      sessions_absent:    sessionsAbsent,
      net_amount:         Number(acc?.net_amount       ?? 0),
      paid_amount:        Number(acc?.paid_amount      ?? 0),
      remaining_balance:  Number(acc?.remaining_amount ?? 0),
      cancelled_at:       cancelledAt,
      cancelled_by_name:  cancelledByName,
    },
  }
}

// ── Update enrollment status ─────────────────────────────────────────────────

export async function updateEnrollmentStatus(input: UpdateEnrollmentStatusInput) {
  await requirePermission('manage_groups')
  const db = createServiceClient()

  const { error } = await db
    .from('student_enrollments')
    .update({
      status:     input.status,
      end_date:   input.end_date ?? null,
      notes:      input.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.enrollment_id)

  if (error) throw new Error(error.message)
}
