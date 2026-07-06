'use client'

import { useState, useTransition } from 'react'
import { toggleRecurringExpense, deleteRecurringExpense } from '@/modules/finance/actions'
import type { RecurringExpense } from '@/modules/finance/types'
import { EXPENSE_TYPE_LABELS } from '@/modules/finance/types'
import { fmt, type Branch, type Group } from './shared'
import { RecurringModal } from '../dialogs/RecurringModal'

export function RecurringTab({
  recurring, branches, groups, onRefresh,
}: {
  recurring: RecurringExpense[]
  branches:  Branch[]
  groups:    Group[]
  onRefresh: () => void
}) {
  const [addOpen, setAddOpen]   = useState(false)
  const [editItem, setEditItem] = useState<RecurringExpense | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleToggle(id: string, current: boolean) {
    startTransition(async () => {
      await toggleRecurringExpense(id, !current)
      onRefresh()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteRecurringExpense(id)
      onRefresh()
    })
  }

  const active   = recurring.filter(r => r.is_active)
  const inactive = recurring.filter(r => !r.is_active)
  const monthlyTotal = active.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="ds-card p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">Active Recurring</p>
          <p className="mt-1 text-xl font-bold text-[#0B1F3A]">{active.length}</p>
        </div>
        <div className="ds-card p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">Monthly Commitment</p>
          <p className="mt-1 text-xl font-bold text-[#EF4444]">{fmt(monthlyTotal)}</p>
        </div>
        <div className="ds-card p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">Annual Commitment</p>
          <p className="mt-1 text-xl font-bold text-[#0B1F3A]">{fmt(monthlyTotal * 12)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#0B1F3A]">Recurring Expenses</p>
        <button
          onClick={() => setAddOpen(true)}
          className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#e07a1a]"
        >
          + Add Recurring Expense
        </button>
      </div>

      {recurring.length === 0 ? (
        <div className="ds-card py-14 text-center">
          <p className="text-sm text-[#94A3B8]">No recurring expenses yet. Add rent, internet, software subscriptions, etc.</p>
        </div>
      ) : (
        <div className="ds-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="ds-table-head">
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                {['Scope','Type','Group / Branch','Amount/mo','Start','End','Status',''].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-medium text-[#64748B] ${h === 'Amount/mo' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recurring.map(r => (
                <tr key={r.id} className="ds-table-row">
                  <td className="px-4 py-3">
                    <span className="rounded bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-medium text-[#64748B]">
                      {r.expense_scope}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">{EXPENSE_TYPE_LABELS[r.expense_type]}</td>
                  <td className="px-4 py-3 text-[#64748B]">
                    {r.group_name ?? r.branch_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[#EF4444]">{fmt(r.amount)}</td>
                  <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">{r.start_date}</td>
                  <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">{r.end_date ?? 'Ongoing'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.is_active ? 'bg-[#E7F8EE] text-[#15803D]' : 'bg-[#F1F5F9] text-[#94A3B8]'}`}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setEditItem(r)} className="rounded px-2 py-1 text-[11px] text-[#64748B] hover:bg-[#F1F5F9]">
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggle(r.id, r.is_active)}
                        disabled={isPending}
                        className="rounded px-2 py-1 text-[11px] text-[#64748B] hover:bg-[#F1F5F9] disabled:opacity-50"
                      >
                        {r.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <DeleteRecurBtn id={r.id} onSuccess={onRefresh} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <RecurringModal
          branches={branches}
          groups={groups}
          onClose={() => setAddOpen(false)}
          onSuccess={onRefresh}
        />
      )}

      {editItem && (
        <RecurringModal
          editItem={editItem}
          branches={branches}
          groups={groups}
          onClose={() => setEditItem(null)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  )
}

function DeleteRecurBtn({ id, onSuccess }: { id: string; onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState(false)
  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)} className="rounded px-2 py-1 text-[11px] text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEE2E2]">
        Delete
      </button>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => startTransition(async () => { await deleteRecurringExpense(id); onSuccess() })}
        disabled={isPending}
        className="rounded px-2 py-1 text-[11px] font-semibold text-[#EF4444] bg-[#FEE2E2] hover:bg-[#FEE2E2] disabled:opacity-50"
      >
        {isPending ? '…' : 'Confirm'}
      </button>
      <button onClick={() => setConfirm(false)} className="rounded px-2 py-1 text-[11px] text-[#94A3B8]">Cancel</button>
    </div>
  )
}
