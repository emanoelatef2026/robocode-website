import 'server-only'
import { createServiceClient }    from '@/lib/supabase/service'
import { syncGroupStatus }         from '../lifecycle'
import { assignGroupCourseService } from '../assignment-service'
import { generateGroupSchedules }   from './schedule-generation'
import { resolveGroupCourseId, closeSameCourseGroupMemberships } from '@/modules/academic/enrollment-integrity'
import { reconcileGroupJoin }       from '@/modules/enrollments/historical-reconciliation'

type DB = ReturnType<typeof createServiceClient>
export type ContractJoinMode = 'continue' | 'new'
export type ContractChoiceMap = Record<string, ContractJoinMode>

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
  contractChoices: ContractChoiceMap = {},
): Promise<void> {
  const now = new Date().toISOString()

  const courseId = await resolveGroupCourseId(db, groupId)

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
            course_id: courseId,
          })),
          { onConflict: 'group_id,student_id' },
        )
      : Promise.resolve(),
  ])

  // Close the previous membership only after the new membership is safely
  // written. This is the shared chokepoint for create/edit/quick-add flows.
  if (toAdd.length > 0) {
    for (const studentId of toAdd) {
      await closeSameCourseGroupMemberships(db, {
        studentId, courseId, excludeGroupId: groupId,
        reason: `Superseded by ${contractChoices[studentId] === 'new' ? 'new contract in' : 'move to'} group ${groupId}.`,
      })
      await applyContractChoice(db, userId, {
        studentId, groupId, courseId, branchId,
        mode: contractChoices[studentId] ?? 'new',
      })
      await reconcileGroupJoin({ db, studentId, groupId, courseId, branchId, performedBy: userId })
    }
  }
}

export async function applyContractChoice(
  db: DB,
  userId: string,
  input: { studentId: string; groupId: string; courseId: string | null; branchId: string; mode: ContractJoinMode },
): Promise<void> {
  if (!input.courseId) return

  const { data: membership } = await db.from('group_students')
    .select('id').eq('group_id', input.groupId).eq('student_id', input.studentId).maybeSingle()
  if (!membership) return

  const { data: current } = await db.from('student_enrollments')
    .select('id, group_id, group_student_id, branch_id, group_course_id, instructor_id, enrollment_type, pricing_plan, total_amount, discount_amount, net_amount, enrolled_sessions, consumed_sessions, notes')
    .eq('student_id', input.studentId).eq('course_id', input.courseId).eq('status', 'ACTIVE')
    .order('created_at', { ascending: true }).limit(1).maybeSingle()

  if (input.mode === 'continue' && current) {
    await db.from('student_enrollments').update({
      group_id: input.groupId,
      group_student_id: (membership as { id: string }).id,
      branch_id: input.branchId,
    }).eq('id', (current as { id: string }).id)
    await db.from('student_financial_accounts')
      .update({ group_id: input.groupId })
      .eq('enrollment_id', (current as { id: string }).id)
    return
  }

  if (input.mode === 'new' && current) {
    await db.from('student_enrollments').update({
      status: 'CANCELLED',
      end_date: new Date().toISOString().slice(0, 10),
      notes: `Closed when a new contract was started in group ${input.groupId}.`,
    }).eq('id', (current as { id: string }).id)
  }

  const { data: gc } = await db.from('group_courses')
    .select('id, instructor_id').eq('group_id', input.groupId).eq('course_id', input.courseId)
    .eq('status', 'active').maybeSingle()

  const { data: enrollment } = await db.from('student_enrollments').insert({
    student_id: input.studentId,
    branch_id: input.branchId,
    group_id: input.groupId,
    course_id: input.courseId,
    group_course_id: (gc as any)?.id ?? null,
    group_student_id: (membership as { id: string }).id,
    instructor_id: (gc as any)?.instructor_id ?? null,
    start_date: new Date().toISOString().slice(0, 10),
    status: 'ACTIVE',
    enrollment_type: 'primary',
    total_amount: 0,
    discount_amount: 0,
    net_amount: 0,
    enrolled_sessions: 0,
    consumed_sessions: 0,
    pricing_snapshot: { total_amount: 0, discount_amount: 0, net_amount: 0, enrolled_sessions: 0 },
    created_by: userId,
  }).select('id').single()
  if (!enrollment) return

  await db.from('student_financial_accounts').insert({
    student_id: input.studentId,
    branch_id: input.branchId,
    group_id: input.groupId,
    enrollment_id: (enrollment as { id: string }).id,
    total_amount: 0,
    discount_amount: 0,
    net_amount: 0,
    paid_amount: 0,
    remaining_amount: 0,
    status: 'PAID',
    created_by: userId,
  })
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
