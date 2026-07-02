import Link from 'next/link'
import type {
  InstructorPaymentOverview, InstructorSessionEarning, SessionEarningFilters,
  InstructorMonthlyPaymentSummary, InstructorPaymentMethods,
} from '@/modules/instructor-payments/types'
import MissingPaymentInfoBanner from './MissingPaymentInfoBanner'
import OverviewTab from './OverviewTab'
import HistoryTab from './HistoryTab'
import MethodsTab from './MethodsTab'

interface Props {
  tab:            'overview' | 'history' | 'methods'
  overview:       InstructorPaymentOverview
  breakdown:      InstructorSessionEarning[]
  filters:        SessionEarningFilters
  history:        InstructorMonthlyPaymentSummary[]
  paymentMethods: InstructorPaymentMethods
  infoComplete:   boolean
}

const TABS: { key: Props['tab']; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'history',  label: 'Payment History' },
  { key: 'methods',  label: 'Payment Methods' },
]

export default function PaymentsTabs({
  tab, overview, breakdown, filters, history, paymentMethods, infoComplete,
}: Props) {
  return (
    <div className="space-y-4">
      {!infoComplete && <MissingPaymentInfoBanner />}

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-[#E2E8F0]">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={`/portal/instructor/payments?tab=${t.key}`}
            className={`px-3.5 py-2 text-[13px] font-semibold transition ${
              tab === t.key
                ? 'border-b-2 border-[#FF8A1F] text-[#FF8A1F]'
                : 'border-b-2 border-transparent text-[#64748B] hover:text-[#0B1F3A]'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewTab overview={overview} breakdown={breakdown} filters={filters} />
      )}
      {tab === 'history' && <HistoryTab history={history} />}
      {tab === 'methods' && <MethodsTab paymentMethods={paymentMethods} />}
    </div>
  )
}
