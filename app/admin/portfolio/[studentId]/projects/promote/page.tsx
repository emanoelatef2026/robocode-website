import { notFound } from 'next/navigation'
import { requirePermission } from '@/modules/rbac/guards'
import { listPromotableSubmissions } from '@/modules/portfolio/queries'
import { createServiceClient } from '@/lib/supabase/service'
import PageHeader from '@/components/admin/PageHeader'
import PromoteForm from './PromoteForm'

interface Props {
  params: Promise<{ studentId: string }>
}

export default async function PromoteSubmissionPage({ params }: Props) {
  await requirePermission('manage_portfolio')
  const { studentId } = await params

  const db = createServiceClient()
  const { data: student } = await db
    .from('students')
    .select('id, users!students_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))')
    .eq('id', studentId)
    .is('deleted_at', null)
    .single()

  if (!student) notFound()

  const s = student as any
  const profile = s.users?.profiles
  const studentName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || '—'

  const submissions = await listPromotableSubmissions(studentId)

  return (
    <div>
      <PageHeader
        title="Promote Submission"
        description={`Add a graded submission to ${studentName}'s portfolio`}
      />
      <PromoteForm studentId={studentId} submissions={submissions} />
    </div>
  )
}
