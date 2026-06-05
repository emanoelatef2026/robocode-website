import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { OperationalTask, TaskStatus, TaskType, TaskSeverity } from './types'

// ── List open tasks for branches ──────────────────────────────────────────────

export async function getOpenTasks(
  branchIds: string[],
  opts: {
    type?:     TaskType
    severity?: TaskSeverity
    limit?:    number
  } = {}
): Promise<OperationalTask[]> {
  if (!branchIds.length) return []
  const db = createServiceClient()

  let q = db
    .from('operational_tasks')
    .select(`
      id, branch_id, student_id, enrollment_id, parent_id, assigned_to,
      type, severity, status, due_date, notes, auto_generated,
      completed_at, dismissed_at, dismissed_reason, created_by, created_at, updated_at,
      students!operational_tasks_student_id_fkey(
        student_code,
        users!students_user_id_fkey(
          profiles!profiles_user_id_fkey(first_name, last_name)
        )
      ),
      branches!operational_tasks_branch_id_fkey(name)
    `)
    .in('status', ['OPEN', 'IN_PROGRESS'] as TaskStatus[])
    .in('branch_id', branchIds)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 200)

  if (opts.type)     q = q.eq('type', opts.type)
  if (opts.severity) q = q.eq('severity', opts.severity)

  const { data, error } = await q
  if (error) return []

  return ((data ?? []) as any[]).map(row => _mapRow(row))
}

// ── Tasks for a specific student ──────────────────────────────────────────────

export async function getTasksByStudent(
  studentId: string,
  includeCompleted = false
): Promise<OperationalTask[]> {
  const db = createServiceClient()

  let q = db
    .from('operational_tasks')
    .select(`
      id, branch_id, student_id, enrollment_id, parent_id, assigned_to,
      type, severity, status, due_date, notes, auto_generated,
      completed_at, dismissed_at, dismissed_reason, created_by, created_at, updated_at
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!includeCompleted) {
    q = q.in('status', ['OPEN', 'IN_PROGRESS'] as TaskStatus[])
  }

  const { data } = await q
  return ((data ?? []) as any[]).map(row => _mapRow(row))
}

// ── Task counts by type (for dashboard badges) ────────────────────────────────

export async function getTaskCounts(branchIds: string[]): Promise<{
  total:      number
  critical:   number
  by_type:    Partial<Record<TaskType, number>>
}> {
  if (!branchIds.length) return { total: 0, critical: 0, by_type: {} }

  const db = createServiceClient()
  const { data } = await db
    .from('operational_tasks')
    .select('type, severity')
    .in('status', ['OPEN', 'IN_PROGRESS'] as TaskStatus[])
    .in('branch_id', branchIds)

  const rows = (data ?? []) as any[]
  const by_type: Partial<Record<TaskType, number>> = {}
  let critical = 0

  for (const r of rows) {
    by_type[r.type as TaskType] = (by_type[r.type as TaskType] ?? 0) + 1
    if (r.severity === 'CRITICAL') critical++
  }

  return { total: rows.length, critical, by_type }
}

// ── Check if a task already exists (prevent duplicates) ───────────────────────

export async function taskExists(
  studentId: string,
  type: TaskType,
  enrollmentId?: string | null
): Promise<boolean> {
  const db = createServiceClient()

  let q = db
    .from('operational_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('type', type)
    .in('status', ['OPEN', 'IN_PROGRESS'] as TaskStatus[])

  if (enrollmentId) q = q.eq('enrollment_id', enrollmentId)

  const { count } = await q
  return (count ?? 0) > 0
}

// ── Internal row mapper ───────────────────────────────────────────────────────

function _mapRow(row: any): OperationalTask {
  const stu  = row.students ?? null
  const prof = stu?.users?.profiles ?? null
  return {
    id:             row.id,
    branch_id:      row.branch_id,
    student_id:     row.student_id,
    enrollment_id:  row.enrollment_id,
    parent_id:      row.parent_id,
    assigned_to:    row.assigned_to,
    type:           row.type,
    severity:       row.severity,
    status:         row.status,
    due_date:       row.due_date,
    notes:          row.notes,
    auto_generated: row.auto_generated,
    completed_at:   row.completed_at,
    dismissed_at:   row.dismissed_at,
    dismissed_reason: row.dismissed_reason,
    created_by:     row.created_by,
    created_at:     row.created_at,
    updated_at:     row.updated_at,
    student_name:   prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || null : null,
    student_code:   stu?.student_code ?? null,
    branch_name:    row.branches?.name ?? null,
  }
}
