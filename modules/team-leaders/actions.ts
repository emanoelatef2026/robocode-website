'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { createTeamLeaderSchema, updateTeamLeaderSchema } from './schemas'
import { saveUserPermissions } from '@/modules/user-permissions/mutations'
import { generateUniqueLoginEmail, makeEmailLocalPartExists } from '@/lib/generate-login-email'
import type { ActionResult } from '@/types/app'

// UUID format for validating branch_ids from form
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validateBranchIds(raw: FormDataEntryValue[]): string[] | null {
  const ids = raw.map(String).filter(Boolean)
  if (ids.length === 0 || !ids.every((id) => UUID_RE.test(id))) return null
  return ids
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createTeamLeader(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const branch_ids = validateBranchIds(formData.getAll('branch_id'))
  if (!branch_ids) {
    return { success: false, error: { code: 'VALIDATION', message: 'Select at least one branch.' } }
  }

  const raw = {
    password:            formData.get('password'),
    first_name:          formData.get('first_name'),
    last_name:           formData.get('last_name'),
    status:              formData.get('status') || 'active',
    phone:               formData.get('phone')               || undefined,
    payment_link:        formData.get('payment_link')        || undefined,
    wallet_number:       formData.get('wallet_number')       || undefined,
    bank_account_number: formData.get('bank_account_number') || undefined,
  }

  const parsed = createTeamLeaderSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const actor = await requirePermission('manage_system')
  const db    = createServiceClient()

  const { password, first_name, last_name, status, phone, payment_link, wallet_number, bank_account_number } = parsed.data

  // 1. Generate a unique @robocodeschools.com login address, then create the auth user
  const email = await generateUniqueLoginEmail('staff', first_name, last_name, makeEmailLocalPartExists(db))
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError || !created?.user) {
    return { success: false, error: { code: 'AUTH_ERROR', message: createError?.message ?? 'Failed to create user' } }
  }
  const authUserId = created.user.id

  // 2. Ensure public.users row
  await db.from('users').upsert({ id: authUserId, email, phone: phone || null }, { onConflict: 'id' })

  // 3. Upsert profile
  const { data: existingProfile } = await db
    .from('profiles').select('id').eq('user_id', authUserId).maybeSingle()

  if (!existingProfile) {
    await db.from('profiles').insert({ user_id: authUserId, first_name, last_name })
  } else {
    await db.from('profiles').update({ first_name, last_name }).eq('user_id', authUserId)
  }

  // 4. Look up team_leader role
  const { data: tlRole, error: roleError } = await db
    .from('roles').select('id').eq('name', 'team_leader').single()

  if (roleError || !tlRole) {
    return { success: false, error: { code: 'DB_ERROR', message: 'team_leader role not found in database' } }
  }

  // 5. Assign team_leader role for EACH branch (multi-branch)
  if (status === 'active') {
    const rows = branch_ids.map((bid) => ({
      user_id:  authUserId,
      role_id:  tlRole.id,
      branch_id: bid,
    }))
    const { error: urError } = await db.from('user_roles').upsert(rows, {
      onConflict: 'user_id,role_id,branch_id',
      ignoreDuplicates: true,
    })
    if (urError) {
      return { success: false, error: { code: 'DB_ERROR', message: urError.message } }
    }
  }

  // 6. Store status + primary branch + financial info in metadata
  await db.from('users').update({
    metadata: {
      tl_status:           status,
      tl_branch_id:        branch_ids[0],   // first branch as fallback reference
      payment_link:        payment_link        || null,
      wallet_number:       wallet_number       || null,
      bank_account_number: bank_account_number || null,
    },
  }).eq('id', authUserId)

  // 7. Save per-user permissions
  const grantedPermissions = formData.getAll('permission') as string[]
  await saveUserPermissions(authUserId, actor.id, grantedPermissions)

  await db.rpc('write_audit_log', {
    p_performed_by: actor.id,
    p_action:       'create',
    p_entity_type:  'team_leader',
    p_entity_id:    authUserId,
    p_new_values:   { email, first_name, last_name, branch_ids, status },
    p_branch_id:    branch_ids[0],
  })

  revalidatePath('/admin/team-leaders')
  redirect('/admin/team-leaders')
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateTeamLeader(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_system')
  const db   = createServiceClient()

  // Branch IDs from checkboxes — may be empty if all deselected
  const new_branch_ids = (formData.getAll('branch_id') as string[]).filter(Boolean)

  const raw = {
    user_id:             formData.get('user_id'),
    first_name:          formData.get('first_name')          || undefined,
    last_name:           formData.get('last_name')           || undefined,
    status:              formData.get('status')              || undefined,
    new_password:        formData.get('new_password')        || undefined,
    phone:               formData.get('phone')               || undefined,
    payment_link:        formData.get('payment_link')        || undefined,
    wallet_number:       formData.get('wallet_number')       || undefined,
    bank_account_number: formData.get('bank_account_number') || undefined,
  }

  const parsed = updateTeamLeaderSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { user_id, first_name, last_name, status, new_password, phone, payment_link, wallet_number, bank_account_number } = parsed.data

  // 1. Update profile
  if (first_name || last_name) {
    const updates: Record<string, string> = {}
    if (first_name) updates.first_name = first_name
    if (last_name)  updates.last_name  = last_name
    await db.from('profiles').update(updates).eq('user_id', user_id)
  }

  if (phone !== undefined) {
    await db.from('users').update({ phone: phone || null }).eq('id', user_id)
  }

  // 2. Reset password
  if (new_password) {
    const { error: pwError } = await db.auth.admin.updateUserById(user_id, { password: new_password })
    if (pwError) {
      return { success: false, error: { code: 'AUTH_ERROR', message: pwError.message } }
    }
  }

  // 3. Fetch role
  const { data: tlRole } = await db.from('roles').select('id').eq('name', 'team_leader').single()
  if (!tlRole) {
    return { success: false, error: { code: 'DB_ERROR', message: 'team_leader role not found' } }
  }

  const targetStatus = status ?? 'active'

  // 4. Replace ALL branch assignments atomically:
  //    Delete all existing, then insert the new set (if active).
  await db.from('user_roles')
    .delete()
    .eq('user_id', user_id)
    .eq('role_id', tlRole.id)
    .not('branch_id', 'is', null)

  if (targetStatus === 'active' && new_branch_ids.length > 0) {
    await db.from('user_roles').insert(
      new_branch_ids.map((bid) => ({
        user_id,
        role_id:   tlRole.id,
        branch_id: bid,
      }))
    )
  }

  // 5. Update metadata
  const { data: metaRow } = await db.from('users').select('metadata').eq('id', user_id).single()
  const currentMeta = (metaRow?.metadata as Record<string, unknown>) ?? {}
  const updatedMeta: Record<string, unknown> = {
    ...currentMeta,
    tl_status:    targetStatus,
    tl_branch_id: new_branch_ids[0] ?? null,
  }
  if (payment_link        !== undefined) updatedMeta.payment_link        = payment_link        || null
  if (wallet_number       !== undefined) updatedMeta.wallet_number       = wallet_number       || null
  if (bank_account_number !== undefined) updatedMeta.bank_account_number = bank_account_number || null
  await db.from('users').update({ metadata: updatedMeta }).eq('id', user_id)

  // 6. Save per-user permissions
  const grantedPermissions = formData.getAll('permission') as string[]
  await saveUserPermissions(user_id, user.id, grantedPermissions)

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'team_leader',
    p_entity_id:    user_id,
    p_new_values:   { first_name, last_name, branch_ids: new_branch_ids, status: targetStatus, password_reset: !!new_password },
  })

  revalidatePath('/admin/team-leaders')
  revalidatePath(`/admin/team-leaders/${user_id}`)
  redirect(`/admin/team-leaders/${user_id}`)
}

// ── Enable (re-activate) ──────────────────────────────────────────────────────

export async function enableTeamLeader(
  userId:    string,
  branchIds: string[]
): Promise<ActionResult<void>> {
  if (!branchIds.length) {
    return { success: false, error: { code: 'VALIDATION', message: 'At least one branch is required to enable a team leader.' } }
  }
  const actor = await requirePermission('manage_system')
  const db    = createServiceClient()

  const { data: tlRole } = await db.from('roles').select('id').eq('name', 'team_leader').single()
  if (!tlRole) return { success: false, error: { code: 'DB_ERROR', message: 'team_leader role not found' } }

  // Re-insert branch role assignments (upsert to be safe)
  await db.from('user_roles').upsert(
    branchIds.map(bid => ({ user_id: userId, role_id: tlRole.id, branch_id: bid })),
    { onConflict: 'user_id,role_id,branch_id', ignoreDuplicates: true }
  )

  // Update metadata status
  const { data: metaRow } = await db.from('users').select('metadata').eq('id', userId).single()
  const meta = (metaRow?.metadata as Record<string, unknown>) ?? {}
  await db.from('users').update({ metadata: { ...meta, tl_status: 'active' } }).eq('id', userId)

  await db.rpc('write_audit_log', {
    p_performed_by: actor.id,
    p_action:       'enable',
    p_entity_type:  'team_leader',
    p_entity_id:    userId,
    p_new_values:   { status: 'active', branch_ids: branchIds },
  })

  revalidatePath('/admin/team-leaders')
  revalidatePath(`/admin/team-leaders/${userId}`)
  return { success: true, data: undefined }
}

// ── Archive ────────────────────────────────────────────────────────────────────

export async function archiveTeamLeader(userId: string): Promise<ActionResult<void>> {
  const actor = await requirePermission('manage_system')
  const db    = createServiceClient()

  const { data: tlRole } = await db.from('roles').select('id').eq('name', 'team_leader').single()
  if (!tlRole) return { success: false, error: { code: 'DB_ERROR', message: 'team_leader role not found' } }

  // Remove role assignments (same as deactivate, but also flag as archived)
  await db.from('user_roles').delete().eq('user_id', userId).eq('role_id', tlRole.id).not('branch_id', 'is', null)

  const { data: metaRow } = await db.from('users').select('metadata').eq('id', userId).single()
  const meta = (metaRow?.metadata as Record<string, unknown>) ?? {}
  await db.from('users').update({
    metadata: { ...meta, tl_status: 'inactive', tl_archived: true, archived_at: new Date().toISOString() }
  }).eq('id', userId)

  await db.rpc('write_audit_log', {
    p_performed_by: actor.id,
    p_action:       'archive',
    p_entity_type:  'team_leader',
    p_entity_id:    userId,
    p_new_values:   { status: 'inactive', archived: true },
  })

  revalidatePath('/admin/team-leaders')
  revalidatePath(`/admin/team-leaders/${userId}`)
  return { success: true, data: undefined }
}

// ── Transfer lead ownership ────────────────────────────────────────────────────

export async function transferTeamLeaderOwnership(
  fromUserId: string,
  toUserId:   string
): Promise<ActionResult<{ transferred: number }>> {
  const actor = await requirePermission('manage_system')
  const db    = createServiceClient()

  // Re-assign all active leads from fromUserId to toUserId
  const { data: leads, error: fetchErr } = await db
    .from('leads')
    .select('id')
    .eq('assigned_to', fromUserId)
    .not('status', 'in', '("CONVERTED","LOST")')

  if (fetchErr) return { success: false, error: { code: 'DB_ERROR', message: fetchErr.message } }
  const leadIds = (leads ?? []).map((l: any) => l.id as string)

  if (leadIds.length > 0) {
    await db.from('leads')
      .update({ assigned_to: toUserId, assigned_at: new Date().toISOString() })
      .in('id', leadIds)

    // Log each transfer in lead_timeline
    const timelineRows = leadIds.map(id => ({
      lead_id:    id,
      event_type: 'reassigned',
      note:       `Ownership transferred by admin`,
      created_by: actor.id,
    }))
    await db.from('lead_timeline').insert(timelineRows)
  }

  await db.rpc('write_audit_log', {
    p_performed_by: actor.id,
    p_action:       'transfer_ownership',
    p_entity_type:  'team_leader',
    p_entity_id:    fromUserId,
    p_new_values:   { to_user_id: toUserId, leads_transferred: leadIds.length },
  })

  revalidatePath('/admin/leads')
  revalidatePath('/admin/team-leaders')
  return { success: true, data: { transferred: leadIds.length } }
}

// ── True Delete ───────────────────────────────────────────────────────────────
// Permanently removes the TL role. Auth user and public.users record are kept
// (they may have other roles or personal data). Leads are optionally reassigned.
//
// Safe: students, groups, certs, and any other records are NOT touched — they
// are owned by branches, not team leaders. Only the user_roles rows and metadata
// are cleaned up. Leads assigned_to this user are unassigned (set to null) if no
// transfer target is provided.

export async function deleteTeamLeader(
  userId:         string,
  reassignToUserId?: string
): Promise<ActionResult<void>> {
  const actor = await requirePermission('manage_system')
  const db    = createServiceClient()

  const { data: tlRole } = await db.from('roles').select('id').eq('name', 'team_leader').single()
  if (!tlRole) {
    return { success: false, error: { code: 'DB_ERROR', message: 'team_leader role not found' } }
  }

  // 1. Unassign or reassign all active leads
  const { data: activeLeads } = await db
    .from('leads').select('id').eq('assigned_to', userId).not('status', 'in', '("CONVERTED","LOST")')

  const leadIds = (activeLeads ?? []).map((l: any) => l.id as string)

  if (leadIds.length > 0) {
    if (reassignToUserId) {
      await db.from('leads')
        .update({ assigned_to: reassignToUserId, assigned_at: new Date().toISOString() })
        .in('id', leadIds)
      // Log transfer in timeline
      await db.from('lead_timeline').insert(
        leadIds.map(id => ({
          lead_id:    id,
          event_type: 'reassigned',
          note:       `Leads reassigned during team leader deletion`,
          created_by: actor.id,
        }))
      )
    } else {
      // Unassign — leave leads in pipeline without owner
      await db.from('leads').update({ assigned_to: null, assigned_at: null }).in('id', leadIds)
      await db.from('lead_timeline').insert(
        leadIds.map(id => ({
          lead_id:    id,
          event_type: 'unassigned',
          note:       `Team leader deleted — lead left unassigned`,
          created_by: actor.id,
        }))
      )
    }
  }

  // 2. Remove ALL user_roles for this user (not just TL)
  await db.from('user_roles').delete().eq('user_id', userId).eq('role_id', tlRole.id)

  // 3. Clear TL-specific metadata so they don't reappear in TL queries
  const { data: metaRow } = await db.from('users').select('metadata').eq('id', userId).single()
  const meta = (metaRow?.metadata as Record<string, unknown>) ?? {}
  // Remove all tl_* metadata keys to prevent resurrection
  const cleanMeta = Object.fromEntries(
    Object.entries(meta).filter(([k]) => !k.startsWith('tl_'))
  )
  await db.from('users').update({ metadata: cleanMeta }).eq('id', userId)

  // 4. Remove user-level permissions saved for this TL
  await db.from('user_permissions').delete().eq('user_id', userId)

  await db.rpc('write_audit_log', {
    p_performed_by:  actor.id,
    p_action:        'delete',
    p_entity_type:   'team_leader',
    p_entity_id:     userId,
    p_new_values:    {
      leads_reassigned: reassignToUserId ? leadIds.length : 0,
      leads_unassigned: reassignToUserId ? 0 : leadIds.length,
      reassigned_to: reassignToUserId ?? null,
    },
  })

  revalidatePath('/admin/team-leaders')
  revalidatePath('/admin/leads')
  return { success: true, data: undefined }
}

// ── Deactivate ────────────────────────────────────────────────────────────────

export async function deactivateTeamLeader(userId: string): Promise<ActionResult<void>> {
  const user = await requirePermission('manage_system')
  const db   = createServiceClient()

  const { data: tlRole } = await db.from('roles').select('id').eq('name', 'team_leader').single()
  if (!tlRole) {
    return { success: false, error: { code: 'DB_ERROR', message: 'team_leader role not found' } }
  }

  // Remove ALL branch role assignments (revokes portal access immediately)
  await db.from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role_id', tlRole.id)
    .not('branch_id', 'is', null)

  const { data: metaRow } = await db.from('users').select('metadata').eq('id', userId).single()
  const currentMeta = (metaRow?.metadata as Record<string, unknown>) ?? {}
  await db.from('users').update({
    metadata: { ...currentMeta, tl_status: 'inactive' },
  }).eq('id', userId)

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'deactivate',
    p_entity_type:  'team_leader',
    p_entity_id:    userId,
    p_new_values:   { status: 'inactive' },
  })

  revalidatePath('/admin/team-leaders')
  revalidatePath(`/admin/team-leaders/${userId}`)
  return { success: true, data: undefined }
}
