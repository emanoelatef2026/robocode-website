'use server'

import { revalidatePath }       from 'next/cache'
import { createServiceClient }  from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import type { ActionResult }    from '@/types/app'
import { createSchema, updateSchema } from './validators'
import { parseStudentIds, buildGroupInsert, buildGroupUpdate, stripUndefined } from './helpers'
import { applyStudentChanges, assignCourseAndInstructor } from './db-ops'

const GROUPS_PATH = '/portal/team-leader/groups'

export async function createGroupModal(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const raw = Object.fromEntries(
    ['branch_id','name','type','capacity','day_of_week','start_time','duration_minutes',
     'start_date','end_date','meeting_link','notes','course_id','instructor_id',
     'asst_instructor_id','students_to_add_json']
      .map(k => [k, formData.get(k) ?? '']),
  )

  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { course_id, instructor_id, asst_instructor_id, students_to_add_json, ...rest } = parsed.data

  if (instructor_id && asst_instructor_id && instructor_id === asst_instructor_id) {
    return { success: false, error: { code: 'VALIDATION', message: 'Lead and assistant instructor must be different.' } }
  }

  const user = await requirePermission('manage_groups', { branchId: parsed.data.branch_id })
  const db   = createServiceClient()

  const insertPayload = buildGroupInsert(rest)
  const { data: group, error } = await db.from('groups').insert(insertPayload).select('id').single()

  const processGroup = async (gid: string) => {
    await assignCourseAndInstructor(db, gid, course_id, instructor_id, asst_instructor_id, user.id)
    const toAdd = parseStudentIds(students_to_add_json)
    if (toAdd.length) await applyStudentChanges(db, user.id, gid, rest.branch_id, toAdd, [])
    await db.rpc('write_audit_log', {
      p_performed_by: user.id, p_action: 'create', p_entity_type: 'group',
      p_entity_id: gid, p_new_values: { name: rest.name, type: rest.type }, p_branch_id: rest.branch_id,
    })
    revalidatePath(GROUPS_PATH)
  }

  if (error) {
    // Retry without optional migration columns
    const { data: g2, error: e2 } = await db.from('groups').insert({
      branch_id:   rest.branch_id, name: rest.name, type: rest.type,
      capacity:    rest.capacity ?? null, status: 'forming',
      day_of_week: rest.day_of_week ?? null, time: rest.start_time ?? null,
      start_date:  rest.start_date ?? null, notes: rest.notes ?? null,
    }).select('id').single()
    if (e2) return { success: false, error: { code: 'DB_ERROR', message: e2.message } }
    const gid2 = (g2 as { id: string }).id
    await processGroup(gid2)
    return { success: true, data: { id: gid2 } }
  }

  const gid = (group as { id: string }).id
  await processGroup(gid)
  return { success: true, data: { id: gid } }
}

export async function updateGroupModal(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const raw = Object.fromEntries(
    ['id','branch_id','name','type','status','capacity','day_of_week','start_time',
     'duration_minutes','start_date','end_date','meeting_link','notes','course_id',
     'instructor_id','asst_instructor_id','students_to_add_json','students_to_remove_json']
      .map(k => [k, formData.get(k) ?? '']),
  )

  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { id, course_id, instructor_id, asst_instructor_id, students_to_add_json, students_to_remove_json, ...rest } = parsed.data

  if (instructor_id && asst_instructor_id && instructor_id === asst_instructor_id) {
    return { success: false, error: { code: 'VALIDATION', message: 'Lead and assistant instructor must be different.' } }
  }

  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const { data: existing } = await db.from('groups').select('branch_id').eq('id', id).single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, existing.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  const cleanUpdates = stripUndefined(buildGroupUpdate(rest))
  const { error } = await db.from('groups').update(cleanUpdates).eq('id', id)
  if (error) {
    // Retry without columns added in optional migrations (duration_minutes, end_date, meeting_link)
    const STABLE = new Set(['name','type','capacity','day_of_week','time','start_date','notes','status'])
    const safeUpdates = Object.fromEntries(Object.entries(cleanUpdates).filter(([k]) => STABLE.has(k)))
    const { error: e2 } = await db.from('groups').update(safeUpdates).eq('id', id)
    if (e2) return { success: false, error: { code: 'DB_ERROR', message: e2.message } }
  }

  await assignCourseAndInstructor(db, id, course_id, instructor_id, asst_instructor_id, user.id)

  const toAdd    = parseStudentIds(students_to_add_json)
  const toRemove = parseStudentIds(students_to_remove_json)
  if (toAdd.length || toRemove.length) {
    await applyStudentChanges(db, user.id, id, existing.branch_id, toAdd, toRemove)
  }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id, p_action: 'update', p_entity_type: 'group',
    p_entity_id: id, p_new_values: cleanUpdates,
  })
  revalidatePath(GROUPS_PATH)
  return { success: true, data: { id } }
}

export async function archiveGroupAction(groupId: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const { data: existing } = await db.from('groups').select('branch_id').eq('id', groupId).single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, existing.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  await db.from('groups').update({ status: 'cancelled', deleted_at: new Date().toISOString() }).eq('id', groupId)
  await db.rpc('write_audit_log', { p_performed_by: user.id, p_action: 'archive', p_entity_type: 'group', p_entity_id: groupId })
  revalidatePath(GROUPS_PATH)
  return { success: true, data: undefined }
}

export async function deleteGroupAction(groupId: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_groups')
  const db   = createServiceClient()

  const { data: existing } = await db.from('groups').select('branch_id').eq('id', groupId).single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Group not found.' } }
  if (!isBranchAccessible(user, existing.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  const now = new Date().toISOString()
  await db.from('group_students').update({ status: 'dropped', left_at: now }).eq('group_id', groupId).eq('status', 'active')
  await db.from('groups').update({ status: 'cancelled', deleted_at: now }).eq('id', groupId)
  await db.rpc('write_audit_log', {
    p_performed_by: user.id, p_action: 'delete', p_entity_type: 'group',
    p_entity_id: groupId, p_branch_id: existing.branch_id,
  })
  revalidatePath(GROUPS_PATH)
  return { success: true, data: undefined }
}
