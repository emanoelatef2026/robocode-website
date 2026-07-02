import KpiCard from '@/components/admin/KpiCard'
import StatusBadge from '@/components/admin/StatusBadge'
import EmptyState from '@/components/admin/EmptyState'
import type {
  InstructorPaymentOverview, InstructorSessionEarning, SessionEarningFilters, InstructorPayoutRequest,
} from '@/modules/instructor-payments/types'
import { fmtEGP } from '@/modules/instructor-payments/types'
import SessionBreakdownFilters from './SessionBreakdownFilters'
import PayoutRequestPanel from './PayoutRequestPanel'

const SESSION_TYPE_LABELS: Record<string, string> = {
  primary: 'Primary',
  trial:   'Trial',
  makeup:  'Makeup',
}

interface Props {
  overview:       InstructorPaymentOverview
  breakdown:      InstructorSessionEarning[]
  filters:        SessionEarningFilters
  payoutRequests: InstructorPayoutRequest[]
}

export default function OverviewTab({ overview, breakdown, filters, payoutRequests }: Props) {
  const openRequest = payoutRequests.find(r => r.status === 'pending' || r.status === 'approved')

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Estimated This Month" value={fmtEGP(overview.estimated_this_month)} barColor="#38BDF8" bars={[40, 45, 50, 55, 60, 65, 70]} />
        <KpiCard label="Approved This Month"  value={fmtEGP(overview.approved_this_month)}  barColor="#6366F1" bars={[35, 40, 48, 50, 55, 60, 65]} />
        <KpiCard label="Paid This Month"      value={fmtEGP(overview.paid_this_month)}      barColor="#10B981" bars={[20, 30, 35, 45, 50, 55, 60]} />
        <KpiCard
          label="Outstanding"
          value={fmtEGP(overview.outstanding)}
          barColor="#F59E0B"
          alert={overview.outstanding > 0}
          bars={[10, 20, 15, 25, 20, 30, 25]}
        />
        <div className="col-span-2 sm:col-span-1">
          <KpiCard label="Lifetime Earnings" value={fmtEGP(overview.lifetime_earnings)} barColor="#FF8A1F" bars={[50, 55, 60, 65, 70, 75, 80]} />
        </div>
      </div>

      {/* Payout request */}
      <PayoutRequestPanel overview={overview} openRequest={openRequest ?? null} />

      {/* Session breakdown */}
      <div>
        <h2 className="mb-2 text-[13px] font-bold text-[#0B1F3A]">Session Breakdown</h2>
        <SessionBreakdownFilters filters={filters} />

        {breakdown.length === 0 ? (
          <EmptyState title="No sessions found" description="Try adjusting the filters above." />
        ) : (
          <div className="mt-3 overflow-hidden ds-card">
            <div className="hidden lg:grid grid-cols-[110px_1fr_90px_1fr_110px_110px] gap-3 border-b border-[#F1F5F9] bg-[#F8FAFC] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">
              <span>Date</span>
              <span>Session</span>
              <span>Type</span>
              <span>Group</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              {breakdown.map(s => {
                const dateFull = new Date(s.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                return (
                  <div key={s.schedule_id} className="px-4 py-3">
                    <div className="hidden lg:grid grid-cols-[110px_1fr_90px_1fr_110px_110px] items-center gap-3">
                      <span className="text-[12px] text-[#64748B]">{dateFull}</span>
                      <span className="text-[12px] text-[#0B1F3A] truncate">{s.topic ?? '—'}</span>
                      <span className="text-[12px] font-semibold text-[#0B1F3A]">{SESSION_TYPE_LABELS[s.session_type]}</span>
                      <span className="text-[12px] text-[#64748B] truncate">{s.group_name}</span>
                      <span className="text-[12px] font-bold text-[#0B1F3A]">{fmtEGP(s.amount)}</span>
                      <StatusBadge status={s.status} dot />
                    </div>
                    <div className="lg:hidden">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[#94A3B8]">{dateFull}</span>
                        <StatusBadge status={s.status} dot />
                      </div>
                      <div className="mt-1 flex items-baseline justify-between gap-2">
                        <p className="truncate text-[13px] font-semibold text-[#0B1F3A]">{s.topic ?? s.group_name}</p>
                        <span className="shrink-0 text-[13px] font-bold text-[#0B1F3A]">{fmtEGP(s.amount)}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#64748B]">
                        {SESSION_TYPE_LABELS[s.session_type]} · {s.group_name}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
