import { requirePermission } from '@/modules/rbac/guards'
import { getPortfolioByStudentId } from '@/modules/portfolio/queries'
import PageHeader from '@/components/admin/PageHeader'
import NewBadgeForm from './NewBadgeForm'

interface Props {
  params: Promise<{ studentId: string }>
}

export default async function NewBadgePage({ params }: Props) {
  await requirePermission('manage_portfolio')
  const { studentId } = await params

  const portfolio = await getPortfolioByStudentId(studentId)

  return (
    <div>
      <PageHeader title="Award Badge" />
      <NewBadgeForm studentId={studentId} portfolioId={portfolio?.id ?? null} />
    </div>
  )
}
