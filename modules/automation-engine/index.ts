import 'server-only'
import { createServiceClient }    from '@/lib/supabase/service'
import { computeDropoutScore }    from '@/modules/predictive-engine'
import { taskExists }             from '@/modules/tasks/queries'
import { bulkCreateTasks }        from '@/modules/tasks/actions'
import { logAutomationFailure }   from '@/modules/observability'
import type { CreateTaskInput }   from '@/modules/tasks/types'

// ── Phase 4: Automation loop protection cooldown (hours) ──────────────────────
const TRIGGER_COOLDOWN_HOURS = 6

// ── Check and log automation execution (loop guard) ───────────────────────────

async function checkAndLogExecution(
  db:           ReturnType<typeof createServiceClient>,
  triggerType:  AutomationTriggerType,
  enrollmentId: string,
  cooldownHours = TRIGGER_COOLDOWN_HOURS
): Promise<{ allowed: boolean }> {
  const cooldownStart = new Date(Date.now() - cooldownHours * 3600000).toISOString()

  // Check if this trigger fired for this enrollment within cooldown window
  const { count } = await db
    .from('automation_execution_log')
    .select('id', { count: 'exact', head: true })
    .eq('trigger_type', triggerType)
    .eq('enrollment_id', enrollmentId)
    .gte('executed_at', cooldownStart)
    .is('skipped_reason', null)  // was actually executed (not skipped)

  if ((count ?? 0) > 0) {
    // Log as skipped
    try {
      await db.from('automation_execution_log').insert({
        trigger_type:  triggerType,
        enrollment_id: enrollmentId,
        skipped_reason: `cooldown:${cooldownHours}h`,
        result:         'skipped',
        cooldown_hours: cooldownHours,
      })
    } catch { /* non-fatal */ }
    return { allowed: false }
  }

  // Log as executed
  try {
    await db.from('automation_execution_log').insert({
      trigger_type:  triggerType,
      enrollment_id: enrollmentId,
      result:         'pending',
      cooldown_hours: cooldownHours,
    })
  } catch { /* non-fatal */ }

  return { allowed: true }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type AutomationTriggerType =
  | 'SESSIONS_LOW'          // remaining_sessions <= 2
  | 'OVERDUE_7_DAYS'        // overdue >= 7 days
  | 'THREE_ABSENCES'        // consecutive_absences >= 3
  | 'ATTENDANCE_DROP_30'    // attendance dropped >30% over last 5 sessions
  | 'PROMISE_BROKEN'        // payment promise broken
  | 'STUDENT_INACTIVE_14'   // no attendance for 14+ days
  | 'DROPOUT_HIGH_RISK'     // dropout score >= 45
  | 'DROPOUT_CRITICAL'      // dropout score >= 70

export interface AutomationContext {
  enrollment_id:         string
  student_id:            string
  branch_id:             string
  student_name:          string
  student_phone:         string | null
  // Finance
  days_overdue:          number
  remaining_balance:     number
  financial_status:      string | null
  missed_payments:       number
  // Sessions
  remaining_sessions:    number
  enrolled_sessions:     number
  // Attendance
  consecutive_absences:  number
  attendance_pct:        number
  total_sessions:        number
  days_inactive:         number
  // Engagement
  homework_completion_pct: number
  unresolved_complaints: number
  low_satisfaction:      boolean
  instructor_changed:    boolean
  group_changed:         boolean
  weeks_enrolled:        number
  // Due date
  next_due_date:         string | null
}

export interface AutomationResult {
  tasks_created: number
  notifications_queued: number
  triggers_fired: AutomationTriggerType[]
}

// ── Evaluate triggers for a single enrollment ─────────────────────────────────

export async function evaluateTriggers(ctx: AutomationContext): Promise<AutomationResult> {
  const db = createServiceClient()
  const tasksToCreate: CreateTaskInput[] = []
  const triggered: AutomationTriggerType[] = []

  // 1. Sessions low → RENEWAL task
  if (ctx.enrolled_sessions > 0 && ctx.remaining_sessions <= 2) {
    const { allowed } = await checkAndLogExecution(db, 'SESSIONS_LOW', ctx.enrollment_id)
    if (allowed) triggered.push('SESSIONS_LOW')
    const exists = await taskExists(ctx.student_id, 'RENEWAL', ctx.enrollment_id).catch(() => false)
    if (allowed && !exists) {
      tasksToCreate.push({
        student_id:    ctx.student_id,
        enrollment_id: ctx.enrollment_id,
        branch_id:     ctx.branch_id,
        type:          'RENEWAL',
        severity:      ctx.remaining_sessions <= 0 ? 'CRITICAL' : 'HIGH',
        due_date:      new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
        notes:         `${ctx.remaining_sessions} sessions remaining. Auto-generated renewal task.`,
        auto_generated: true,
      })
    }
  }

  // 2. Overdue > 7 days → COLLECTION task
  if (ctx.days_overdue >= 7 && ctx.remaining_balance > 0) {
    const { allowed: ovAllowed } = await checkAndLogExecution(db, 'OVERDUE_7_DAYS', ctx.enrollment_id)
    if (ovAllowed) triggered.push('OVERDUE_7_DAYS')
    const exists = await taskExists(ctx.student_id, 'COLLECTION', ctx.enrollment_id).catch(() => false)
    if (ovAllowed && !exists) {
      tasksToCreate.push({
        student_id:    ctx.student_id,
        enrollment_id: ctx.enrollment_id,
        branch_id:     ctx.branch_id,
        type:          'COLLECTION',
        severity:      ctx.days_overdue >= 30 ? 'CRITICAL' : ctx.days_overdue >= 14 ? 'HIGH' : 'MEDIUM',
        due_date:      new Date().toISOString().slice(0, 10),
        notes:         `${ctx.days_overdue} days overdue. Balance: ${ctx.remaining_balance}.`,
        auto_generated: true,
      })
    }
  }

  // 3. Three consecutive absences → ATTENDANCE task
  if (ctx.consecutive_absences >= 3) {
    const { allowed: attAllowed } = await checkAndLogExecution(db, 'THREE_ABSENCES', ctx.enrollment_id)
    if (attAllowed) triggered.push('THREE_ABSENCES')
    const exists = await taskExists(ctx.student_id, 'ATTENDANCE', ctx.enrollment_id).catch(() => false)
    if (attAllowed && !exists) {
      tasksToCreate.push({
        student_id:    ctx.student_id,
        enrollment_id: ctx.enrollment_id,
        branch_id:     ctx.branch_id,
        type:          'ATTENDANCE',
        severity:      ctx.consecutive_absences >= 5 ? 'CRITICAL' : 'HIGH',
        due_date:      new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        notes:         `${ctx.consecutive_absences} consecutive absences detected.`,
        auto_generated: true,
      })
    }
  }

  // 4. Student inactive 14+ days → RETENTION task
  if (ctx.days_inactive >= 14 && ctx.total_sessions >= 2) {
    const { allowed: inactAllowed } = await checkAndLogExecution(db, 'STUDENT_INACTIVE_14', ctx.enrollment_id)
    if (inactAllowed) triggered.push('STUDENT_INACTIVE_14')
    const exists = await taskExists(ctx.student_id, 'RETENTION', ctx.enrollment_id).catch(() => false)
    if (inactAllowed && !exists) {
      tasksToCreate.push({
        student_id:    ctx.student_id,
        enrollment_id: ctx.enrollment_id,
        branch_id:     ctx.branch_id,
        type:          'RETENTION',
        severity:      ctx.days_inactive >= 21 ? 'CRITICAL' : 'HIGH',
        due_date:      new Date().toISOString().slice(0, 10),
        notes:         `Student inactive for ${ctx.days_inactive} days.`,
        auto_generated: true,
      })
    }
  }

  // 5. Compute predictive score and flag dropout risk
  const pred = computeDropoutScore({
    attendance_pct:          ctx.attendance_pct,
    consecutive_absences:    ctx.consecutive_absences,
    total_sessions:          ctx.total_sessions,
    days_inactive:           ctx.days_inactive,
    days_overdue:            ctx.days_overdue,
    remaining_balance:       ctx.remaining_balance,
    financial_status:        ctx.financial_status,
    missed_payments:         ctx.missed_payments,
    has_incomplete_homework: ctx.homework_completion_pct < 20,
    homework_completion_pct: ctx.homework_completion_pct,
    unresolved_complaints:   ctx.unresolved_complaints,
    low_satisfaction:        ctx.low_satisfaction,
    remaining_sessions:      ctx.remaining_sessions,
    enrolled_sessions:       ctx.enrolled_sessions,
    instructor_changed:      ctx.instructor_changed,
    group_changed:           ctx.group_changed,
    weeks_enrolled:          ctx.weeks_enrolled,
  })

  if (pred.score >= 70) {
    triggered.push('DROPOUT_CRITICAL')
    const exists = await taskExists(ctx.student_id, 'RETENTION', ctx.enrollment_id).catch(() => false)
    if (!exists) {
      tasksToCreate.push({
        student_id:    ctx.student_id,
        enrollment_id: ctx.enrollment_id,
        branch_id:     ctx.branch_id,
        type:          'RETENTION',
        severity:      'CRITICAL',
        due_date:      new Date().toISOString().slice(0, 10),
        notes:         `Dropout risk CRITICAL (score: ${pred.score}). Factors: ${pred.factors.slice(0, 3).join(', ')}`,
        auto_generated: true,
      })
    }
  } else if (pred.score >= 45) {
    triggered.push('DROPOUT_HIGH_RISK')
  }

  // Bulk create all tasks
  let tasks_created = 0
  if (tasksToCreate.length) {
    await bulkCreateTasks(tasksToCreate).catch(() => {/* non-fatal */})
    tasks_created = tasksToCreate.length
  }

  return { tasks_created, notifications_queued: 0, triggers_fired: triggered }
}

// ── Run automation for all active enrollments in branches ────────────────────

export async function runAutomationBatch(branchIds: string[]): Promise<{
  enrollments_processed: number
  tasks_created:         number
  triggers_fired:        number
}> {
  if (!branchIds.length) return { enrollments_processed: 0, tasks_created: 0, triggers_fired: 0 }

  const db = createServiceClient()

  // Fetch all ACTIVE enrollments with the data needed for triggers
  const { data: enrollments } = await db
    .from('v_finance_contract_summary')
    .select('enrollment_id, student_id, branch_id, student_name, student_phone, financial_status, days_overdue, remaining_amount, sessions_total, sessions_used, sessions_remaining')
    .in('branch_id', branchIds)
    .eq('enrollment_status', 'ACTIVE')
    .limit(500)

  if (!enrollments?.length) return { enrollments_processed: 0, tasks_created: 0, triggers_fired: 0 }

  const enrollIds = enrollments.map((e: any) => e.enrollment_id as string)

  // Fetch attendance data in bulk
  const { data: attData } = await db
    .from('attendance_records')
    .select('student_id, status, recorded_at')
    .in('student_id', enrollments.map((e: any) => e.student_id as string))
    .order('recorded_at', { ascending: false })
    .limit(5000)

  const attByStudent = new Map<string, any[]>()
  for (const rec of (attData ?? []) as any[]) {
    if (!attByStudent.has(rec.student_id)) attByStudent.set(rec.student_id, [])
    attByStudent.get(rec.student_id)!.push(rec)
  }

  let total_tasks = 0, total_triggers = 0

  for (const enroll of (enrollments ?? []) as any[]) {
    const attRecords = attByStudent.get(enroll.student_id) ?? []

    // Compute attendance stats
    const POSITIVE = new Set(['present', 'late', 'makeup'])
    let consecutiveAbsences = 0, attended = 0
    let streakDone = false, lastDate: string | null = null

    for (const rec of attRecords.slice(0, 20)) {
      const isPresent = POSITIVE.has(rec.status)
      if (isPresent) {
        attended++
        if (!lastDate) lastDate = rec.recorded_at
        if (!streakDone) streakDone = true
      } else if (!streakDone) {
        consecutiveAbsences++
      }
    }

    const daysInactive = lastDate
      ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
      : (attRecords.length === 0 ? 0 : 999)

    const totalSessions = Math.max(attRecords.length, Number(enroll.sessions_used ?? 0))
    const attendancePct  = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0

    const ctx: AutomationContext = {
      enrollment_id:         enroll.enrollment_id,
      student_id:            enroll.student_id,
      branch_id:             enroll.branch_id,
      student_name:          enroll.student_name ?? '',
      student_phone:         enroll.student_phone ?? null,
      days_overdue:          Number(enroll.days_overdue ?? 0),
      remaining_balance:     Number(enroll.remaining_amount ?? 0),
      financial_status:      enroll.financial_status ?? null,
      missed_payments:       0,  // TODO: fetch per-enrollment if needed
      remaining_sessions:    Number(enroll.sessions_remaining ?? 0),
      enrolled_sessions:     Number(enroll.sessions_total ?? 0),
      consecutive_absences:  consecutiveAbsences,
      attendance_pct:        attendancePct,
      total_sessions:        totalSessions,
      days_inactive:         daysInactive,
      homework_completion_pct: 50, // default — full fetch is expensive for batch
      unresolved_complaints:  0,
      low_satisfaction:       false,
      instructor_changed:     false,
      group_changed:          false,
      weeks_enrolled:         4,   // default
      next_due_date:          null,
    }

    const result = await evaluateTriggers(ctx).catch(async (err) => {
      await logAutomationFailure('automation-engine', String(err), {
        enrollment_id: enroll.enrollment_id,
        student_id:    enroll.student_id,
        branch_id:     enroll.branch_id,
      }).catch(() => {/* non-fatal */})
      return { tasks_created: 0, notifications_queued: 0, triggers_fired: [] as AutomationTriggerType[] }
    })
    total_tasks    += result.tasks_created
    total_triggers += result.triggers_fired.length
  }

  return {
    enrollments_processed: (enrollments ?? []).length,
    tasks_created:         total_tasks,
    triggers_fired:        total_triggers,
  }
}
