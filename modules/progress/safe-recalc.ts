import 'server-only'
import { calculateStudentProgress } from './actions'
import type { ProgressTuple, GroupProgressContext } from './types'

// ── Structured log helpers ────────────────────────────────────────────────────

function logOk(context: string, studentId: string) {
  console.log(JSON.stringify({ event: 'progress.ok', context, studentId }))
}

function logSkip(context: string, reason: string) {
  console.log(JSON.stringify({ event: 'progress.skip', context, reason }))
}

function logFail(context: string, studentId: string, error: unknown) {
  console.error(JSON.stringify({ event: 'progress.fail', context, studentId, error }))
}

// ── Core: fire-and-forget single recalculation ────────────────────────────────
// Failures are caught and logged — they never propagate to the caller.
// This is intentional: a progress snapshot error must not roll back an
// attendance record, submission, or portfolio mutation.
export async function safeRecalcProgress(
  tuple:   ProgressTuple | null,
  context: string
): Promise<void> {
  if (!tuple) {
    logSkip(context, 'no_tuple')
    return
  }
  try {
    const result = await calculateStudentProgress(
      tuple.studentId,
      tuple.courseId,
      tuple.semesterId,
      tuple.groupId
    )
    if (!result.success) {
      logFail(context, tuple.studentId, result.error)
    } else {
      logOk(context, tuple.studentId)
    }
  } catch (err) {
    logFail(context, tuple.studentId, String(err))
  }
}

// ── Batch: concurrent recalculation across a student list ────────────────────
// Promise.all so every student in a session fires in parallel.
// Individual failures are isolated by safeRecalcProgress.
export async function safeRecalcProgressBatch(
  tuples:  ProgressTuple[],
  context: string
): Promise<void> {
  if (!tuples.length) {
    logSkip(context, 'empty_batch')
    return
  }
  await Promise.all(tuples.map(t => safeRecalcProgress(t, context)))
}

// ── Convenience: expand GroupProgressContext list × student ids ───────────────
// Used when you have a list of students and want to recalculate each for
// every course the group is running (typical after an attendance session).
export function buildBatchTuples(
  studentIds: string[],
  contexts:   GroupProgressContext[]
): ProgressTuple[] {
  return studentIds.flatMap(studentId =>
    contexts.map(ctx => ({ studentId, ...ctx }))
  )
}
