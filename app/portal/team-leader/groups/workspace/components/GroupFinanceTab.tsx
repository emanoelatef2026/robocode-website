import type { GroupDetailStudent } from '@/modules/groups/modal-actions'
import { fmtCurrency } from '../utils'
import { LoadingSpinner } from './LoadingSpinner'

export function GroupFinanceTab({ students, loading }: { students: GroupDetailStudent[]; loading: boolean }) {
  if (loading && !students.length) return <LoadingSpinner />

  const totalPaid      = students.reduce((s, st) => s + (st.paid_amount ?? 0), 0)
  const totalBalance   = students.reduce((s, st) => s + (st.remaining_balance ?? 0), 0)
  const overdueCount   = students.filter(s => s.payment_status === 'OVERDUE').length
  const exhaustedCount = students.filter(s => (s.sessions_remaining ?? 1) <= 0).length

  const sorted = [...students].sort((a, b) => {
    const order: Record<string, number> = { OVERDUE: 0, DUE_SOON: 1, CURRENT: 2, PAID: 3 }
    return (order[a.payment_status ?? ''] ?? 4) - (order[b.payment_status ?? ''] ?? 4)
  })

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Collected', value: totalPaid > 0 ? fmtCurrency(totalPaid) : '—',         alert: false             },
          { label: 'Outstanding',     value: totalBalance > 0 ? fmtCurrency(totalBalance) : '—',   alert: totalBalance > 0  },
          { label: 'Overdue',         value: String(overdueCount),                                  alert: overdueCount > 0  },
          { label: 'Exhausted Pkgs',  value: String(exhaustedCount),                               alert: exhaustedCount > 0 },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide">{card.label}</p>
            <p className={`mt-1 text-lg font-bold ${card.alert ? 'text-[#EF4444]' : 'text-[#0B1F3A]'}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="divide-y divide-[#F1F5F9] ds-card">
        {sorted.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#94A3B8]">No finance data available.</p>
        ) : sorted.map(s => {
          const sessLeft    = s.sessions_remaining ?? null
          const isExhausted = sessLeft != null && sessLeft <= 0
          return (
            <div key={s.student_id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#0B1F3A]">{s.student_name}</p>
                <div className="flex items-center flex-wrap gap-2 mt-0.5">
                  {sessLeft != null && (
                    <span className={`text-[11px] ${isExhausted ? 'text-[#EF4444] font-semibold' : 'text-[#64748B]'}`}>
                      {sessLeft} sess. left
                    </span>
                  )}
                  {s.subscription_amount != null && s.subscription_amount > 0 && (
                    <span className="text-[11px] text-[#64748B]">Pkg: {fmtCurrency(s.subscription_amount)}</span>
                  )}
                  {s.paid_amount > 0 && (
                    <span className="text-[11px] text-[#10B981]">Paid: {fmtCurrency(s.paid_amount)}</span>
                  )}
                  {s.remaining_balance > 0 && (
                    <span className="text-[11px] text-[#EF4444] font-medium">Due: {fmtCurrency(s.remaining_balance)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.payment_status && (
                  <span className={[
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    s.payment_status === 'PAID'     ? 'bg-[#E7F8EE] text-[#15803D]'
                    : s.payment_status === 'OVERDUE'  ? 'bg-[#FEE2E2] text-[#DC2626]'
                    : s.payment_status === 'DUE_SOON' ? 'bg-[#FFFBEB] text-[#B45309]'
                                                      : 'bg-[#EFF6FF] text-[#1D4ED8]',
                  ].join(' ')}>
                    {s.payment_status === 'DUE_SOON'
                      ? 'Due Soon'
                      : s.payment_status.charAt(0) + s.payment_status.slice(1).toLowerCase()}
                  </span>
                )}
                {isExhausted && (
                  <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-bold text-[#DC2626]">EXHAUSTED</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
