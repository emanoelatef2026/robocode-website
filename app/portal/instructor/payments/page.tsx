import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId } from '@/modules/instructor-portal/queries'
import EmptyState from '@/components/admin/EmptyState'
import {
  getInstructorPaymentOverview,
  getInstructorBranchIds,
  getInstructorSessionEarnings,
  applySessionEarningFilters,
  getInstructorPaymentHistory,
  getInstructorPaymentMethods,
  listInstructorPayoutRequests,
} from '@/modules/instructor-payments/queries'
import { isPaymentInfoComplete } from '@/modules/instructor-payments/types'
import PaymentsTabs from './_components/PaymentsTabs'

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function InstructorPaymentsPage({ searchParams }: Props) {
  const user       = await requirePortalRole('instructor')
  const instructor = await getInstructorByUserId(user.id)

  if (!instructor) {
    return (
      <EmptyState
        title="No instructor record found"
        description="Contact your team leader to link your account."
      />
    )
  }

  const sp = await searchParams
  const tab = (sp.tab as 'overview' | 'history' | 'methods' | undefined) ?? 'overview'

  const filters = {
    month:       sp.month ? Number(sp.month) : undefined,
    year:        sp.year  ? Number(sp.year)  : undefined,
    from:        sp.from,
    to:          sp.to,
    status:      sp.status,
    sessionType: sp.sessionType as 'primary' | 'trial' | 'makeup' | undefined,
  }

  const branchIds = await getInstructorBranchIds(instructor.id, instructor.branch_id)

  const [overview, allSessions, history, paymentMethods, payoutRequests] = await Promise.all([
    getInstructorPaymentOverview(instructor.id, user.id, instructor.branch_id),
    getInstructorSessionEarnings(instructor.id, branchIds),
    getInstructorPaymentHistory(instructor.id, user.id, instructor.branch_id),
    getInstructorPaymentMethods(instructor.id),
    listInstructorPayoutRequests(instructor.id),
  ])

  const breakdown = applySessionEarningFilters(allSessions, filters)
  const infoComplete = isPaymentInfoComplete(paymentMethods)

  return (
    <div className="space-y-4">
      <PaymentsTabs
        tab={tab}
        overview={overview}
        breakdown={breakdown}
        filters={filters}
        history={history}
        paymentMethods={paymentMethods}
        payoutRequests={payoutRequests}
        infoComplete={infoComplete}
      />
    </div>
  )
}
