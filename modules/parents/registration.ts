import 'server-only'
import { z } from 'zod'
import type { createServiceClient } from '@/lib/supabase/service'
import type { AppUser } from '@/types/app'
import { normalizeStudentName, normalizeStudentPhone } from '@/modules/students/identity'
import { generateUniqueLoginEmail, makeEmailLocalPartExists } from '@/lib/generate-login-email'

type Db = ReturnType<typeof createServiceClient>
export const registrationContactSchema = z.object({
  name: z.string().trim().min(1, 'Guardian name required').max(200),
  relation: z.enum(['father', 'mother', 'guardian', 'other']).default('guardian'),
  phone1: z.string().min(7, 'Phone 1 required').max(30),
  phone2: z.string().max(30).optional().default(''),
  whatsapp_preferred: z.boolean().default(false),
  is_primary: z.boolean().default(false),
  is_emergency: z.boolean().default(true),
  source_contact_id: z.string().uuid().optional().or(z.literal('')),
  force_new_parent: z.boolean().default(false),
})
export type RegistrationContact = z.infer<typeof registrationContactSchema>

interface ContactRow extends RegistrationContact {
  id: string
  student_id: string
  parent_group_id: string
  students: { branch_id: string; users: { profiles: { first_name: string; last_name: string } | null } | null }
}
export interface ParentSearchResult {
  contactId: string
  groupId: string
  name: string
  phone1: string
  phone2: string
  relation: RegistrationContact['relation']
  whatsappPreferred: boolean
  children: string[]
}
export interface PreparedContact extends RegistrationContact {
  groupId: string
  parentId: string | null
  siblingIds: string[]
}

// Scope before reading/searching PII; never accept branch IDs from the client.
export async function loadRegistrationContacts(db: Db, user: AppUser): Promise<ContactRow[]> {
  if (user.globalRole !== 'super_admin' && !user.branchIds?.length) return []
  const rows: ContactRow[] = []
  for (let offset = 0; ; offset += 500) {
    let query = db.from('student_parent_contacts').select(`
      id, student_id, parent_group_id, name, relation, phone1, phone2,
      whatsapp_preferred, is_primary, is_emergency,
      students!inner(branch_id, users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name)))
    `).eq('status', 'active').is('students.deleted_at', null).order('id').range(offset, offset + 499)
    if (user.globalRole !== 'super_admin') query = query.in('students.branch_id', user.branchIds)
    const { data, error } = await query
    if (error) throw new Error('Could not load existing guardians. Please try again.')
    const batch = (data ?? []) as unknown as ContactRow[]
    rows.push(...batch)
    if (batch.length < 500) break
  }
  // Older lead conversions created portal parents without CRM contacts. They
  // must also be searchable, but only through children in the caller's scope.
  type PortalLink = { student_id: string; students: ContactRow['students']; parents: {
    id: string; users: { phone: string | null; profiles: { first_name: string; last_name: string } | null } | null
  } | null }
  const portalLinks: PortalLink[] = []
  for (let offset = 0; ; offset += 500) {
    let query = db.from('parent_students').select(`
      student_id, students!inner(branch_id, users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))),
      parents!inner(id, users!parents_user_id_fkey(phone, profiles!profiles_user_id_fkey(first_name, last_name)))
    `).is('students.deleted_at', null).is('parents.deleted_at', null).order('id').range(offset, offset + 499)
    if (user.globalRole !== 'super_admin') query = query.in('students.branch_id', user.branchIds)
    const { data, error } = await query
    if (error) throw new Error('Could not load existing guardian accounts. Please try again.')
    const batch = (data ?? []) as unknown as PortalLink[]
    portalLinks.push(...batch)
    if (batch.length < 500) break
  }
  const represented = new Map<string, ContactRow>()
  for (const link of portalLinks) {
    const phone = normalizeStudentPhone(link.parents?.users?.phone ?? '')
    const contacts = phone ? rows.filter(row => row.student_id === link.student_id
      && [row.phone1, row.phone2].some(value => normalizeStudentPhone(value ?? '') === phone)) : []
    const profile = link.parents?.users?.profiles
    const parentName = normalizeStudentName([profile?.first_name, profile?.last_name].filter(Boolean).join(' '))
    const contact = contacts.length === 1 ? contacts[0] : contacts.find(row => normalizeStudentName(row.name) === parentName)
    if (link.parents && contact) represented.set(link.parents.id, contact)
  }
  for (const link of portalLinks) {
    const parent = link.parents
    if (!parent?.users?.phone) continue
    const canonical = represented.get(parent.id)
    if (canonical && rows.some(row => row.parent_group_id === canonical.parent_group_id && row.student_id === link.student_id)) continue
    const profile = parent.users.profiles
    const name = canonical?.name ?? [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
    if (!name) continue
    rows.push({
      id: canonical?.id ?? parent.id, student_id: link.student_id, parent_group_id: canonical?.parent_group_id ?? parent.id,
      name, phone1: canonical?.phone1 ?? parent.users.phone, phone2: canonical?.phone2 ?? '',
      relation: canonical?.relation ?? 'guardian', is_primary: true, is_emergency: true,
      whatsapp_preferred: canonical?.whatsapp_preferred ?? false, force_new_parent: false, students: link.students,
    })
  }
  return rows
}

export function searchRegistrationContacts(rows: ContactRow[], query: string): ParentSearchResult[] {
  const nameQuery = normalizeStudentName(query)
  const phoneQuery = normalizeStudentPhone(query)
  if (nameQuery.length < 2) return []
  const groups = new Map<string, ContactRow[]>()
  for (const row of rows) {
    const key = `${row.parent_group_id}:${normalizeStudentName(row.name)}:${normalizeStudentPhone(row.phone1 ?? '')}`
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }
  return [...groups.values()].filter(group => group.some(row =>
    normalizeStudentName(row.name).includes(nameQuery)
    || (phoneQuery.length >= 4 && [row.phone1, row.phone2].some(phone =>
      normalizeStudentPhone(phone ?? '').includes(phoneQuery))),
  )).slice(0, 15).map(group => {
    const row = group[0]
    return {
      contactId: row.id, groupId: row.parent_group_id, name: row.name,
      phone1: row.phone1 ?? '', phone2: row.phone2 ?? '', relation: row.relation,
      whatsappPreferred: row.whatsapp_preferred,
      children: [...new Set(group.map(c => {
        const profile = c.students?.users?.profiles
        return [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
      }).filter(Boolean))],
    }
  })
}

export async function prepareRegistrationContacts(db: Db, user: AppUser, raw: string): Promise<PreparedContact[]> {
  let input: unknown
  try { input = JSON.parse(raw) } catch { throw new Error('Invalid contacts data') }
  const parsed = z.array(registrationContactSchema).min(1, 'At least one contact is required').max(10).safeParse(input)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)
  const rows = await loadRegistrationContacts(db, user)
  const result: PreparedContact[] = []
  for (const contact of parsed.data) {
    let source = contact.source_contact_id ? rows.find(row => row.id === contact.source_contact_id) : undefined
    if (contact.source_contact_id && !source) throw new Error('Selected guardian is unavailable or outside your branches. Search again.')
    if (!source && !contact.force_new_parent) {
      const phone = normalizeStudentPhone(contact.phone1)
      const phoneMatches = rows.filter(row => [row.phone1, row.phone2].some(value => normalizeStudentPhone(value ?? '') === phone))
      const exact = phoneMatches.filter(row => normalizeStudentName(row.name) === normalizeStudentName(contact.name))
      const identities = new Set(exact.map(row => row.parent_group_id))
      if (identities.size === 1) source = exact[0]
      else if (phoneMatches.length) throw new Error('A guardian with this phone already exists. Select them from search, or confirm this is a separate guardian.')
    }
    // Re-read canonical data server-side. Selecting a guardian never renames
    // their shared identity or resets their existing account/password.
    const canonical = source ? {
      ...contact, name: source.name, phone1: source.phone1 ?? '', phone2: source.phone2 ?? '',
      whatsapp_preferred: source.whatsapp_preferred,
    } : contact
    // Legacy CRM grouping sometimes used only a shared phone. Do not give a
    // newly provisioned parent access to another named guardian's children.
    const siblingIds = source ? [...new Set(rows.filter(row => row.parent_group_id === source.parent_group_id
      && normalizeStudentName(row.name) === normalizeStudentName(source.name)).map(row => row.student_id))] : []
    let parentId: string | null = null
    if (siblingIds.length) {
      const { data, error } = await db.from('parent_students')
        .select('parents!inner(id, deleted_at, users!parents_user_id_fkey(phone))').in('student_id', siblingIds)
      if (error) throw new Error('Could not verify guardian account. Please try again.')
      const phones = [canonical.phone1, canonical.phone2].map(normalizeStudentPhone).filter(Boolean)
      const matches = (data ?? []) as unknown as { parents: { id: string; deleted_at: string | null; users: { phone: string | null } | null } | null }[]
      const ids = [...new Set(matches.filter(link => link.parents && !link.parents.deleted_at
        && phones.includes(normalizeStudentPhone(link.parents.users?.phone ?? ''))).map(link => link.parents!.id))]
      if (ids.length > 1) throw new Error('This guardian has multiple portal accounts. Please review the parent records before linking.')
      parentId = ids[0] ?? null
    }
    result.push({ ...canonical, groupId: source?.parent_group_id ?? crypto.randomUUID(), parentId, siblingIds })
  }
  if (new Set(result.map(c => c.groupId)).size !== result.length) throw new Error('The same guardian was selected more than once.')
  return result
}

export async function saveRegistrationContacts(db: Db, studentId: string, branchId: string, contacts: PreparedContact[]): Promise<void> {
  const { error: deleteError } = await db.from('student_parent_contacts').delete().eq('student_id', studentId)
  if (deleteError) throw new Error('Could not save guardian contacts.')
  const { error: contactError } = await db.from('student_parent_contacts').insert(contacts.map(c => ({
    student_id: studentId, parent_group_id: c.groupId, name: c.name, relation: c.relation,
    phone1: c.phone1, phone2: c.phone2 || null, whatsapp_preferred: c.whatsapp_preferred,
    is_primary: c.is_primary, is_emergency: c.is_emergency, status: 'active',
  })))
  if (contactError) throw new Error('Could not save guardian contacts.')
  for (const contact of contacts) {
    let parentId = contact.parentId
    if (!parentId) {
      const parts = contact.name.trim().split(/\s+/)
      const email = await generateUniqueLoginEmail('learner', parts[0], parts.slice(1).join(' ') || parts[0], makeEmailLocalPartExists(db))
      // Deliberately no password: Generate Credentials in the group activates access.
      const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true })
      if (error || !data.user) throw new Error('Could not prepare guardian account. Please try again.')
      const userId = data.user.id
      try {
        const { error: userError } = await db.from('users').upsert({ id: userId, email, phone: contact.phone1 }, { onConflict: 'id' })
        if (userError) throw userError
        const { error: profileError } = await db.from('profiles').upsert({ user_id: userId, first_name: parts[0], last_name: parts.slice(1).join(' ') || parts[0] }, { onConflict: 'user_id' })
        if (profileError) throw profileError
        const { data: parent, error: parentError } = await db.from('parents').insert({ user_id: userId }).select('id').single()
        if (parentError || !parent) throw new Error('Could not prepare guardian record.')
        parentId = parent.id
        const { data: role, error: roleError } = await db.from('roles').select('id').eq('name', 'parent').single()
        if (roleError || !role) throw new Error('Parent role unavailable.')
        const { error: grantError } = await db.from('user_roles').upsert({ user_id: userId, role_id: role.id, branch_id: branchId }, { onConflict: 'user_id,role_id,branch_id', ignoreDuplicates: true })
        if (grantError) throw grantError
      } catch {
        await db.auth.admin.deleteUser(userId)
        throw new Error('Could not prepare guardian account. Please try again.')
      }
    }
    const { error } = await db.from('parent_students').upsert(
      [...new Set([studentId, ...contact.siblingIds])].map(id => ({
        parent_id: parentId, student_id: id, relationship: contact.relation, is_primary: contact.is_primary,
      })), { onConflict: 'parent_id,student_id', ignoreDuplicates: true },
    )
    if (error) throw new Error('Could not link guardian to student.')
  }
}
