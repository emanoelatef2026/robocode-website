import { notFound } from 'next/navigation'
import { requirePermission } from '@/modules/rbac/guards'
import { getOrCreatePortfolio } from '@/modules/portfolio/queries'
import { listCourses } from '@/modules/courses/queries'
import { listSemesters } from '@/modules/semesters/queries'
import { createServiceClient } from '@/lib/supabase/service'
import PageHeader from '@/components/admin/PageHeader'
import NewProjectForm from './NewProjectForm'

interface Props {
  params: Promise<{ studentId: string }>
}

export default async function NewProjectPage({ params }: Props) {
  await requirePermission('manage_portfolio')
  const { studentId } = await params

  // Verify student exists
  const db = createServiceClient()
  const { data: student } = await db
    .from('students')
    .select('id, users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))')
    .eq('id', studentId)
    .is('deleted_at', null)
    .single()

  if (!student) notFound()

  const [portfolio, coursesResult, semestersResult] = await Promise.all([
    getOrCreatePortfolio(studentId),
    listCourses({ perPage: 200 }),
    listSemesters({ perPage: 100 }),
  ])

  const s = student as any
  const profile = s.users?.profiles
  const studentName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || '—'

  return (
    <div>
      <PageHeader
        title="New Project"
        description={`For ${studentName}`}
      />
      <NewProjectForm
        studentId={studentId}
        portfolioId={portfolio.id}
        courses={coursesResult.data.map((c) => ({ id: c.id, title: c.title }))}
        semesters={semestersResult.data.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  )
}
