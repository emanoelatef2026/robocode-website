import { requirePermission } from '@/modules/rbac/guards'
import { getPortfolioByStudentId } from '@/modules/portfolio/queries'
import PageHeader from '@/components/admin/PageHeader'
import NewAchievementForm from './NewAchievementForm'

interface Props {
  params: Promise<{ studentId: string }>
}

export default async function NewAchievementPage({ params }: Props) {
  await requirePermission('manage_portfolio')
  const { studentId } = await params

  const portfolio = await getPortfolioByStudentId(studentId)

  return (
    <div>
      <PageHeader title="Add Achievement" />
      <NewAchievementForm studentId={studentId} portfolioId={portfolio?.id ?? null} />
    </div>
  )
}
