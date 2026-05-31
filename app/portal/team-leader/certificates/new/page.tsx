import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { listActiveTemplates }                  from '@/modules/certificates/queries'
import { listCourses }                          from '@/modules/courses/queries'
import { listSemesters }                        from '@/modules/semesters/queries'
import { createServiceClient }                  from '@/lib/supabase/service'
import PageHeader                               from '@/components/admin/PageHeader'
import IssueCertificateForm                     from '@/app/admin/certificates/new/IssueCertificateForm'
import Link                                     from 'next/link'

export default async function TLIssueCertificatePage() {
  const user = await requirePortalRole('team_leader')
  await requirePermission('manage_certificates')

  const db = createServiceClient()

  const [templates, coursesResult, semestersResult, studentsResult] = await Promise.all([
    listActiveTemplates(),
    listCourses({ perPage: 200 }),
    listSemesters({ perPage: 100 }),
    // Branch-scoped: only students in TL branches
    db
      .from('students')
      .select('id, branch_id, users!students_user_id_fkey(email, profiles!profiles_user_id_fkey(first_name, last_name))')
      .is('deleted_at', null)
      .eq('status', 'active')
      .in('branch_id', user.branchIds)
      .order('id'),
  ])

  const students = ((studentsResult.data ?? []) as any[]).map(row => {
    const profile = row.users?.profiles
    return {
      id:    row.id,
      name:  [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || row.users?.email || '—',
      email: row.users?.email ?? '',
    }
  })

  return (
    <div>
      <PageHeader
        title="Issue Certificate"
        action={
          <Link
            href="/portal/team-leader/certificates"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Cancel
          </Link>
        }
      />
      <IssueCertificateForm
        templates={templates}
        students={students}
        courses={coursesResult.data.map(c => ({ id: c.id, title: c.title }))}
        semesters={semestersResult.data.map(s => ({ id: s.id, name: s.name }))}
      />
    </div>
  )
}
