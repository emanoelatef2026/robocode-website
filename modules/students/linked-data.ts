import { generateUniqueLoginEmail, ORG_EMAIL_DOMAIN } from '@/lib/generate-login-email'

type ServiceDb = ReturnType<typeof import('@/lib/supabase/service').createServiceClient>

export async function syncStudentCertificateNames(
  db: ServiceDb,
  studentId: string,
  studentName: string,
): Promise<void> {
  await db.from('certificates').update({ recipient_name: studentName }).eq('student_id', studentId)
}

export async function syncParentPortalIdentity(
  db: ServiceDb,
  parentId: string,
  contactName: string,
): Promise<void> {
  const { data: parent } = await db.from('parents').select('user_id').eq('id', parentId).maybeSingle()
  const userId = (parent as { user_id?: string | null } | null)?.user_id
  if (!userId) return

  const parts = contactName.trim().split(/\s+/).filter(Boolean)
  const firstName = parts[0] ?? ''
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName
  const email = await generateUniqueLoginEmail('learner', firstName, lastName, async localPart => {
    const { data } = await db
      .from('users')
      .select('id')
      .ilike('email', `${localPart}@${ORG_EMAIL_DOMAIN}`)
      .neq('id', userId)
      .maybeSingle()
    return !!data
  })

  await db.from('profiles').update({ first_name: firstName, last_name: lastName }).eq('user_id', userId)
  const { error: authError } = await db.auth.admin.updateUserById(userId, { email, email_confirm: true })
  if (authError) throw new Error(`Parent email update failed: ${authError.message}`)
  const { error: userError } = await db.from('users').update({ email }).eq('id', userId)
  if (userError) throw new Error(`Parent email update failed: ${userError.message}`)
}
