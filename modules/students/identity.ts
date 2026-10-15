import 'server-only'
import type { createServiceClient } from '@/lib/supabase/service'

type Db = ReturnType<typeof createServiceClient>
export const DUPLICATE_STUDENT_MESSAGE = 'A student with this full name and phone number already exists. Search for the existing student instead of registering them again.'

export function normalizeStudentName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}
export function normalizeStudentPhone(value: string): string {
  let digits = value.replace(/[٠-٩۰-۹]/g, digit => {
    const code = digit.charCodeAt(0)
    return String(code >= 0x6f0 ? code - 0x6f0 : code - 0x660)
  }).replace(/\D/g, '')
  if (digits.startsWith('0020')) digits = `0${digits.slice(4)}`
  else if (digits.length === 12 && digits.startsWith('20')) digits = `0${digits.slice(2)}`
  else if (digits.length === 10 && digits.startsWith('1')) digits = `0${digits}`
  return digits
}

// Fail closed on a lookup outage; never create an auth account first.
export async function checkStudentIdentity(db: Db, first: string, last: string, phone?: string): Promise<string | null> {
  const normalizedPhone = normalizeStudentPhone(phone ?? '')
  if (normalizedPhone.length < 7) return null
  const { data, error } = await db.rpc('find_student_identity', {
    p_name: normalizeStudentName(`${first} ${last}`), p_phone: normalizedPhone,
  })
  if (error) return 'Could not check whether this student is already registered. Please try again.'
  return Array.isArray(data) && data.length > 0 ? DUPLICATE_STUDENT_MESSAGE : null
}

// Only called for the just-created auth user if the student INSERT failed.
export async function discardUnregisteredStudentLogin(db: Db, authUserId: string): Promise<void> {
  try {
    const { error } = await db.auth.admin.deleteUser(authUserId)
    if (error) console.error('Could not clean up unregistered student login', error.message)
  } catch { console.error('Could not clean up unregistered student login') }
}
