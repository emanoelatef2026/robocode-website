import { getGroupFinanceSummary } from '@/modules/finance/queries'
import { getGroupPnLRows }        from '@/modules/finance/queries'
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS } from '@/modules/finance/types'
import Link from 'next/link'

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

function PnLValue({ value, prefix = 'EGP ' }: { value: number; prefix?: string }) {
  const positive = value >= 0
  return (
    <p className={`mt-0.5 text-sm font-bold ${positive ? 'text-emerald-700' : 'text-red-600'}`}>
      {value < 0 ? '−' : '+'}{prefix}{fmt(Math.abs(value))}
    </p>
  )
}

export default async function GroupFinanceSection({ groupId }: { groupId: string }) {
  const [summary, pnlRows] = await Promise.all([
    getGroupFinanceSummary(groupId),
    getGroupPnLRows(),
  ])

  if (!summary) return null

  const { expected_revenue, collected, outstanding, collection_rate, overdue_count, student_accounts } = summary
  const pnl = pnlRows.find(r => r.group_id === groupId)

  if (student_accounts.length === 0 && !pnl) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="border-b border-[#E2E8F0] px-5 py-3">
          <p className="text-sm font-semibold text-[#0B1F3A]">Group Finance</p>
        </div>
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-[#94A3B8]">No financial accounts found for students in this group.</p>
          <Link href="/admin/finance/new" className="mt-3 inline-block text-xs font-medium text-[#FF8A1F] hover:underline">
            Add accounts in Finance Center →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3">
        <p className="text-sm font-semibold text-[#0B1F3A]">Group Finance & P&L</p>
        <div className="flex items-center gap-2">
          <Link href="/admin/expenses?scope=GROUP" className="text-xs font-medium text-[#94A3B8] hover:text-[#FF8A1F]">
            Add Expense →
          </Link>
          <Link href="/admin/finance" className="text-xs font-medium text-[#FF8A1F] hover:underline">
            Finance Center →
          </Link>
        </div>
      </div>

      {/* Revenue KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#E2E8F0] border-b border-[#E2E8F0]">
        {[
          { l: 'Expected Revenue', v: `EGP ${fmt(expected_revenue)}`, c: 'text-[#0B1F3A]' },
          { l: 'Collected',        v: `EGP ${fmt(collected)}`,        c: 'text-emerald-600 font-bold' },
          { l: 'Outstanding',      v: `EGP ${fmt(outstanding)}`,      c: outstanding > 0 ? 'text-red-500 font-bold' : 'text-[#94A3B8]' },
          { l: 'Collection Rate',  v: `${collection_rate}%`,           c: collection_rate >= 80 ? 'text-emerald-600 font-bold' : collection_rate >= 50 ? 'text-amber-600 font-bold' : 'text-red-500 font-bold' },
        ].map(({ l, v, c }) => (
          <div key={l} className="bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">{l}</p>
            <p className={`mt-0.5 text-sm ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      {/* P&L section */}
      {pnl && (
        <>
          <div className="border-b border-[#E2E8F0] px-5 py-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">Profit & Loss</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-[#E2E8F0] border-b border-[#E2E8F0]">
            <div className="bg-white px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Instructor Cost</p>
              <p className="mt-0.5 text-sm font-bold text-violet-700">EGP {fmt(pnl.instructor_cost)}</p>
            </div>
            <div className="bg-white px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Other Expenses</p>
              <p className="mt-0.5 text-sm font-bold text-indigo-700">EGP {fmt(pnl.other_expenses)}</p>
            </div>
            <div className="bg-white px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Total Expenses</p>
              <p className="mt-0.5 text-sm font-bold text-red-600">EGP {fmt(pnl.total_expenses)}</p>
            </div>
            <div className="bg-white px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Expected Profit</p>
              <PnLValue value={pnl.expected_profit} />
            </div>
            <div className="bg-white px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Actual Profit</p>
              <PnLValue value={pnl.actual_profit} />
            </div>
          </div>
        </>
      )}

      {/* Collection progress bar */}
      <div className="px-5 py-2.5 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
            <div
              className={`h-full rounded-full ${collection_rate >= 80 ? 'bg-emerald-400' : collection_rate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${collection_rate}%` }}
            />
          </div>
          <span className="text-xs text-[#64748B]">{collection_rate}% collected</span>
          {overdue_count > 0 && (
            <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
              {overdue_count} overdue
            </span>
          )}
        </div>
      </div>

      {/* Student accounts table */}
      {student_accounts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Student</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Total</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Paid</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Remaining</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Priority</th>
              </tr>
            </thead>
            <tbody>
              {student_accounts.map(sa => (
                <tr key={sa.student_id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/students/${sa.student_id}?tab=finance`} className="font-medium text-[#0B1F3A] hover:text-[#FF8A1F]">
                      {sa.student_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right text-[#64748B]">EGP {fmt(sa.net_amount)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">EGP {fmt(sa.paid_amount)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`font-bold ${sa.remaining_amount > 0 ? 'text-red-500' : 'text-[#94A3B8]'}`}>
                      EGP {fmt(sa.remaining_amount)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[sa.status]}`}>
                      {STATUS_LABELS[sa.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_COLORS[sa.priority]}`}>
                      {sa.priority}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
