'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission }   from '@/modules/rbac/guards'

export interface GroupHistoryEntry {
  group_id:       string
  group_name:     string
  course_name:    string | null
  instructor_name:string | null
  joined_at:      string | null
  left_at:        string | null
  is_current:     boolean
}

export async function getStudentGroupHistory(studentId: string): Promise<GroupHistoryEntry[]> {
  await requirePermission('manage_students')
  const db = createServiceClient()

  // Fetch all group memberships for this student, including past ones
  const { data: memberships, error } = await db
    .from('group_students')
    .select(`
      group_id,
      joined_at,
      left_at,
      groups (
        name,
        courses ( title ),
        group_instructors (
          profiles ( full_name )
        )
      )
    `)
    .eq('student_id', studentId)
    .order('joined_at', { ascending: false })

  if (error || !memberships) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return memberships.map((m: any) => {
    const g = m.groups ?? null

    const instructorProfile = Array.isArray(g?.group_instructors)
      ? g.group_instructors.find((gi: { profiles: { full_name: string } | null }) => gi.profiles?.full_name)?.profiles
      : null

    const coursesArr = g?.courses
    const courseTitle = Array.isArray(coursesArr) ? coursesArr[0]?.title : (coursesArr?.title ?? null)

    return {
      group_id:        m.group_id as string,
      group_name:      (g?.name as string) ?? '—',
      course_name:     courseTitle ?? null,
      instructor_name: (instructorProfile?.full_name as string) ?? null,
      joined_at:       m.joined_at as string | null,
      left_at:         m.left_at as string | null,
      is_current:      !m.left_at,
    }
  })
}
