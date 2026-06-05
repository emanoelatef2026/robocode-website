'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import type { ActionResult } from '@/types/app'

export async function assignStudentToGroup(
  studentId: string,
  groupId:   string
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_students')
  const db   = createServiceClient()

  // Verify both exist
  const [{ data: student }, { data: group }] = await Promise.all([
    db.from('students').select('id, branch_id').eq('id', studentId).is('deleted_at', null).single(),
    db.from('groups').select('id, branch_id, status').eq('id', groupId).single(),
  ])

  if (!student) return { success: false, error: { code: 'NOT_FOUND', message: 'Student not found.' } }
  if (!group)   return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (group.status !== 'active') {
    return { success: false, error: { code: 'VALIDATION', message: 'Cannot assign to an inactive group.' } }
  }
  if (student.branch_id !== group.branch_id) {
    return { success: false, error: { code: 'VALIDATION', message: 'Student and group must belong to the same branch.' } }
  }

  // Check if already in this group
  const { data: existing } = await db
    .from('group_students')
    .select('id, status')
    .eq('student_id', studentId)
    .eq('group_id', groupId)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'active') {
      return { success: false, error: { code: 'DUPLICATE', message: 'Student is already in this group.' } }
    }
    // Re-activate
    await db.from('group_students')
      .update({ status: 'active', left_at: null, joined_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    await db.from('group_students').insert({
      group_id:        groupId,
      student_id:      studentId,
      enrollment_type: 'primary',
      status:          'active',
      joined_at:       new Date().toISOString(),
    })
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'assign_group',
    p_entity_type:  'student',
    p_entity_id:    studentId,
    p_new_values:   { group_id: groupId },
    p_branch_id:    student.branch_id,
  })

  revalidatePath('/portal/team-leader/students')
  return { success: true, data: undefined }
}
