'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { createTeamLeaderSchema, updateTeamLeaderSchema } from './schemas'
import { saveUserPermissions } from '@/modules/user-permissions/mutations'
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
    email:               formData.get('email'),
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

  const { email, password, first_name, last_name, status, phone, payment_link, wallet_number, bank_account_number } = parsed.data

  // 1. Create or find auth user
  let authUserId: string
  const { data: listData } = await db.auth.admin.listUsers({ perPage: 1000 })
  const existing = listData?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())

  if (existing) {
    authUserId = existing.id
  } else {
    const { data: created, error: createError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createError || !created?.user) {
      return { success: false, error: { code: 'AUTH_ERROR', message: createError?.message ?? 'Failed to create user' } }
    }
    authUserId = created.user.id
  }

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
