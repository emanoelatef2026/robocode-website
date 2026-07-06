'use client'

import { useState, useTransition } from 'react'
import { addExpense, updateExpense } from '@/modules/finance/actions'
import type {
  ExpenseScope, ExpenseType, AddExpenseInput,
} from '@/modules/finance/types'
import {
  EXPENSE_TYPE_LABELS, EXPENSE_SCOPE_LABELS,
  GROUP_EXPENSE_TYPES, BRANCH_EXPENSE_TYPES, ACADEMY_EXPENSE_TYPES,
} from '@/modules/finance/types'
import { Modal, type Branch, type Group } from '../components/shared'

export function ExpenseModal({
  scope,
  expenseId,
  defaultGroupId,
  defaultBranchId,
  initialValues,
  branches,
  groups,
  onClose,
  onSuccess,
}: {
  scope:            ExpenseScope
  expenseId?:       string
  defaultGroupId?:  string
  defaultBranchId?: string
  initialValues?:   Partial<AddExpenseInput>
  branches:         Branch[]
  groups:           Group[]
  onClose:          () => void
  onSuccess:        () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const typeOptions: ExpenseType[] =
    scope === 'GROUP'   ? GROUP_EXPENSE_TYPES  :
    scope === 'BRANCH'  ? BRANCH_EXPENSE_TYPES :
                          ACADEMY_EXPENSE_TYPES

  const [type, setType]     = useState<ExpenseType>(initialValues?.expense_type ?? typeOptions[0])
  const [amount, setAmount] = useState(initialValues?.amount?.toString() ?? '')
  const [date, setDate]     = useState(initialValues?.expense_date ?? new Date().toISOString().slice(0, 10))
  const [notes, setNotes]   = useState(initialValues?.notes ?? '')
  const [groupId,  setGroupId]  = useState(defaultGroupId  ?? initialValues?.group_id  ?? '')
  const [branchId, setBranchId] = useState(defaultBranchId ?? initialValues?.branch_id ?? '')

  const activeGroups = groups.filter(g => g.status === 'active')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const amt = Number(amount)
    if (!type)        return setError('Select expense type.')
    if (amt <= 0)     return setError('Amount must be > 0.')
    if (!date)        return setError('Select a date.')
    if (scope === 'GROUP'  && !groupId)  return setError('Select a group.')
    if (scope === 'BRANCH' && !branchId) return setError('Select a branch.')

    const input: AddExpenseInput = {
      expense_scope: scope,
      expense_type:  type,
      amount:        amt,
      expense_date:  date,
      notes:         notes || undefined,
      ...(scope === 'GROUP'  && { group_id:  groupId  }),
      ...(scope === 'BRANCH' && { branch_id: branchId }),
    }

    startTransition(async () => {
      const res = expenseId
        ? await updateExpense(expenseId, input)
        : await addExpense(input)
      if (res && 'error' in res) return setError(res.error ?? 'Error')
      onSuccess()
      onClose()
    })
  }

  return (
    <Modal title={expenseId ? 'Edit Expense' : `Add ${EXPENSE_SCOPE_LABELS[scope]}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Expense Type *</label>
            <select
              value={type} onChange={e => setType(e.target.value as ExpenseType)}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
            >
              {typeOptions.map(t => <option key={t} value={t}>{EXPENSE_TYPE_LABELS[t]}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Amount (EGP) *</label>
            <input
              type="number" min="1" step="0.01" required
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Date *</label>
            <input
              type="date" required
              value={date} onChange={e => setDate(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
            />
          </div>

          {scope === 'GROUP' && (
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Group *</label>
              <select
                value={groupId} onChange={e => setGroupId(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
              >
                <option value="">Select group…</option>
                {activeGroups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.branch_name})</option>)}
              </select>
            </div>
          )}

          {scope === 'BRANCH' && (
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Branch *</label>
              <select
                value={branchId} onChange={e => setBranchId(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
              >
                <option value="">Select branch…</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">Notes</label>
          <textarea
            rows={2} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes…"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none resize-none"
          />
        </div>

        {error && <p className="rounded-lg bg-[#FEE2E2] px-3 py-2 text-xs text-[#EF4444]">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button" onClick={onClose}
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs font-medium text-[#64748B] hover:bg-[#F8FAFC]"
          >
            Cancel
          </button>
          <button
            type="submit" disabled={isPending}
            className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#e07a1a] disabled:opacity-50"
          >
            {isPending ? 'Saving…' : expenseId ? 'Update' : 'Save Expense'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
