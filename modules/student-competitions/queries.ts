import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { StudentCompetition } from './types'

// Competition history is never sensitive (mirrors student_achievements: always
// self/parent readable) — no visibility gate beyond RLS's ownership check.
export async function getStudentCompetitions(studentId: string): Promise<StudentCompetition[]> {
  const db = createServiceClient()

  const { data } = await db
    .from('student_competitions')
    .select('*')
    .eq('student_id', studentId)
    .order('year', { ascending: false })

  return (data ?? []) as StudentCompetition[]
}
