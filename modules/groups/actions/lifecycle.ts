'use server'

// Phase 1 — Cohort Lifecycle Foundation: Archive / Recover a cohort (`groups`
// row) and the pre-archive validation check. Distinct from, and does not
// replace, archiveGroupAction/deleteGroupAction in ./group-crud.ts — those
// implement soft-delete/cancel (DOMAIN_RULES.md Rule 2), an unrelated concept.
// See docs/DOMAIN_RULES.md Rules 1, 3, 11, 12 and the Phase 1 plan.

import { revalidatePath }      from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission, isBranchAccessible } from '@/modules/rbac/guards'
import { computeCohortHealthWarnings } from './cohort-health'
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

  // Shared with Phase 2's validateCohortGraduation (modules/groups/actions/graduation.ts)
  // — see cohort-health.ts. Mapped to bare strings here to keep this
  // function's external return shape (and the 18 Phase 1 tests asserting it)
  // unchanged.
  const warnings = (await computeCohortHealthWarnings(db, groupId)).map(w => w.message)

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
