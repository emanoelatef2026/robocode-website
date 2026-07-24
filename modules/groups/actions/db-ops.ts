import 'server-only'
import { createServiceClient }    from '@/lib/supabase/service'
import { syncGroupStatus }         from '../lifecycle'
import { assignGroupCourseService } from '../assignment-service'
import { generateGroupSchedules }   from './schedule-generation'
import { resolveGroupCourseId }     from '@/modules/academic/enrollment-integrity'
import { reconcileGroupJoin }       from '@/modules/enrollments/historical-reconciliation'

type DB = ReturnType<typeof createServiceClient>

// Updates the group's academic plan on its active group_courses row, then
// auto-fills the schedules table forward through the last planned session
// (so the instructor calendar keeps showing sessions until the group ends).
// Call this after assignCourseAndInstructor to persist TL-defined session count.
export async function updateGroupCoursePlan(
  db:              DB,
  groupId:         string,
  plannedSessions: number | undefined,
  openEnded:       boolean,
  createdBy:       string | null = null,
): Promise<void> {
  const totalSessions = openEnded ? null : (plannedSessions ?? null)

  const { data: gcRow } = await db
    .from('group_courses')
    .update({
      total_sessions: totalSessions,
      open_ended:     openEnded,
    })
    .eq('group_id', groupId)
    .eq('status', 'active')
    .select('id')
    .maybeSingle()

  if (gcRow && !openEnded) {
    await generateGroupSchedules(db, groupId, (gcRow as { id: string }).id, totalSessions, createdBy)
  }
}

// Applies student membership changes to a group.
// Remove: marks status='dropped', preserves enrollment contract.
// Add:    upserts group_students only (contract created separately via Payment wizard).
export async function applyStudentChanges(
  db:       DB,
  userId:   string,
  groupId:  string,
  branchId: string,
  toAdd:    string[],
  toRemove: string[],
): Promise<void> {
  const now = new Date().toISOString()

  await Promise.all([
    toRemove.length > 0
      ? db.from('group_students')
          .update({ status: 'dropped', left_at: now })
          .eq('group_id', groupId)
          .in('student_id', toRemove)
      : Promise.resolve(),
    toAdd.length > 0
      ? db.from('group_students').upsert(
          toAdd.map(studentId => ({
            group_id: groupId, student_id: studentId,
            enrollment_type: 'primary', status: 'active', joined_at: now,
          })),
          { onConflict: 'group_id,student_id' },
        )
      : Promise.resolve(),
  ])

  // Historical Enrollment Reconciliation: non-fatal flag per newly-added
  // student if this group already has completed sessions. This form ("contract
  // created separately via Payment wizard") has no enrollment to consume
  // against yet, so reconcileGroupJoin's default (no `choice`) applies —
  // flag only, never auto-consume.
  if (toAdd.length > 0) {
    const courseId = await resolveGroupCourseId(db, groupId)
    for (const studentId of toAdd) {
      await reconcileGroupJoin({ db, studentId, groupId, courseId, branchId, performedBy: userId })
    }
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

  // Maintain group_instructors — only insert if no existing allocation exists.
  // Phase 18: include allocation fields so ownership tracking works correctly.
  if (instructorId) {
    const { data: existingAlloc } = await db
      .from('group_instructors')
      .select('instructor_id')
      .eq('group_id', groupId)
      .eq('instructor_id', instructorId)
      .maybeSingle()

    if (!existingAlloc) {
      await db.from('group_instructors').insert({
        group_id:          groupId,
        instructor_id:     instructorId,
        role:              'lead',
        from_session:      1,
        allocation_status: 'active',
        assigned_at:       new Date().toISOString(),
      })
    }
  }

  await syncGroupStatus(groupId, db)
}
