'use server'

import { revalidatePath }       from 'next/cache'
import { createServiceClient }  from '@/lib/supabase/service'
import { requirePortalRole }    from '@/modules/rbac/guards'
import {
  createLeadSchema,
  updateLeadSchema,
  updateStatusSchema,
  updateFollowUpSchema,
  reassignLeadSchema,
  convertToStudentSchema,
  assignToGroupSchema,
} from './schemas'
import type { ActionResult } from '@/types/app'

// ── Create Lead ───────────────────────────────────────────────────────────────

export async function createLead(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePortalRole('team_leader')
  const db   = createServiceClient()
  const now  = new Date().toISOString()

  const raw = {
    child_name:        formData.get('child_name'),
    parent_name:       formData.get('parent_name')       || undefined,
    phone:             formData.get('phone')             || undefined,
    whatsapp:          formData.get('whatsapp')          || undefined,
    email:             formData.get('email')             || undefined,
    age:               formData.get('age')               || undefined,
    branch_id:         formData.get('branch_id')         || undefined,
    interested_course: formData.get('interested_course') || undefined,
    source:            formData.get('source')            || 'website',
    notes:             formData.get('notes')             || undefined,
    assigned_to:       formData.get('assigned_to')       || undefined,
  }

  const parsed = createLeadSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const d = parsed.data
  const assignedTo = d.assigned_to || null

  const { data: lead, error } = await db
    .from('leads')
    .insert({
      child_name:        d.child_name,
      parent_name:       d.parent_name       || null,
      phone:             d.phone             || null,
      whatsapp:          d.whatsapp          || null,
      email:             d.email             || null,
      age:               typeof d.age === 'number' ? d.age : null,
      branch_id:         d.branch_id         || null,
      interested_course: d.interested_course || null,
      source:            d.source,
      notes:             d.notes             || null,
      status:            'NEW',
      assigned_to:       assignedTo,
      assigned_at:       assignedTo ? now : null,
      stage_entered_at:  now,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  const timelineEntries: any[] = [
    { lead_id: lead.id, event_type: 'CREATED', note: 'Lead created manually', created_by: user.id },
  ]

  if (assignedTo) {
    timelineEntries.push({
      lead_id: lead.id, event_type: 'ASSIGNED',
      note: `Assigned to owner on creation`, created_by: user.id,
    })
    await db.from('lead_assignment_history').insert({
      lead_id: lead.id, from_user_id: null, to_user_id: assignedTo,
      reason: 'Assigned on creation', assigned_by: user.id,
    })
  }

  await db.from('lead_timeline').insert(timelineEntries)

  revalidatePath('/portal/team-leader/leads')
  return { success: true, data: { id: lead.id } }
}

// ── Update Lead ───────────────────────────────────────────────────────────────

export async function updateLead(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  await requirePortalRole('team_leader')
  const db = createServiceClient()

  const raw = {
    id:                formData.get('id'),
    child_name:        formData.get('child_name')        || undefined,
    parent_name:       formData.get('parent_name')       || undefined,
    phone:             formData.get('phone')             || undefined,
    whatsapp:          formData.get('whatsapp')          || undefined,
    email:             formData.get('email')             || undefined,
    age:               formData.get('age')               || undefined,
    branch_id:         formData.get('branch_id')         || undefined,
    interested_course: formData.get('interested_course') || undefined,
    source:            formData.get('source')            || undefined,
    notes:             formData.get('notes')             || undefined,
    status:            formData.get('status')            || undefined,
    assigned_to:       formData.get('assigned_to')       || undefined,
    last_contact_at:   formData.get('last_contact_at')   || undefined,
    next_follow_up_at: formData.get('next_follow_up_at') || undefined,
  }

  const parsed = updateLeadSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { id, ...rest } = parsed.data
  const patch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rest)) {
    patch[k] = v === '' ? null : v
  }

  const { error } = await db.from('leads').update(patch).eq('id', id)
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  revalidatePath('/portal/team-leader/leads')
  revalidatePath(`/portal/team-leader/leads/${id}`)
  return { success: true, data: undefined }
}

// ── Update Status ─────────────────────────────────────────────────────────────

export async function updateLeadStatus(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePortalRole('team_leader')
  const db   = createServiceClient()
  const now  = new Date().toISOString()

  const raw = {
    id:          formData.get('id'),
    status:      formData.get('status'),
    note:        formData.get('note')        || undefined,
    lost_reason: formData.get('lost_reason') || undefined,
  }

  const parsed = updateStatusSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { id, status, note, lost_reason } = parsed.data

  const { error } = await db
    .from('leads')
    .update({
      status,
      last_contact_at:  now,
      stage_entered_at: now,
      lost_reason:      status === 'LOST' ? (lost_reason || null) : null,
    })
    .eq('id', id)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  const timelineNote =
    status === 'LOST' && lost_reason
      ? `Lost — ${lost_reason}`
      : note || `Status changed to ${status}`

  await db.from('lead_timeline').insert({
    lead_id: id, event_type: `STATUS_${status}`,
    note: timelineNote, created_by: user.id,
  })

  revalidatePath('/portal/team-leader/leads')
  revalidatePath(`/portal/team-leader/leads/${id}`)
  return { success: true, data: undefined }
}

// ── Update Follow-up ──────────────────────────────────────────────────────────

export async function updateFollowUp(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePortalRole('team_leader')
  const db   = createServiceClient()

  const raw = {
    id:                formData.get('id'),
    next_follow_up_at: formData.get('next_follow_up_at') || undefined,
    last_contact_at:   formData.get('last_contact_at')   || undefined,
    note:              formData.get('note')              || undefined,
  }

  const parsed = updateFollowUpSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { id, next_follow_up_at, last_contact_at, note } = parsed.data
  const patch: Record<string, unknown> = {}
  if (next_follow_up_at) patch.next_follow_up_at = next_follow_up_at
  if (last_contact_at)   patch.last_contact_at   = last_contact_at

  if (Object.keys(patch).length) {
    const { error } = await db.from('leads').update(patch).eq('id', id)
    if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.from('lead_timeline').insert({
    lead_id: id, event_type: 'FOLLOW_UP_UPDATED',
    note: note || 'Follow-up rescheduled', created_by: user.id,
  })

  revalidatePath(`/portal/team-leader/leads/${id}`)
  return { success: true, data: undefined }
}

// ── Add Note ──────────────────────────────────────────────────────────────────

export async function addLeadNote(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePortalRole('team_leader')
  const db   = createServiceClient()

  const id   = formData.get('id') as string
  const note = (formData.get('note') as string | null)?.trim()

  if (!id || !note) {
    return { success: false, error: { code: 'VALIDATION', message: 'Note cannot be empty' } }
  }

  const { error } = await db.from('lead_timeline').insert({
    lead_id: id, event_type: 'NOTE', note, created_by: user.id,
  })
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  await db.from('leads').update({ updated_at: new Date().toISOString() }).eq('id', id)

  revalidatePath(`/portal/team-leader/leads/${id}`)
  return { success: true, data: undefined }
}

// ── Reopen Lead ───────────────────────────────────────────────────────────────

export async function reopenLead(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePortalRole('team_leader')
  const db   = createServiceClient()
  const now  = new Date().toISOString()

  const id = formData.get('id') as string
  if (!id) return { success: false, error: { code: 'VALIDATION', message: 'Missing lead id' } }

  const { error } = await db
    .from('leads')
    .update({ status: 'FOLLOW_UP', lost_reason: null, stage_entered_at: now })
    .eq('id', id)

  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  await db.from('lead_timeline').insert({
    lead_id: id, event_type: 'REOPENED',
    note: 'Lead reopened — moved to Follow Up', created_by: user.id,
  })

  revalidatePath('/portal/team-leader/leads')
  revalidatePath(`/portal/team-leader/leads/${id}`)
  return { success: true, data: undefined }
}

// ── Reassign Lead ─────────────────────────────────────────────────────────────

export async function reassignLead(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePortalRole('team_leader')
  const db   = createServiceClient()
  const now  = new Date().toISOString()

  const raw = {
    id:      formData.get('id'),
    to_user: formData.get('to_user'),
    reason:  formData.get('reason') || undefined,
  }

  const parsed = reassignLeadSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { id, to_user, reason } = parsed.data

  // Get current owner for history
  const { data: current } = await db
    .from('leads').select('assigned_to').eq('id', id).single()
  const from_user_id = (current as any)?.assigned_to ?? null

  // Update lead
  const { error } = await db.from('leads').update({
    assigned_to: to_user, assigned_at: now,
  }).eq('id', id)
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  // Write assignment history
  await db.from('lead_assignment_history').insert({
    lead_id: id, from_user_id, to_user_id: to_user,
    reason: reason || null, assigned_by: user.id,
  })

  // Write timeline
  await db.from('lead_timeline').insert({
    lead_id: id, event_type: 'REASSIGNED',
    note: reason ? `Reassigned — ${reason}` : 'Lead reassigned to new owner',
    created_by: user.id,
  })

  revalidatePath('/portal/team-leader/leads')
  revalidatePath(`/portal/team-leader/leads/${id}`)
  return { success: true, data: undefined }
}

// ── Assign To Me (one-click) ──────────────────────────────────────────────────

export async function assignLeadToMe(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePortalRole('team_leader')
  const db   = createServiceClient()
  const now  = new Date().toISOString()

  const id = formData.get('lead_id') as string
  if (!id) return { success: false, error: { code: 'VALIDATION', message: 'Missing lead id' } }

  const { data: current } = await db
    .from('leads').select('assigned_to').eq('id', id).single()
  const from_user_id = (current as any)?.assigned_to ?? null

  const { error } = await db.from('leads').update({
    assigned_to: user.id, assigned_at: now,
  }).eq('id', id)
  if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }

  await db.from('lead_assignment_history').insert({
    lead_id: id, from_user_id, to_user_id: user.id,
    reason: 'Self-assigned', assigned_by: user.id,
  })

  await db.from('lead_timeline').insert({
    lead_id: id, event_type: 'ASSIGNED',
    note: 'Lead self-assigned', created_by: user.id,
  })

  revalidatePath('/portal/team-leader/leads')
  revalidatePath(`/portal/team-leader/leads/${id}`)
  return { success: true, data: undefined }
}

// ── Convert To Student ────────────────────────────────────────────────────────

export async function convertLeadToStudent(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ student_id: string }>> {
  const user = await requirePortalRole('team_leader')
  const db   = createServiceClient()

  const raw = {
    lead_id:         formData.get('lead_id'),
    email:           formData.get('email'),
    password:        formData.get('password'),
    first_name:      formData.get('first_name'),
    last_name:       formData.get('last_name'),
    branch_id:       formData.get('branch_id'),
    parent_first:    formData.get('parent_first'),
    parent_last:     formData.get('parent_last'),
    parent_email:    formData.get('parent_email'),
    parent_password: formData.get('parent_password'),
    parent_phone:    formData.get('parent_phone') || undefined,
  }

  const parsed = convertToStudentSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const {
    lead_id, email, password, first_name, last_name, branch_id,
    parent_first, parent_last, parent_email, parent_password, parent_phone,
  } = parsed.data

  // 1. Create or find student auth user
  let studentUserId: string
  const { data: existingSU } = await db.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle()
  if (existingSU) {
    studentUserId = existingSU.id
  } else {
    const { data: created, error: ce } = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (ce || !created?.user) {
      return { success: false, error: { code: 'AUTH_ERROR', message: ce?.message ?? 'Failed to create student user' } }
    }
    studentUserId = created.user.id
  }

  await db.from('users').upsert({ id: studentUserId, email }, { onConflict: 'id' })
  await db.from('profiles').upsert({ user_id: studentUserId, first_name, last_name }, { onConflict: 'user_id' })

  // 2. Create student record
  const { data: studentRec, error: studentErr } = await db
    .from('students').insert({ user_id: studentUserId, branch_id, status: 'active' }).select('id').single()
  if (studentErr) return { success: false, error: { code: 'DB_ERROR', message: studentErr.message } }
  const studentId = studentRec.id

  // 3. Assign student role
  const { data: studentRole } = await db.from('roles').select('id').eq('name', 'student').single()
  if (studentRole) {
    await db.from('user_roles').upsert(
      { user_id: studentUserId, role_id: studentRole.id, branch_id },
      { onConflict: 'user_id,role_id,branch_id', ignoreDuplicates: true }
    )
  }

  // 4. Create or find parent auth user
  let parentUserId: string
  const { data: existingPU } = await db.from('users').select('id').eq('email', parent_email.toLowerCase()).maybeSingle()
  if (existingPU) {
    parentUserId = existingPU.id
  } else {
    const { data: pc, error: pe } = await db.auth.admin.createUser({ email: parent_email, password: parent_password, email_confirm: true })
    if (pe || !pc?.user) {
      return { success: false, error: { code: 'AUTH_ERROR', message: pe?.message ?? 'Failed to create parent user' } }
    }
    parentUserId = pc.user.id
  }

  await db.from('users').upsert({ id: parentUserId, email: parent_email, phone: parent_phone || null }, { onConflict: 'id' })
  await db.from('profiles').upsert({ user_id: parentUserId, first_name: parent_first, last_name: parent_last }, { onConflict: 'user_id' })

  // 5. Create parent record
  const { data: parentRec } = await db.from('parents').select('id').eq('user_id', parentUserId).maybeSingle()
  let parentId: string
  if (parentRec) {
    parentId = parentRec.id
  } else {
    const { data: newParent, error: pe2 } = await db.from('parents').insert({ user_id: parentUserId }).select('id').single()
    if (pe2) return { success: false, error: { code: 'DB_ERROR', message: pe2.message } }
    parentId = newParent.id
  }

  await db.from('parent_students').upsert(
    { parent_id: parentId, student_id: studentId, relationship: 'guardian', is_primary: true },
    { onConflict: 'parent_id,student_id', ignoreDuplicates: true }
  )

  const { data: parentRole } = await db.from('roles').select('id').eq('name', 'parent').single()
  if (parentRole) {
    await db.from('user_roles').upsert(
      { user_id: parentUserId, role_id: parentRole.id, branch_id: null },
      { onConflict: 'user_id,role_id,branch_id', ignoreDuplicates: true }
    )
  }

  const now = new Date().toISOString()
  await db.from('leads').update({
    status: 'CONVERTED', converted_student_id: studentId,
    last_contact_at: now, stage_entered_at: now,
  }).eq('id', lead_id)

  await db.from('lead_timeline').insert({
    lead_id, event_type: 'CONVERTED',
    note: `Converted to student — ${first_name} ${last_name}`, created_by: user.id,
  })

  revalidatePath('/portal/team-leader/leads')
  revalidatePath(`/portal/team-leader/leads/${lead_id}`)
  revalidatePath('/portal/team-leader/students')
  return { success: true, data: { student_id: studentId } }
}

// ── Assign To Group ───────────────────────────────────────────────────────────

export async function assignLeadToGroup(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<void>> {
  const user = await requirePortalRole('team_leader')
  const db   = createServiceClient()

  const raw = {
    lead_id:    formData.get('lead_id'),
    student_id: formData.get('student_id'),
    group_id:   formData.get('group_id'),
  }

  const parsed = assignToGroupSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION', message: parsed.error.issues[0].message } }
  }

  const { lead_id, student_id, group_id } = parsed.data

  const { data: existing } = await db
    .from('group_students').select('id')
    .eq('group_id', group_id).eq('student_id', student_id).eq('status', 'active').maybeSingle()

  if (!existing) {
    const { error } = await db.from('group_students').insert({
      group_id, student_id, status: 'active', enrollment_type: 'primary',
    })
    if (error) return { success: false, error: { code: 'DB_ERROR', message: error.message } }
  }

  await db.from('lead_timeline').insert({
    lead_id, event_type: 'ASSIGNED_TO_GROUP',
    note: 'Student assigned to group', created_by: user.id,
  })

  revalidatePath(`/portal/team-leader/leads/${lead_id}`)
  revalidatePath('/portal/team-leader/groups')
  return { success: true, data: undefined }
}

// ── Assign To Me — form-action wrapper (no prev state needed) ────────────────

export async function assignLeadToMeFormAction(formData: FormData): Promise<void> {
  await assignLeadToMe(null, formData)
}

// ── Website Lead (no auth, called from API route) ─────────────────────────────

export async function createWebsiteLead(body: {
  child_name:      string
  parent_name?:    string
  phone?:          string
  whatsapp?:       string
  email?:          string
  age?:            number
  notes?:          string
  preferred_day?:  string
  preferred_time?: string
}): Promise<{ id: string } | null> {
  const db  = createServiceClient()
  const now = new Date().toISOString()

  const notes = [
    body.notes,
    body.preferred_day  ? `Preferred day: ${body.preferred_day}`   : null,
    body.preferred_time ? `Preferred time: ${body.preferred_time}` : null,
  ].filter(Boolean).join('\n')

  const { data, error } = await db
    .from('leads')
    .insert({
      child_name:       body.child_name.trim(),
      parent_name:      body.parent_name?.trim() || null,
      phone:            body.phone?.trim()       || null,
      whatsapp:         body.phone?.trim()       || null,
      email:            body.email?.trim()       || null,
      age:              body.age                 || null,
      source:           'website',
      status:           'NEW',
      notes:            notes || null,
      stage_entered_at: now,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[createWebsiteLead]', error.message)
    return null
  }

  await db.from('lead_timeline').insert({
    lead_id: data.id, event_type: 'CREATED',
    note: 'Lead created from website booking form',
  })

  return { id: data.id }
}
