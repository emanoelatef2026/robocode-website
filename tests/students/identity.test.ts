import { describe, expect, it, vi } from 'vitest'
import { checkStudentIdentity, discardUnregisteredStudentLogin, normalizeStudentName, normalizeStudentPhone, DUPLICATE_STUDENT_MESSAGE } from '@/modules/students/identity'
import type { createServiceClient } from '@/lib/supabase/service'
type Db = ReturnType<typeof createServiceClient>

describe('student identity protection', () => {
  it.each(['01000000001', '010 0000-0001', '+20 1000000001', '00201000000001', '1000000001', '٠١٠٠٠٠٠٠٠٠١', '۰۱۰۰۰۰۰۰۰۰۱'])('normalizes phone %s identically', phone => {
    expect(normalizeStudentPhone(phone)).toBe('01000000001')
  })
  it('ignores name case and extra whitespace without fuzzy name matching', () => {
    expect(normalizeStudentName('  Test   LEARNER ')).toBe('test learner')
    expect(normalizeStudentName('Test Learner')).not.toBe(normalizeStudentName('Test Learner Hassan'))
  })
  it('blocks the exact identity before a new login is created', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: 'existing-student' }], error: null })
    expect(await checkStudentIdentity({ rpc } as unknown as Db, 'Test', 'LEARNER', '+20 1000000001')).toBe(DUPLICATE_STUDENT_MESSAGE)
    expect(rpc).toHaveBeenCalledWith('find_student_identity', { p_name: 'test learner', p_phone: '01000000001' })
  })
  it('allows different names sharing a family phone', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    expect(await checkStudentIdentity({ rpc } as unknown as Db, 'Another', 'Child', '01000000001')).toBeNull()
  })
  it('does not guess identities from missing/short phone numbers', async () => {
    const rpc = vi.fn()
    expect(await checkStudentIdentity({ rpc } as unknown as Db, 'Test', 'Learner', '')).toBeNull()
    expect(await checkStudentIdentity({ rpc } as unknown as Db, 'Test', 'Learner', '123')).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('fails closed if the duplicate check is unavailable', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'Network failure' } })
    expect(await checkStudentIdentity({ rpc } as unknown as Db, 'Test', 'Learner', '01000000001')).toMatch(/Could not check/)
  })
  it('cleans up only the new login after a concurrent duplicate INSERT is rejected', async () => {
    const deleteUser = vi.fn().mockResolvedValue({ error: null })
    await discardUnregisteredStudentLogin({ auth: { admin: { deleteUser } } } as unknown as Db, 'just-created-user')
    expect(deleteUser).toHaveBeenCalledExactlyOnceWith('just-created-user')
  })
})
