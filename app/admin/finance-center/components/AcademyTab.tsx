'use client'

import { useState } from 'react'
import type { FinancialExpense, RecurringExpense, AcademyPnL } from '@/modules/finance/types'
import { EXPENSE_TYPE_LABELS } from '@/modules/finance/types'
import { fmt, fmtK, DeleteBtn, exportAcademyExcel, type Branch, type Group } from './shared'
import { ExpenseModal } from '../dialogs/ExpenseModal'

export function AcademyTab({
  pnl, expenses, recurring, branches, groups, onRefresh,
}: {
  pnl:       AcademyPnL
  expenses:  FinancialExpense[]
  recurring: RecurringExpense[]
  branches:  Branch[]
  groups:    Group[]
  onRefresh: () => void
}) {
  const [addOpen, setAddOpen] = useState(false)
  const acExp = expenses.filter(e => e.expense_scope === 'ACADEMY')
  const acRec = recurring.filter(r => r.expense_scope === 'ACADEMY')
  const maxBar = Math.max(...pnl.monthly_trend.map(m => Math.max(m.net_collected_revenue, m.total_expenses)), 1)

  return (
    <div className="space-y-5">
      {/* Export */}
      <div className="flex justify-end">
        <button
          onClick={() => exportAcademyExcel(pnl)}
          className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0B1F3A] transition"
        >
          ↓ Export Excel
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { l: 'Net Expected',      v: fmtK(pnl.net_expected_revenue),    c: 'bg-[#94A3B8]' },
          { l: 'Net Collected',     v: fmtK(pnl.net_collected_revenue),   c: 'bg-[#10B981]' },
          { l: 'Outstanding',       v: fmtK(pnl.outstanding),             c: 'bg-[#F59E0B]' },
          { l: 'Total Expenses',    v: fmtK(pnl.total_expenses),          c: 'bg-[#EF4444]' },
          { l: 'Expected Profit',   v: fmtK(pnl.expected_profit),   c: pnl.expected_profit >= 0 ? 'bg-[#10B981]' : 'bg-[#EF4444]', neg: pnl.expected_profit < 0 },
          { l: 'Actual Profit',     v: fmtK(pnl.actual_profit),     c: pnl.actual_profit >= 0 ? 'bg-[#10B981]' : 'bg-[#EF4444]',   neg: pnl.actual_profit < 0 },
        ].map(k => (
          <div key={k.l} className="ds-card p-4">
            <div className={`mb-2 h-1.5 w-8 rounded-full ${k.c} opacity-80`} />
            <p className={`text-xl font-bold ${'neg' in k && k.neg ? 'text-[#EF4444]' : 'text-[#0B1F3A]'}`}>{k.v}</p>
            <p className="mt-0.5 text-xs text-[#64748B]">{k.l}</p>
          </div>
        ))}
      </div>

      {/* Expense breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { l: 'Instr. Earned',    v: fmt(pnl.instructor_earned),    c: 'text-violet-600' },
          { l: 'Instr. Paid',      v: fmt(pnl.instructor_paid),      c: 'text-[#10B981]' },
          { l: 'Future Liability', v: fmt(pnl.future_liability),     c: 'text-rose-600' },
          { l: 'Group Expenses',   v: fmt(pnl.group_expenses + pnl.group_recurring_expenses),   c: 'text-indigo-600' },
          { l: 'Branch Expenses',  v: fmt(pnl.branch_expenses + pnl.branch_recurring_expenses), c: 'text-[#2563EB]' },
          { l: 'Academy Expenses', v: fmt(pnl.academy_expenses + pnl.academy_recurring_expenses), c: 'text-cyan-600' },
        ].map(k => (
          <div key={k.l} className="ds-card p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">{k.l}</p>
            <p className={`mt-1 text-base font-bold ${k.c}`}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Monthly trend */}
      <div className="ds-card">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">Monthly Trend — Last 6 Months</p>
          <div className="flex items-center gap-4 text-[11px] text-[#64748B]">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#10B981]" /> Collected</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#EF4444]" /> Expenses</span>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-end gap-3">
            {pnl.monthly_trend.map(m => {
              const cH = maxBar > 0 ? Math.round((m.net_collected_revenue / maxBar) * 100) : 2
              const eH = maxBar > 0 ? Math.round((m.total_expenses / maxBar) * 100) : 2
              return (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                  <p className={`text-[10px] font-semibold ${m.actual_profit >= 0 ? 'text-[#15803D]' : 'text-[#EF4444]'}`}>
                    {m.actual_profit >= 0 ? '+' : '−'}{fmtK(Math.abs(m.actual_profit)).replace('EGP ', '')}
                  </p>
                  <div className="flex w-full items-end gap-0.5">
                    <div className="flex-1 rounded-t-sm bg-[#10B981]" style={{ height: `${Math.max(cH, 2)}px` }} />
                    <div className="flex-1 rounded-t-sm bg-[#EF4444]"     style={{ height: `${Math.max(eH, 2)}px` }} />
                  </div>
                  <p className="text-[10px] text-[#94A3B8]">{m.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Academy expenses */}
      <div className="ds-card overflow-x-auto">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">Academy Expenses</p>
          <button
            onClick={() => setAddOpen(true)}
            className="rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#e07a1a]"
          >
            + Add Academy Expense
          </button>
        </div>
        {acExp.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#94A3B8]">No academy expenses yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="ds-table-head">
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                {['Date', 'Type', 'Amount', 'Notes', ''].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-medium text-[#64748B] ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {acExp.map(e => (
                <tr key={e.id} className="ds-table-row">
                  <td className="px-4 py-3 text-[#64748B]">
                    {new Date(e.expense_date).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-medium text-[#64748B]">
                      {EXPENSE_TYPE_LABELS[e.expense_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[#EF4444]">{fmt(e.amount)}</td>
                  <td className="px-4 py-3 text-[#64748B] text-xs max-w-[160px] truncate">{e.notes ?? '—'}</td>
                  <td className="px-4 py-3"><DeleteBtn id={e.id} onSuccess={onRefresh} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {addOpen && (
        <ExpenseModal
          scope="ACADEMY"
          branches={branches}
          groups={groups}
          onClose={() => setAddOpen(false)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  )
}
