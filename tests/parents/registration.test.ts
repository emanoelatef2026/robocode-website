import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockDb } from '../helpers/mock-db'
import { loadRegistrationContacts, prepareRegistrationContacts, saveRegistrationContacts, searchRegistrationContacts } from '@/modules/parents/registration'
import type { PreparedContact } from '@/modules/parents/registration'
import type { createServiceClient } from '@/lib/supabase/service'
import type { AppUser } from '@/types/app'

vi.mock('@/lib/generate-login-email', () => ({ generateUniqueLoginEmail: vi.fn(async () => 'test.parent@example.com'), makeEmailLocalPartExists: vi.fn() }))
const actor = { id: 'staff-test', globalRole: 'team_leader', branchIds: ['branch-a'], permissions: ['manage_students'], email: 'test@example.com' } as AppUser
const contactId = '00000000-0000-4000-8000-000000000011'
const input = { name: 'Test Guardian', phone1: '01000000001', is_primary: true, relation: 'father' }
const source = {
  ...input, id: contactId, student_id: 'older-child', parent_group_id: 'family-test', phone2: '',
  whatsapp_preferred: true, is_emergency: true,
  students: { branch_id: 'branch-a', users: { profiles: { first_name: 'Older', last_name: 'Child' } } },
}
type Db = ReturnType<typeof createServiceClient>
const asDb = (db: ReturnType<typeof createMockDb>) => db as unknown as Db
beforeEach(() => vi.clearAllMocks())

describe('guardian identity selection', () => {
  it('searches formatted international and Arabic phone digits and returns one identity for siblings', () => {
    const rows = [source, { ...source, id: 'contact-2', student_id: 'other-child', students: { branch_id: 'branch-a', users: { profiles: { first_name: 'Other', last_name: 'Child' } } } }]
    const results = searchRegistrationContacts(rows as unknown as Awaited<ReturnType<typeof loadRegistrationContacts>>, '+٢٠ ١٠٠٠٠٠٠٠٠١')
    expect(results).toHaveLength(1)
    expect(results[0].children).toEqual(['Older Child', 'Other Child'])
    expect(searchRegistrationContacts(rows as unknown as Awaited<ReturnType<typeof loadRegistrationContacts>>, 'test gua')).toHaveLength(1)
  })
  it('enforces branch scope before reading contacts and does not search without branches', async () => {
    const db = createMockDb({})
    expect(await loadRegistrationContacts(asDb(db), { ...actor, branchIds: [] })).toEqual([])
    expect(db.from).not.toHaveBeenCalled()
    const inScope = vi.fn(), chain = { select: () => chain, eq: () => chain, is: () => chain, order: () => chain, range: () => chain, in: inScope.mockImplementation(() => chain), then: (fn: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(fn) }
    await loadRegistrationContacts({ from: () => chain } as unknown as Db, actor)
    expect(inScope).toHaveBeenCalledWith('students.branch_id', ['branch-a'])
  })
  it('uses the selected canonical contact, not a client typo or forged parent ID', async () => {
    const db = createMockDb({
      student_parent_contacts: [{ data: [source], error: null }],
      parent_students: [{ data: [], error: null }, { data: [{ parents: { id: 'existing-parent', deleted_at: null, users: { phone: '+20 1000000001' } } }], error: null }],
    })
    const [prepared] = await prepareRegistrationContacts(asDb(db), actor, JSON.stringify([{ ...input, name: 'Forged name', phone1: '01000000002', source_contact_id: contactId, resolved_parent_id: 'forged-id' }]))
    expect(prepared).toMatchObject({ name: 'Test Guardian', phone1: '01000000001', groupId: 'family-test', parentId: 'existing-parent' })
  })
  it('rejects an unavailable/out-of-branch selected contact', async () => {
    const db = createMockDb({})
    await expect(prepareRegistrationContacts(asDb(db), actor, JSON.stringify([{ ...input, source_contact_id: contactId }]))).rejects.toThrow(/outside your branches/)
  })
  it('also finds older portal parents who do not yet have a CRM contact', async () => {
    const db = createMockDb({ parent_students: [{ data: [{
      student_id: 'older-child', students: source.students,
      parents: { id: contactId, users: { phone: '01000000001', profiles: { first_name: 'Test', last_name: 'Guardian' } } },
    }], error: null }] })
    const rows = await loadRegistrationContacts(asDb(db), actor)
    expect(searchRegistrationContacts(rows, '01000000001')).toMatchObject([{ contactId, name: 'Test Guardian', children: ['Older Child'] }])
  })
  it('blocks a name typo with the same phone until staff chooses the existing identity', async () => {
    const db = createMockDb({ student_parent_contacts: [{ data: [source], error: null }] })
    await expect(prepareRegistrationContacts(asDb(db), actor, JSON.stringify([{ ...input, name: 'Test Gardian' }]))).rejects.toThrow(/Select them from search/)
  })
  it('does not silently combine different named guardians sharing a legacy phone-based group', async () => {
    const other = { ...source, id: 'other-contact', student_id: 'other-child', name: 'Different Guardian' }
    const db = createMockDb({ student_parent_contacts: [{ data: [source, other], error: null }] })
    const [prepared] = await prepareRegistrationContacts(asDb(db), actor, JSON.stringify([{ ...input, source_contact_id: contactId }]))
    expect(prepared.siblingIds).toEqual(['older-child'])
    const results = searchRegistrationContacts([source, other] as unknown as Awaited<ReturnType<typeof loadRegistrationContacts>>, '01000000001')
    expect(results).toHaveLength(2)
    expect(results.map(row => row.name)).toEqual(['Test Guardian', 'Different Guardian'])
  })
  it('allows a separate person to share the phone only after explicit confirmation', async () => {
    const db = createMockDb({ student_parent_contacts: [{ data: [source], error: null }] })
    const [prepared] = await prepareRegistrationContacts(asDb(db), actor, JSON.stringify([{ ...input, name: 'Different Guardian', force_new_parent: true }]))
    expect(prepared.groupId).not.toBe('family-test')
    expect(prepared.parentId).toBeNull()
  })
  it('fails closed on lookup errors rather than creating another family', async () => {
    const db = createMockDb({ student_parent_contacts: [{ data: null, error: { message: 'offline' } }] })
    await expect(prepareRegistrationContacts(asDb(db), actor, JSON.stringify([input]))).rejects.toThrow(/Could not load/)
  })
})

describe('passwordless guardian registration', () => {
  const prepared = { ...input, relation: 'father', phone2: '', is_primary: true, is_emergency: true, whatsapp_preferred: true, force_new_parent: false, groupId: 'family-test', parentId: 'existing-parent', siblingIds: ['older-child'] } as PreparedContact
  it('links a sibling to the existing account without changing names, email or passwords', async () => {
    const db = createMockDb({})
    const createUser = vi.fn(), updateUserById = vi.fn()
    const links = vi.fn().mockResolvedValue({ error: null })
    const from = db.from
    db.from = vi.fn(table => table === 'parent_students' ? { upsert: links } : from(table))
    await saveRegistrationContacts({ ...db, auth: { admin: { createUser, updateUserById } } } as unknown as Db, 'new-child', 'branch-a', [prepared])
    expect(createUser).not.toHaveBeenCalled()
    expect(updateUserById).not.toHaveBeenCalled()
    expect(links).toHaveBeenCalledWith([
      { parent_id: 'existing-parent', student_id: 'new-child', relationship: 'father', is_primary: true },
      { parent_id: 'existing-parent', student_id: 'older-child', relationship: 'father', is_primary: true },
    ], { onConflict: 'parent_id,student_id', ignoreDuplicates: true })
  })
  it('prepares a new parent account with no password, ready for group credential generation', async () => {
    const db = createMockDb({ parents: [{ data: { id: 'new-parent' }, error: null }], roles: [{ data: { id: 'parent-role' }, error: null }] })
    const createUser = vi.fn(async () => ({ data: { user: { id: 'new-user' } }, error: null }))
    await saveRegistrationContacts({ ...db, auth: { admin: { createUser } } } as unknown as Db, 'new-child', 'branch-a', [{ ...prepared, parentId: null, siblingIds: [] }])
    expect(createUser).toHaveBeenCalledExactlyOnceWith({ email: 'test.parent@example.com', email_confirm: true })
  })
})
