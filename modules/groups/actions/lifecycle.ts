'use server'

// Phase 1 — Cohort Lifecycle Foundation: Archive / Recover a cohort (`groups`
// row) and the pre-archive validation check. Distinct from, and does not
// replace, archiveGroupAction/deleteGroupAction in ./group-crud.ts — those
// implement soft-delete/cancel (DOMAIN_RULES.md Rule 2), an unrelated concept.
// See docs/DOMAIN_RULES.md Rules 1, 3, 11, 12 and the Phase 1 plan.

import { revalidatePath }      from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import type { ActionResult }   from '@/types/app'

const GROUPS_PATH = '/portal/team-leader/groups'

export interface CohortArchivalValidation {
  blockers: string[]
  warnings: string[]
}

export interface ArchivedCohortRow {
  id:          string
  name:        string
  branch_id:   string
  branch_name: string | null
  archived_at: string | null
}

// Read-only check — never mutates. Called both by the UI (to preview
// warnings before confirming) and again server-side inside archiveCohortAction
// (never trust client-only validation).
export async function validateCohortArchival(groupId: string): Promise<CohortArchivalValidation> {
  const db = createServiceClient()

  const { data: group } = await db
    .from('groups')
    .select('id, status')
    .eq('id', groupId)
    .maybeSingle()

  if (!group) {
    return { blockers: ['Cohort not found.'], warnings: [] }
  }
  if (group.status === 'archived') {
    return { blockers: ['Cohort is already Archived.'], warnings: [] }
  }
  if (group.status !== 'completed') {
    return { blockers: ['Cohort must be Completed before it can be Archived.'], warnings: [] }
  }

  const warnings: string[] = []

  const { data: groupCourses } = await db
    .from('group_courses')
    .select('id, course_id')
    .eq('group_id', groupId)

  const groupCourseIds = (groupCourses ?? []).map(gc => gc.id)

  if (groupCourseIds.length) {
    const { data: schedules } = await db
      .from('schedules')
      .select('id, status')
      .in('group_course_id', groupCourseIds)

    const unfinished = (schedules ?? []).filter(s => s.status !== 'completed' && s.status !== 'cancelled')
    if (unfinished.length) {
      warnings.push(`${unfinished.length} session(s) are not marked completed or cancelled.`)
    }

    const completedScheduleIds = (schedules ?? []).filter(s => s.status === 'completed').map(s => s.id)
    if (completedScheduleIds.length) {
      const { data: attendanceRows } = await db
        .from('attendance_records')
        .select('schedule_id')
        .in('schedule_id', completedScheduleIds)
      const withAttendance = new Set((attendanceRows ?? []).map(a => a.schedule_id))
      const missing = completedScheduleIds.filter(id => !withAttendance.has(id))
      if (missing.length) {
        warnings.push(`${missing.length} completed session(s) have no attendance recorded.`)
      }
    }
  }

  const { data: financeAccounts } = await db
    .from('student_financial_accounts')
    .select('id, remaining_amount')
    .eq('group_id', groupId)
    .gt('remaining_amount', 0)

  if (financeAccounts?.length) {
    warnings.push(`${financeAccounts.length} student(s) have an outstanding balance for this cohort.`)
  }

  const { data: activeStudents } = await db
    .from('group_students')
    .select('student_id')
    .eq('group_id', groupId)
    .eq('status', 'active')

  const courseIds = [...new Set((groupCourses ?? []).map(gc => gc.course_id).filter(Boolean))]
  if (activeStudents?.length && courseIds.length) {
    const studentIds = activeStudents.map(s => s.student_id)
    const { data: certs } = await db
      .from('certificates')
      .select('student_id')
      .in('student_id', studentIds)
      .in('course_id', courseIds)
    const withCert = new Set((certs ?? []).map(c => c.student_id))
    const missingCert = studentIds.filter(id => !withCert.has(id))
    if (missingCert.length) {
      warnings.push(`${missingCert.length} student(s) have no certificate on file for this cohort's course.`)
    }
  }

  return { blockers: [], warnings }
}

export async function archiveCohortAction(
  groupId: string,
  reason: string,
): Promise<ActionResult<{ warnings: string[] }>> {
  const user = await requirePermission('archive_cohort')
  const db   = createServiceClient()

  const { data: existing } = await db.from('groups').select('branch_id, status').eq('id', groupId).single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Cohort not found.' } }
  if (!isBranchAccessible(user, existing.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }

  const validation = await validateCohortArchival(groupId)
  if (validation.blockers.length) {
    return { success: false, error: { code: 'VALIDATION', message: validation.blockers.join(' ') } }
  }

  const { error } = await db.from('groups').update({ status: 'archived' }).eq('id', groupId)
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'archive_cohort',
    p_entity_type:  'group',
    p_entity_id:    groupId,
    p_old_values:   { status: existing.status },
    p_new_values:   { status: 'archived', reason },
    p_branch_id:    existing.branch_id,
  })

  revalidatePath(GROUPS_PATH)
  return { success: true, data: { warnings: validation.warnings } }
}

export async function recoverCohortAction(
  groupId: string,
  reason: string,
): Promise<ActionResult<void>> {
  const user = await requirePermission('recover_archived_cohort')
  const db   = createServiceClient()

  const { data: existing } = await db.from('groups').select('branch_id, status').eq('id', groupId).single()
  if (!existing) return { success: false, error: { code: 'NOT_FOUND', message: 'Cohort not found.' } }
  if (!isBranchAccessible(user, existing.branch_id)) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No access to this branch.' } }
  }
  if (existing.status !== 'archived') {
    return { success: false, error: { code: 'VALIDATION', message: 'Cohort is not Archived.' } }
  }

  const { error } = await db.from('groups').update({ status: 'completed' }).eq('id', groupId)
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'recover_cohort',
    p_entity_type:  'group',
    p_entity_id:    groupId,
    p_old_values:   { status: 'archived' },
    p_new_values:   { status: 'completed', reason },
    p_branch_id:    existing.branch_id,
  })

  revalidatePath(GROUPS_PATH)
  return { success: true, data: undefined }
}

export async function listArchivedCohorts(): Promise<ActionResult<ArchivedCohortRow[]>> {
  const user = await requirePermission('view_archived_cohorts')
  const db   = createServiceClient()

  let query = db
    .from('groups')
    .select('id, name, branch_id, archived_at, branches(name)')
    .eq('status', 'archived')
    .order('archived_at', { ascending: false })

  if (user.globalRole !== 'super_admin') {
    query = query.in('branch_id', user.branchIds)
  }

  const { data, error } = await query
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  const rows: ArchivedCohortRow[] = (data ?? []).map((g) => ({
    id:          g.id,
    name:        g.name,
    branch_id:   g.branch_id,
    branch_name: (g.branches as unknown as { name: string } | null)?.name ?? null,
    archived_at: g.archived_at,
  }))

  return { success: true, data: rows }
}
