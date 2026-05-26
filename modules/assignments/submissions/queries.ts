import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { Submission, SubmissionListItem } from './types'

export async function listSubmissions(
  assignmentId: string
): Promise<SubmissionListItem[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('submissions')
    .select(
      `id, assignment_id, student_id, submitted_at, status, score, is_late, resubmission_count,
       students!submissions_student_id_fkey(
         users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))
       )`
    )
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false })

  if (error) return []

  return (data ?? []).map((row: any) => ({
    id:                 row.id,
    assignment_id:      row.assignment_id,
    student_id:         row.student_id,
    submitted_at:       row.submitted_at,
    status:             row.status,
    score:              row.score ?? null,
    is_late:            row.is_late,
    resubmission_count: row.resubmission_count,
    student_email:      row.students?.users?.email ?? '',
    student_name:       [
      row.students?.users?.profiles?.first_name,
      row.students?.users?.profiles?.last_name,
    ].filter(Boolean).join(' ') || 'Unknown',
  }))
}

export async function getSubmission(id: string): Promise<Submission | null> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('submissions')
    .select(
      `*,
       students!submissions_student_id_fkey(
         users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))
       ),
       assignments!submissions_assignment_id_fkey(title)`
    )
    .eq('id', id)
    .single()

  if (error || !data) return null

  const row = data as any
  return {
    ...row,
    student_email:    row.students?.users?.email ?? '',
    student_name:     [
      row.students?.users?.profiles?.first_name,
      row.students?.users?.profiles?.last_name,
    ].filter(Boolean).join(' ') || 'Unknown',
    assignment_title: row.assignments?.title ?? '',
    rubric_scores:    row.rubric_scores ?? {},
    image_urls:       row.image_urls ?? [],
    file_keys:        row.file_keys ?? [],
  } as Submission
}
