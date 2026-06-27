import type { InstructorDetailData } from '@/modules/instructors/types'
import { StatCard } from '../StatCard'
import { SectionLabel } from '../SectionLabel'
import { fmtCurrency } from '../../utils'

export function FinanceTab({ detail }: { detail: InstructorDetailData }) {
  const { instructor, finance, attendance_stats } = detail
  const sessionsCompleted = attendance_stats.sessions_completed
  const salaryPerSession  = instructor.salary_per_session ?? 0
  const estimatedPayout   = salaryPerSession * sessionsCompleted
  const currency          = instructor.currency ?? 'EGP'

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1.5 md:gap-3">
        <StatCard label="Salary / Session" value={salaryPerSession > 0 ? fmtCurrency(salaryPerSession, currency) : '—'} accent />
        <StatCard label="Sessions Taught"  value={sessionsCompleted} />
        <StatCard label="Estimated Payout" value={estimatedPayout > 0 ? fmtCurrency(estimatedPayout, currency) : '—'} accent />
        <StatCard label="Currency"         value={currency} />
      </div>

      <div>
        <SectionLabel>Payment Details</SectionLabel>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3 text-[12px]">
          <div className="flex justify-between">
            <span className="text-[#94A3B8]">Instapay</span>
            <span className="font-medium text-[#0B1F3A]">{instructor.instapay_number || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#94A3B8]">Wallet</span>
            <span className="font-medium text-[#0B1F3A]">{instructor.wallet_number || '—'}</span>
          </div>
          {instructor.payment_notes && (
            <div>
              <span className="text-[#94A3B8] block mb-1">Notes</span>
              <p className="text-[#374151] leading-relaxed">{instructor.payment_notes}</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <SectionLabel>Student Finance (via Groups)</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5 md:gap-3">
          <StatCard label="Active Contracts"  value={finance.active_contracts} />
          <StatCard label="With Balance"      value={finance.students_with_balance} danger={finance.students_with_balance > 0} />
          <StatCard label="Total Outstanding" value={finance.total_outstanding > 0 ? fmtCurrency(finance.total_outstanding) : '—'} danger={finance.total_outstanding > 0} />
          <StatCard label="Total Revenue"     value={finance.total_revenue > 0 ? fmtCurrency(finance.total_revenue) : '—'} />
        </div>
      </div>
    </div>
  )
}
