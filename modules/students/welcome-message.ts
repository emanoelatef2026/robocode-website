'use server'

import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import { ROLE_PORTAL_MAP } from '@/types/enums'
import { normalizeEgyptPhone } from '@/lib/contact-utils'
import { getStudentPortalCredentials } from '@/modules/students/portal-credentials'
import { getParentPortalCredentialsForStudent } from '@/modules/parents/portal-credentials'
import { buildWelcomeMessage, canSendWelcomeMessage, type WelcomeMessageEligibility } from '@/modules/messages/welcome'
import type { AppUser } from '@/types/app'

// Welcome messages are a Team Leader / Super Admin action only — instructors are
// hard-blocked regardless of any per-user permission customization, since
// 'manage_students' is a CONFIGURABLE_PERMISSIONS entry an instructor could be
// granted individually.
async function requireWelcomeSenderPermission(): Promise<AppUser> {
  const user = await requirePermission('manage_students')
  if (user.globalRole === 'instructor') {
    redirect(`${ROLE_PORTAL_MAP[user.globalRole]}?error=forbidden`)
  }
  return user
}

interface StudentWelcomeInfo {
  student_name: string
  course_name:  string | null
  parent_phone: string | null
}

async function resolveStudentWelcomeInfo(
  db: ReturnType<typeof createServiceClient>,
  studentId: string,
): Promise<StudentWelcomeInfo | null> {
  const { data: studentRow } = await db
    .from('students')
    .select(`
      users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))
    `)
    .eq('id', studentId)
    .maybeSingle()

  if (!studentRow) return null

  const s = studentRow as any
  const student_name = [s.users?.profiles?.first_name, s.users?.profiles?.last_name].filter(Boolean).join(' ') || '—'

  const { data: gsRow } = await db
    .from('group_students')
    .select('group_id')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  let course_name: string | null = null
  if (gsRow?.group_id) {
    const { data: gcRow } = await db
      .from('group_courses')
      .select('courses(title)')
      .eq('group_id', gsRow.group_id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    course_name = (gcRow as any)?.courses?.title ?? null
  }

  const { data: contactRow } = await db
    .from('student_parent_contacts')
    .select('phone1')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle()

  const parent_phone = (contactRow as any)?.phone1 ?? null

  return { student_name, course_name, parent_phone }
}

// ── Eligibility (for button disabled/tooltip state) ───────────────────────────

export interface WelcomeMessageStatus {
  eligibility: WelcomeMessageEligibility
  lastSentAt:  string | null
}

export async function getWelcomeMessageStatusAction(studentId: string): Promise<WelcomeMessageStatus> {
  await requireWelcomeSenderPermission()
  const db = createServiceClient()

  const [info, studentCreds, parentCreds, lastLog] = await Promise.all([
    resolveStudentWelcomeInfo(db, studentId),
    getStudentPortalCredentials(studentId),
    getParentPortalCredentialsForStudent(studentId),
    db.from('welcome_message_logs')
      .select('sent_at')
      .eq('student_id', studentId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const eligibility = canSendWelcomeMessage({
    parentPhone:     info?.parent_phone ?? null,
    parentEmail:     parentCreds.email,
    parentPassword:  parentCreds.portal_password,
    studentEmail:    studentCreds.email,
    studentPassword: studentCreds.portal_password,
  })

  return {
    eligibility,
    lastSentAt: (lastLog.data as any)?.sent_at ?? null,
  }
}

// ── Send (resolve + build + log + hand back the wa.me URL) ────────────────────

export interface WelcomeMessageSendResult {
  url:     string
  message: string
  phone:   string
}

export async function sendWelcomeWhatsAppAction(
  studentId: string,
): Promise<WelcomeMessageSendResult | { error: string }> {
  const user = await requireWelcomeSenderPermission()
  const db = createServiceClient()

  const info = await resolveStudentWelcomeInfo(db, studentId)
  if (!info) return { error: 'Student not found.' }

  const [studentCreds, parentCreds] = await Promise.all([
    getStudentPortalCredentials(studentId),
    getParentPortalCredentialsForStudent(studentId),
  ])

  const eligibility = canSendWelcomeMessage({
    parentPhone:     info.parent_phone,
    parentEmail:     parentCreds.email,
    parentPassword:  parentCreds.portal_password,
    studentEmail:    studentCreds.email,
    studentPassword: studentCreds.portal_password,
  })

  if (!eligibility.eligible) {
    return { error: eligibility.reason ?? 'Cannot send welcome message.' }
  }

  const normalizedPhone = normalizeEgyptPhone(info.parent_phone)
  if (!normalizedPhone) return { error: 'Parent phone number is missing.' }

  const message = buildWelcomeMessage({
    parent_email:      parentCreds.email!,
    parent_password:   parentCreds.portal_password!,
    student_email:     studentCreds.email!,
    student_password:  studentCreds.portal_password!,
  })

  const url = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`

  await db.from('welcome_message_logs').insert({
    student_id:   studentId,
    parent_phone: normalizedPhone,
    sent_by:      user.id,
    channel:      'whatsapp',
    message_type: 'welcome',
  })

  return { url, message, phone: normalizedPhone }
}

// ── Regenerate missing credentials ────────────────────────────────────────────
// Historical student/parent accounts can have an email but no portal_password
// (set before the password-visibility columns existed, or never assigned one).
// The plaintext password cannot be reverse-derived from auth.users (hashed), so
// the only safe repair is generating a brand-new password for the existing
// account — never fabricating or guessing the original.

export interface RegenerateCredentialsResult {
  studentRegenerated: boolean
  parentRegenerated:  boolean
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function generateMissingWelcomeCredentialsAction(
  studentId: string,
): Promise<{ success: true; data: RegenerateCredentialsResult } | { success: false; error: string }> {
  const user = await requireWelcomeSenderPermission()
  const db = createServiceClient()

  const [studentCreds, parentCreds] = await Promise.all([
    getStudentPortalCredentials(studentId),
    getParentPortalCredentialsForStudent(studentId),
  ])

  let studentRegenerated = false
  let parentRegenerated  = false

  if (studentCreds.status === 'password_missing') {
    const { data: studentRow } = await db.from('students').select('user_id').eq('id', studentId).maybeSingle()
    const userId = (studentRow as any)?.user_id ?? null
    if (userId) {
      const tempPassword = generateTempPassword()
      const { error } = await db.auth.admin.updateUserById(userId, { password: tempPassword })
      if (!error) {
        await db.from('students').update({ portal_password: tempPassword }).eq('id', studentId)
        await db.rpc('write_audit_log', {
          p_performed_by: user.id,
          p_action:       'password_reset',
          p_entity_type:  'student',
          p_entity_id:    studentId,
          p_new_values:   { reset_by: user.id, context: 'welcome_message_regeneration' },
        })
        studentRegenerated = true
      }
    }
  }

  if (parentCreds.status === 'password_missing') {
    const { data: linkRows } = await db
      .from('parent_students')
      .select('parents!parent_students_parent_id_fkey(id, user_id)')
      .eq('student_id', studentId)
      .order('is_primary', { ascending: false })
      .limit(1)

    const link = (linkRows ?? [])[0] as unknown as { parents: { id: string; user_id: string } | null } | undefined
    const parent = link?.parents ?? null

    if (parent?.id && parent.user_id) {
      const tempPassword = generateTempPassword()
      const { error } = await db.auth.admin.updateUserById(parent.user_id, { password: tempPassword })
      if (!error) {
        await db.from('parents').update({ portal_password: tempPassword }).eq('id', parent.id)
        await db.rpc('write_audit_log', {
          p_performed_by: user.id,
          p_action:       'password_reset',
          p_entity_type:  'parent',
          p_entity_id:    parent.id,
          p_new_values:   { reset_by: user.id, context: 'welcome_message_regeneration' },
        })
        parentRegenerated = true
      }
    }
  }

  if (!studentRegenerated && !parentRegenerated) {
    return { success: false, error: 'No missing passwords could be regenerated for this student.' }
  }

  return { success: true, data: { studentRegenerated, parentRegenerated } }
}
