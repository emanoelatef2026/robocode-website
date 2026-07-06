'use client'

import { useState } from 'react'
import type { FinancialExpense, RecurringExpense, BranchPnL } from '@/modules/finance/types'
import { EXPENSE_TYPE_LABELS } from '@/modules/finance/types'
import { fmt, fmtK, ProfitBadge, RateBadge, DeleteBtn, type Branch, type Group } from './shared'
import { ExpenseModal } from '../dialogs/ExpenseModal'

export function BranchesTab({
  rows, expenses, recurring, branches, groups, onRefresh,
}: {
  rows:      BranchPnL[]
  expenses:  FinancialExpense[]
  recurring: RecurringExpense[]
  branches:  Branch[]
  groups:    Group[]
  onRefresh: () => void
}) {
  const [addBranch, setAddBranch] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: 'Net Expected',    v: fmtK(rows.reduce((s,b) => s + b.net_expected_revenue,    0)), c: 'bg-[#94A3B8]' },
          { l: 'Net Collected',   v: fmtK(rows.reduce((s,b) => s + b.net_collected_revenue,   0)), c: 'bg-[#10B981]' },
          { l: 'Total Expenses',  v: fmtK(rows.reduce((s,b) => s + b.total_expenses,          0)), c: 'bg-[#EF4444]' },
          { l: 'Actual Profit',   v: fmtK(rows.reduce((s,b) => s + b.actual_profit,           0)), c: rows.reduce((s,b) => s+b.actual_profit,0) >= 0 ? 'bg-[#10B981]' : 'bg-[#EF4444]' },
        ].map(k => (
          <div key={k.l} className="ds-card p-4">
            <div className={`mb-2 h-1.5 w-8 rounded-full ${k.c} opacity-80`} />
            <p className="text-xl font-bold text-[#0B1F3A]">{k.v}</p>
            <p className="mt-0.5 text-xs text-[#64748B]">{k.l}</p>
          </div>
        ))}
      </div>

      {/* Branch cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(b => (
          <div key={b.branch_id} className="ds-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#0B1F3A]">{b.branch_name}</p>
                <p className="text-[11px] text-[#94A3B8]">{b.student_count} students · {b.group_count} groups</p>
              </div>
              <RateBadge rate={b.collection_rate} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div><p className="text-[#94A3B8]">Net Expected</p><p className="font-semibold text-[#94A3B8]">{fmt(b.net_expected_revenue)}</p></div>
              <div><p className="text-[#94A3B8]">Net Collected</p><p className="font-semibold text-[#15803D]">{fmt(b.net_collected_revenue)}</p></div>
              <div><p className="text-[#94A3B8]">Outstanding</p><p className="font-semibold text-[#F59E0B]">{fmt(b.outstanding)}</p></div>
              <div><p className="text-[#94A3B8]">Total Expenses</p><p className="font-semibold text-[#EF4444]">{fmt(b.total_expenses)}</p></div>
            </div>

            {b.total_expenses > 0 && (
              <div className="rounded-lg bg-[#F8FAFC] px-3 py-2 text-[11px] space-y-1">
                {b.final_instructor_cost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Instr. Earned</span>
                    <span className="font-medium text-violet-700">{fmt(b.instructor_earned)}</span>
                  </div>
                )}
                {b.future_liability > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Future Liability</span>
                    <span className="font-medium text-rose-600">{fmt(b.future_liability)}</span>
                  </div>
                )}
                {b.branch_expenses > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Manual</span>
                    <span className="font-medium text-[#1D4ED8]">{fmt(b.branch_expenses)}</span>
                  </div>
                )}
                {b.branch_recurring_expenses > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Recurring</span>
                    <span className="font-medium text-cyan-700">{fmt(b.branch_recurring_expenses)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-[#E2E8F0] pt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <p className="text-[#94A3B8]">Expected Profit</p>
                <ProfitBadge value={b.expected_profit} size="xs" />
              </div>
              <div>
                <p className="text-[#94A3B8]">Actual Profit</p>
                <ProfitBadge value={b.actual_profit} size="xs" />
              </div>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
              <div
                className={`h-full rounded-full ${b.collection_rate >= 80 ? 'bg-[#10B981]' : b.collection_rate >= 50 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`}
                style={{ width: `${Math.min(b.collection_rate, 100)}%` }}
              />
            </div>

            <button
              onClick={() => setAddBranch(b.branch_id)}
              className="w-full rounded-lg border border-[#E2E8F0] py-1.5 text-[11px] font-semibold text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
            >
              + Add Branch Expense
            </button>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="col-span-3 ds-card py-14 text-center">
            <p className="text-sm text-[#94A3B8]">No branches found.</p>
          </div>
        )}
      </div>

      {/* Branch expense history table */}
      {expenses.filter(e => e.expense_scope === 'BRANCH').length > 0 && (
        <div className="ds-card overflow-x-auto">
          <div className="border-b border-[#E2E8F0] px-4 py-2.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">Branch Expense History</p>
          </div>
          <table className="w-full text-sm">
            <thead className="ds-table-head">
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Branch</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {expenses.filter(e => e.expense_scope === 'BRANCH').map(e => (
                <tr key={e.id} className="ds-table-row">
                  <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">
                    {new Date(e.expense_date).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">{e.branch_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-medium text-[#64748B]">
                      {EXPENSE_TYPE_LABELS[e.expense_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[#EF4444]">{fmt(e.amount)}</td>
                  <td className="px-4 py-3 text-[#64748B] text-xs max-w-[160px] truncate">{e.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    <DeleteBtn id={e.id} onSuccess={onRefresh} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addBranch && (
        <ExpenseModal
          scope="BRANCH"
          defaultBranchId={addBranch}
          branches={branches}
          groups={groups}
          onClose={() => setAddBranch(null)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  )
}
