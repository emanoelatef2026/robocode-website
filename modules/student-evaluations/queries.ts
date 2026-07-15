import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { StudentEvaluation, EvaluationCriterion } from './types'

// All evaluations for a student, newest first. `viewerScope` controls the
// visible_to_* gate — 'staff' bypasses it (staff always sees everything),
// 'student'/'parent' apply the matching visibility column.
export async function getStudentEvaluations(
  studentId: string,
  viewerScope: 'staff' | 'student' | 'parent'
): Promise<StudentEvaluation[]> {
  const db = createServiceClient()

  let q = db
    .from('student_evaluations')
    .select('*')
    .eq('student_id', studentId)
    .is('deleted_at', null)
    .order('evaluated_at', { ascending: false })

  if (viewerScope === 'student') q = q.eq('visible_to_student', true)
  if (viewerScope === 'parent')  q = q.eq('visible_to_parent', true)

  const { data } = await q
  return (data ?? []) as StudentEvaluation[]
}

// Full history for one criterion — the "history" requirement is satisfied by
// this ordered read; there is no separate snapshot table (see migration comment).
export async function getEvaluationHistory(
  studentId: string,
  criterion: EvaluationCriterion,
  viewerScope: 'staff' | 'student' | 'parent'
): Promise<StudentEvaluation[]> {
  const all = await getStudentEvaluations(studentId, viewerScope)
  return all.filter((e) => e.criterion === criterion)
}
