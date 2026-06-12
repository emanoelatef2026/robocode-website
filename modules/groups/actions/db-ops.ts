import 'server-only'
import { createServiceClient }    from '@/lib/supabase/service'
import { syncGroupStatus }         from '../lifecycle'
import { assignGroupCourseService } from '../assignment-service'

type DB = ReturnType<typeof createServiceClient>

// Applies student membership changes to a group.
// Remove: marks status='dropped', preserves enrollment contract.
// Add:    upserts group_students only (contract created separately via Payment wizard).
export async function applyStudentChanges(
  db:        DB,
  _userId:   string,
  groupId:   string,
  _branchId: string,
  toAdd:     string[],
  toRemove:  string[],
): Promise<void> {
  const now = new Date().toISOString()

  for (const studentId of toRemove) {
    await db.from('group_students')
      .update({ status: 'dropped', left_at: now })
      .eq('group_id', groupId)
      .eq('student_id', studentId)
  }

  for (const studentId of toAdd) {
    await db.from('group_students').upsert(
      { group_id: groupId, student_id: studentId, enrollment_type: 'primary', status: 'active', joined_at: now },
      { onConflict: 'group_id,student_id' },
    )
  }
}

// Assigns (or removes) a course + instructor pair to a group.
// Uses assignGroupCourseService for the canonical group_courses state machine.
// Separately maintains group_instructors for lead and assistant roles.
export async function assignCourseAndInstructor(
  db:               DB,
  groupId:          string,
  courseId:         string | undefined,
  instructorId:     string | undefined,
  asstInstructorId: string | undefined,
  assignedBy:       string | null = null,
): Promise<void> {
  // Canonical state machine for group_courses
  await assignGroupCourseService(
    groupId,
    courseId ?? null,
    instructorId ?? null,
    assignedBy,
    db,
  )

  // Maintain group_instructors for both roles
  if (instructorId) {
    await db.from('group_instructors').upsert(
      { group_id: groupId, instructor_id: instructorId, role: 'lead' },
      { onConflict: 'group_id,instructor_id' },
    )
  }

  if (asstInstructorId) {
    await db.from('group_instructors').upsert(
      { group_id: groupId, instructor_id: asstInstructorId, role: 'additional' },
      { onConflict: 'group_id,instructor_id' },
    )
  }

  await syncGroupStatus(groupId, db)
}
