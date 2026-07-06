'use client'

import { useState, useTransition } from 'react'
import { deleteExpense } from '@/modules/finance/actions'
import type { FinancialExpense, RecurringExpense, ExpenseType } from '@/modules/finance/types'
import { EXPENSE_TYPE_LABELS } from '@/modules/finance/types'
import { Modal, DeleteBtn, fmt, type Branch, type Group } from '../components/shared'
import { ExpenseModal } from './ExpenseModal'
import { RecurringModal } from './RecurringModal'

export function GroupDetailModal({
  groupId,
  groupName,
  expenses,
  recurring,
  branches,
  groups,
  onClose,
  onRefresh,
}: {
  groupId:   string
  groupName: string
  expenses:  FinancialExpense[]
  recurring: RecurringExpense[]
  branches:  Branch[]
  groups:    Group[]
  onClose:   () => void
  onRefresh: () => void
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [addRecurOpen, setAddRecurOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const groupExpenses = expenses.filter(e => e.group_id === groupId)
  const groupRecurring = recurring.filter(r => r.group_id === groupId)

  const manualTotal = groupExpenses.reduce((s, e) => s + e.amount, 0)

  const categoryMap: Record<string, number> = {}
  for (const e of groupExpenses) {
    categoryMap[e.expense_type] = (categoryMap[e.expense_type] ?? 0) + e.amount
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteExpense(id)
      onRefresh()
    })
  }

  return (
    <Modal title={`${groupName} — Expense Details`} onClose={onClose}>
      <div className="space-y-5">
        {/* Category breakdown */}
        {Object.keys(categoryMap).length > 0 && (
          <div>
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">By Category</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(categoryMap).sort((a,b) => b[1]-a[1]).map(([type, amt]) => (
                <div key={type} className="rounded-lg border border-[#E2E8F0] px-3 py-2">
                  <p className="text-[11px] text-[#94A3B8]">{EXPENSE_TYPE_LABELS[type as ExpenseType] ?? type}</p>
                  <p className="text-sm font-bold text-[#EF4444]">{fmt(amt)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recurring */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">Recurring Expenses</p>
            <button
              onClick={() => setAddRecurOpen(true)}
              className="text-[11px] font-semibold text-[#FF8A1F] hover:underline"
            >
              + Add Recurring
            </button>
          </div>
          {groupRecurring.length === 0 ? (
            <p className="text-xs text-[#94A3B8]">No recurring expenses for this group.</p>
          ) : (
            <div className="space-y-1.5">
              {groupRecurring.map(r => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-[#0B1F3A]">{EXPENSE_TYPE_LABELS[r.expense_type]} · {fmt(r.amount)}/mo</p>
                    <p className="text-[11px] text-[#94A3B8]">
                      From {r.start_date}{r.end_date ? ` to ${r.end_date}` : ''} · {r.is_active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expense history */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">
              Expense History · {fmt(manualTotal)} total
            </p>
            <button
              onClick={() => setAddOpen(true)}
              className="rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#e07a1a]"
            >
              + Add Expense
            </button>
          </div>
          {groupExpenses.length === 0 ? (
            <p className="text-xs text-[#94A3B8]">No expenses recorded. Add one above.</p>
          ) : (
            <div className="rounded-xl border border-[#E2E8F0] overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="ds-table-head">
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-3 py-2 text-left font-medium text-[#64748B]">Date</th>
                    <th className="px-3 py-2 text-left font-medium text-[#64748B]">Type</th>
                    <th className="px-3 py-2 text-right font-medium text-[#64748B]">Amount</th>
                    <th className="px-3 py-2 text-left font-medium text-[#64748B]">Notes</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {groupExpenses.map(e => (
                    <tr key={e.id} className="border-b border-[#E2E8F0] last:border-0">
                      <td className="px-3 py-2 text-[#64748B]">
                        {new Date(e.expense_date).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[11px] font-medium text-[#64748B]">
                          {EXPENSE_TYPE_LABELS[e.expense_type]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-[#EF4444]">{fmt(e.amount)}</td>
                      <td className="px-3 py-2 text-[#94A3B8] max-w-[140px] truncate">{e.notes ?? '—'}</td>
                      <td className="px-3 py-2">
                        <DeleteBtn id={e.id} onSuccess={() => { handleDelete(e.id); onRefresh() }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {addOpen && (
        <ExpenseModal
          scope="GROUP"
          defaultGroupId={groupId}
          branches={branches}
          groups={groups}
          onClose={() => setAddOpen(false)}
          onSuccess={onRefresh}
        />
      )}

      {addRecurOpen && (
        <RecurringModal
          scope="GROUP"
          branches={branches}
          groups={groups}
          onClose={() => setAddRecurOpen(false)}
          onSuccess={onRefresh}
        />
      )}
    </Modal>
  )
}
