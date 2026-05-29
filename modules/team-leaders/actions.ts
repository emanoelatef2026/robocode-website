'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { createTeamLeaderSchema, updateTeamLeaderSchema } from './schemas'
import type { ActionResult } from '@/types/app'

// ── Create ────────────────────────────────────────────────────────────────────

export async function createTeamLeader(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const raw = {
    email:               formData.get('email'),
    password:            formData.get('password'),
    first_name:          formData.get('first_name'),
    last_name:           formData.get('last_name'),
    branch_id:           formData.get('branch_id'),
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

  await requirePermission('manage_system')
  const db = createServiceClient()

  const { email, password, first_name, last_name, branch_id, status, phone, payment_link, wallet_number, bank_account_number } = parsed.data

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

  // 2. Ensure public.users row (with phone)
  await db.from('users').upsert({ id: authUserId, email, phone: phone || null }, { onConflict: 'id' })

  // 3. Upsert profile
  const { data: existingProfile } = await db
    .from('profiles')
    .select('id')
    .eq('user_id', authUserId)
    .maybeSingle()

  if (!existingProfile) {
    await db.from('profiles').insert({ user_id: authUserId, first_name, last_name })
  } else {
    await db.from('profiles').update({ first_name, last_name }).eq('user_id', authUserId)
  }

  // 4. Look up the team_leader role id
  const { data: tlRole, error: roleError } = await db
    .from('roles')
    .select('id')
    .eq('name', 'team_leader')
    .single()

  if (roleError || !tlRole) {
    return { success: false, error: { code: 'DB_ERROR', message: 'team_leader role not found in database' } }
  }

  // 5. Assign team_leader role if status = active
  if (status === 'active') {
    const { error: urError } = await db.from('user_roles').upsert(
      { user_id: authUserId, role_id: tlRole.id, branch_id },
      { onConflict: 'user_id,role_id,branch_id', ignoreDuplicates: true }
    )
    if (urError) {
      return { success: false, error: { code: 'DB_ERROR', message: urError.message } }
    }
  }

  // 6. Store status + branch + financial info in metadata
  await db.from('users').update({
    metadata: {
      tl_status:           status,
      tl_branch_id:        branch_id,
      payment_link:        payment_link        || null,
      wallet_number:       wallet_number       || null,
      bank_account_number: bank_account_number || null,
    },
  }).eq('id', authUserId)

  const { data: actor } = await db.from('users').select('id').eq('id', authUserId).single()
  const performedBy = (await requirePermission('manage_system')).id

  await db.rpc('write_audit_log', {
    p_performed_by: performedBy,
    p_action:       'create',
    p_entity_type:  'team_leader',
    p_entity_id:    authUserId,
    p_new_values:   { email, first_name, last_name, branch_id, status },
    p_branch_id:    branch_id,
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

  const raw = {
    user_id:             formData.get('user_id'),
    first_name:          formData.get('first_name')          || undefined,
    last_name:           formData.get('last_name')           || undefined,
    branch_id:           formData.get('branch_id')           || undefined,
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

  const { user_id, first_name, last_name, branch_id, status, new_password, phone, payment_link, wallet_number, bank_account_number } = parsed.data

  // 1. Update profile
  if (first_name || last_name) {
    const updates: Record<string, string> = {}
    if (first_name) updates.first_name = first_name
    if (last_name)  updates.last_name  = last_name
    await db.from('profiles').update(updates).eq('user_id', user_id)
  }

  // 1b. Update phone on users table
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

  // 3. Fetch current state
  const { data: tlRole } = await db.from('roles').select('id').eq('name', 'team_leader').single()
  if (!tlRole) {
    return { success: false, error: { code: 'DB_ERROR', message: 'team_leader role not found' } }
  }

  const { data: metaRow } = await db.from('users').select('metadata').eq('id', user_id).single()
  const currentMeta = (metaRow?.metadata as Record<string, unknown>) ?? {}
  const currentBranchId = (currentMeta.tl_branch_id as string) ?? null

  const targetBranchId = branch_id ?? currentBranchId
  const targetStatus   = status ?? (currentMeta.tl_status as string) ?? 'active'

  // 4. Handle branch change: remove old role entry, add new one
  if (branch_id && branch_id !== currentBranchId) {
    if (currentBranchId) {
      await db.from('user_roles')
        .delete()
        .eq('user_id', user_id)
        .eq('role_id', tlRole.id)
        .eq('branch_id', currentBranchId)
    }
    if (targetStatus === 'active') {
      await db.from('user_roles').upsert(
        { user_id, role_id: tlRole.id, branch_id },
        { onConflict: 'user_id,role_id,branch_id', ignoreDuplicates: true }
      )
    }
  }

  // 5. Handle status change
  if (status) {
    if (status === 'active' && targetBranchId) {
      // Reactivate: restore role entry
      await db.from('user_roles').upsert(
        { user_id, role_id: tlRole.id, branch_id: targetBranchId },
        { onConflict: 'user_id,role_id,branch_id', ignoreDuplicates: true }
      )
    } else if (status === 'inactive' && targetBranchId) {
      // Deactivate: remove role entry (revokes access)
      await db.from('user_roles')
        .delete()
        .eq('user_id', user_id)
        .eq('role_id', tlRole.id)
        .eq('branch_id', targetBranchId)
    }
  }

  // 6. Update metadata (status + financial info)
  const updatedMeta: Record<string, unknown> = {
    ...currentMeta,
    tl_status:    targetStatus,
    tl_branch_id: targetBranchId ?? currentBranchId,
  }
  if (payment_link        !== undefined) updatedMeta.payment_link        = payment_link        || null
  if (wallet_number       !== undefined) updatedMeta.wallet_number       = wallet_number       || null
  if (bank_account_number !== undefined) updatedMeta.bank_account_number = bank_account_number || null
  await db.from('users').update({ metadata: updatedMeta }).eq('id', user_id)

  await db.rpc('write_audit_log', {
    p_performed_by: user.id,
    p_action:       'update',
    p_entity_type:  'team_leader',
    p_entity_id:    user_id,
    p_new_values:   { first_name, last_name, branch_id, status, password_reset: !!new_password },
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

  // Fetch current branch from user_roles
  const { data: urRow } = await db
    .from('user_roles')
    .select('branch_id')
    .eq('user_id', userId)
    .eq('role_id', tlRole.id)
    .not('branch_id', 'is', null)
    .maybeSingle()

  // Remove the role assignment (revokes portal access immediately)
  if (urRow) {
    await db.from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', tlRole.id)
      .not('branch_id', 'is', null)
  }

  // Store deactivation state + remember branch for reinstatement
  const { data: metaRow } = await db.from('users').select('metadata').eq('id', userId).single()
  const currentMeta = (metaRow?.metadata as Record<string, unknown>) ?? {}
  await db.from('users').update({
    metadata: {
      ...currentMeta,
      tl_status:    'inactive',
      tl_branch_id: urRow?.branch_id ?? currentMeta.tl_branch_id ?? null,
    },
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
