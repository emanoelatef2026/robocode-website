'use server'

import { revalidatePath }      from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import type { ActionResult }   from '@/types/app'
import { applyStudentChanges, type ContractChoiceMap } from './db-ops'

const GROUPS_PATH = '/portal/team-leader/groups'

export async function moveStudentsToGroupAction(
  sourceGroupId: string, targetGroupId: string, studentIds: string[], contractMode: 'continue' | 'new',
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  if (!studentIds.length || sourceGroupId === targetGroupId || !['continue', 'new'].includes(contractMode)) {
    return { success: false, error: { code: 'VALIDATION', message: 'Choose students, a different group, and a contract option.' } }
  }
  const db = createServiceClient()
  const { error } = await db.rpc('move_group_students_atomic', {
    p_source_group_id: sourceGroupId, p_target_group_id: targetGroupId,
    p_student_ids: [...new Set(studentIds)], p_contract_mode: contractMode,
    p_allowed_branch_ids: user.globalRole === 'super_admin' ? null : user.branchIds,
  })
  if (error) {
    console.error('Atomic group move failed', error)
    return { success: false, error: { code: 'MOVE_FAILED', message: error.code === 'P0001'
      ? error.message : 'Could not move the students. No changes were saved. Refresh and try again.' } }
  }
  for (const path of ['/admin/groups', GROUPS_PATH, '/admin/students', '/portal/team-leader/students']) revalidatePath(path)
  for (const path of ['/portal/student', '/portal/parent', '/portal/instructor']) revalidatePath(path, 'layout')
  return { success: true, data: undefined }
}

export async function removeStudentFromGroupAction(
  groupId:   string,
  studentId: string,
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const { data: existing } = await db.from('groups').select('branch_id').eq('id', groupId).single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, existing.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  await applyStudentChanges(db, user.id, groupId, existing.branch_id, [], [studentId])
  revalidatePath(GROUPS_PATH)
  return { success: true, data: undefined }
}

export async function addStudentsToGroupAction(
  groupId:    string,
  studentIds: string[],
  contractChoices: ContractChoiceMap = {},
): Promise<ActionResult<void>> {
  if (!studentIds.length) return { success: true, data: undefined }

  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const { data: existing } = await db
    .from('groups')
    .select('branch_id, capacity')
    .eq('id', groupId)
    .single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, existing.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  const cap = (existing as { capacity: number | null }).capacity
  if (cap) {
    const { count } = await db
      .from('group_students')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('status', 'active')
    if ((count ?? 0) + studentIds.length > cap) {
      return {
        success: false,
        error: { code: 'CAPACITY', message: `Adding ${studentIds.length} student(s) would exceed capacity of ${cap}.` },
      }
    }
  }

  await applyStudentChanges(db, user.id, groupId, existing.branch_id, studentIds, [], contractChoices)
  revalidatePath(GROUPS_PATH)
  return { success: true, data: undefined }
}
