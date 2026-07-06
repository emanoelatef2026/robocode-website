'use client'

import { useState, useTransition } from 'react'
import { addRecurringExpense, updateRecurringExpense } from '@/modules/finance/actions'
import type {
  ExpenseScope, ExpenseType, RecurringExpense, AddRecurringExpenseInput,
} from '@/modules/finance/types'
import {
  EXPENSE_TYPE_LABELS,
  GROUP_EXPENSE_TYPES, BRANCH_EXPENSE_TYPES, ACADEMY_EXPENSE_TYPES,
} from '@/modules/finance/types'
import { Modal, type Branch, type Group } from '../components/shared'

export function RecurringModal({
  scope,
  editItem,
  branches,
  groups,
  onClose,
  onSuccess,
}: {
  scope?:    ExpenseScope
  editItem?: RecurringExpense
  branches:  Branch[]
  groups:    Group[]
  onClose:   () => void
  onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [selScope,  setSelScope]  = useState<ExpenseScope>(editItem?.expense_scope ?? scope ?? 'GROUP')
  const typeOptions = selScope === 'GROUP' ? GROUP_EXPENSE_TYPES : selScope === 'BRANCH' ? BRANCH_EXPENSE_TYPES : ACADEMY_EXPENSE_TYPES
  const [type,      setType]      = useState<ExpenseType>(editItem?.expense_type ?? typeOptions[0])
  const [amount,    setAmount]    = useState(editItem?.amount.toString() ?? '')
  const [startDate, setStartDate] = useState(editItem?.start_date ?? new Date().toISOString().slice(0, 10))
  const [endDate,   setEndDate]   = useState(editItem?.end_date ?? '')
  const [notes,     setNotes]     = useState(editItem?.notes ?? '')
  const [groupId,   setGroupId]   = useState(editItem?.group_id  ?? '')
  const [branchId,  setBranchId]  = useState(editItem?.branch_id ?? '')

  const activeGroups = groups.filter(g => g.status === 'active')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const amt = Number(amount)
    if (amt <= 0) return setError('Amount must be > 0.')
    if (!startDate) return setError('Start date is required.')
    if (selScope === 'GROUP'  && !groupId)  return setError('Select a group.')
    if (selScope === 'BRANCH' && !branchId) return setError('Select a branch.')

    const input: AddRecurringExpenseInput = {
      expense_scope: selScope,
      expense_type:  type,
      amount:        amt,
      start_date:    startDate,
      end_date:      endDate || undefined,
      notes:         notes   || undefined,
      ...(selScope === 'GROUP'  && { group_id:  groupId  }),
      ...(selScope === 'BRANCH' && { branch_id: branchId }),
    }

    startTransition(async () => {
      const res = editItem
        ? await updateRecurringExpense(editItem.id, input)
        : await addRecurringExpense(input)
      if (res && 'error' in res) return setError(res.error ?? 'Error')
      onSuccess()
      onClose()
    })
  }

  return (
    <Modal title={editItem ? 'Edit Recurring Expense' : 'Add Recurring Expense'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Scope *</label>
            <select
              value={selScope} onChange={e => { setSelScope(e.target.value as ExpenseScope); setType(GROUP_EXPENSE_TYPES[0]) }}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
            >
              <option value="GROUP">Group</option>
              <option value="BRANCH">Branch</option>
              <option value="ACADEMY">Academy</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Type *</label>
            <select
              value={type} onChange={e => setType(e.target.value as ExpenseType)}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
            >
              {typeOptions.map(t => <option key={t} value={t}>{EXPENSE_TYPE_LABELS[t]}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Monthly Amount (EGP) *</label>
            <input
              type="number" min="1" step="0.01" required
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Start Date *</label>
            <input
              type="date" required
              value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">End Date (optional)</label>
            <input
              type="date"
              value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
            />
          </div>

          {selScope === 'GROUP' && (
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

          {selScope === 'BRANCH' && (
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
          <button type="button" onClick={onClose}
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs font-medium text-[#64748B] hover:bg-[#F8FAFC]">
            Cancel
          </button>
          <button type="submit" disabled={isPending}
            className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#e07a1a] disabled:opacity-50">
            {isPending ? 'Saving…' : editItem ? 'Update' : 'Add Recurring'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
