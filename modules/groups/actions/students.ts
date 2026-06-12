'use server'

import { revalidatePath }      from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import type { ActionResult }   from '@/types/app'
import { applyStudentChanges } from './db-ops'

const GROUPS_PATH = '/portal/team-leader/groups'

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

  await applyStudentChanges(db, user.id, groupId, existing.branch_id, studentIds, [])
  revalidatePath(GROUPS_PATH)
  return { success: true, data: undefined }
}
