import { requirePermission } from '@/modules/rbac/guards'
import { listActiveTemplates } from '@/modules/certificates/queries'
import { listCourses } from '@/modules/courses/queries'
import { listSemesters } from '@/modules/semesters/queries'
import { createServiceClient } from '@/lib/supabase/service'
import IssueCertificateForm from './IssueCertificateForm'

export default async function NewCertificatePage() {
  await requirePermission('manage_certificates')

  const db = createServiceClient()

  const [templates, coursesResult, semestersResult, studentsResult] = await Promise.all([
    listActiveTemplates(),
    listCourses({ perPage: 200 }),
    listSemesters({ perPage: 100 }),
    db
      .from('students')
      .select('id, users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))')
      .is('deleted_at', null)
      .eq('status', 'active')
      .order('id'),
  ])

  const students = ((studentsResult.data ?? []) as any[]).map((row) => {
    const profile = row.users?.profiles
    return {
      id:    row.id,
      name:  [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || row.users?.email || '—',
      email: row.users?.email ?? '',
    }
  })

  return (
    <div>
      <IssueCertificateForm
        templates={templates}
        students={students}
        courses={coursesResult.data.map((c) => ({ id: c.id, title: c.title }))}
        semesters={semestersResult.data.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  )
}
