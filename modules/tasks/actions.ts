'use server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentUser }      from '@/modules/rbac/guards'
import { logTimelineEvent }    from '@/lib/timeline'
import type { CreateTaskInput, UpdateTaskInput, TaskStatus } from './types'

// ── Create task ───────────────────────────────────────────────────────────────

export async function createTask(input: CreateTaskInput): Promise<{ id: string }> {
  const db   = createServiceClient()
  const user = await getCurrentUser()

  const { data, error } = await db
    .from('operational_tasks')
    .insert({
      branch_id:      input.branch_id      ?? null,
      student_id:     input.student_id     ?? null,
      enrollment_id:  input.enrollment_id  ?? null,
      parent_id:      input.parent_id      ?? null,
      assigned_to:    input.assigned_to    ?? null,
      type:           input.type,
      severity:       input.severity       ?? 'MEDIUM',
      status:         'OPEN',
      due_date:       input.due_date       ?? null,
      notes:          input.notes          ?? null,
      auto_generated: input.auto_generated ?? false,
      created_by:     input.created_by     ?? user?.id ?? null,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create task')

  // Log timeline event if student is linked
  if (input.student_id) {
    await logTimelineEvent({
      student_id:    input.student_id,
      enrollment_id: input.enrollment_id ?? null,
      event_type:    'TASK_CREATED' as any,
      notes:         `${input.type} task created`,
      created_by:    input.created_by ?? user?.id ?? null,
      branch_id:     input.branch_id ?? null,
    }).catch(() => {/* non-fatal */})
  }

  return { id: data.id }
}

// ── Update task status ────────────────────────────────────────────────────────

export async function updateTask(id: string, input: UpdateTaskInput): Promise<void> {
  const db = createServiceClient()

  const update: Record<string, unknown> = {}
  if (input.status    !== undefined) update.status     = input.status
  if (input.severity  !== undefined) update.severity   = input.severity
  if (input.assigned_to !== undefined) update.assigned_to = input.assigned_to
  if (input.due_date  !== undefined) update.due_date   = input.due_date
  if (input.notes     !== undefined) update.notes      = input.notes

  if (input.status === 'COMPLETED') update.completed_at = new Date().toISOString()
  if (input.status === 'DISMISSED') {
    update.dismissed_at     = new Date().toISOString()
    update.dismissed_reason = input.dismissed_reason ?? null
  }

  const { error } = await db
    .from('operational_tasks')
    .update(update)
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ── Complete task ─────────────────────────────────────────────────────────────

export async function completeTask(id: string, notes?: string): Promise<void> {
  const db   = createServiceClient()
  const user = await getCurrentUser()

  const { data: task } = await db
    .from('operational_tasks')
    .select('student_id, enrollment_id, branch_id, type')
    .eq('id', id)
    .single()

  await db
    .from('operational_tasks')
    .update({ status: 'COMPLETED', completed_at: new Date().toISOString(), notes: notes ?? null })
    .eq('id', id)

  if (task?.student_id) {
    await logTimelineEvent({
      student_id:    task.student_id,
      enrollment_id: task.enrollment_id ?? null,
      event_type:    'TASK_COMPLETED' as any,
      notes:         `${task.type} task completed${notes ? `: ${notes}` : ''}`,
      created_by:    user?.id ?? null,
      branch_id:     task.branch_id ?? null,
    }).catch(() => {/* non-fatal */})
  }
}

// ── Dismiss task ──────────────────────────────────────────────────────────────

export async function dismissTask(id: string, reason?: string): Promise<void> {
  const db = createServiceClient()
  await db
    .from('operational_tasks')
    .update({
      status:          'DISMISSED',
      dismissed_at:    new Date().toISOString(),
      dismissed_reason: reason ?? null,
    })
    .eq('id', id)
}

// ── Bulk create tasks (used by automation engine) ─────────────────────────────
// Sprint 52: Uses ON CONFLICT DO NOTHING to honour the unique partial index
// (idx_tasks_active_dedup_with_enrollment) — prevents duplicate active tasks.

export async function bulkCreateTasks(inputs: CreateTaskInput[]): Promise<void> {
  if (!inputs.length) return
  const db = createServiceClient()

  for (const input of inputs) {
    await db.from('operational_tasks').insert({
      branch_id:      input.branch_id      ?? null,
      student_id:     input.student_id     ?? null,
      enrollment_id:  input.enrollment_id  ?? null,
      parent_id:      input.parent_id      ?? null,
      type:           input.type,
      severity:       input.severity       ?? 'MEDIUM',
      status:         'OPEN' as TaskStatus,
      due_date:       input.due_date       ?? null,
      notes:          input.notes          ?? null,
      auto_generated: true,
      created_by:     input.created_by     ?? null,
    })
    // Unique index on (enrollment_id, type) WHERE OPEN|IN_PROGRESS will reject duplicates.
    // Supabase insert errors on unique violation — we swallow it (non-fatal for bulk ops).
    .then(() => {}, () => {/* duplicate — expected and safe to ignore */})
  }
}
