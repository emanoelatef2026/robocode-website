'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter }    from 'next/navigation'
import * as XLSX from 'xlsx'
import {
  addExpense, updateExpense, deleteExpense,
  addRecurringExpense, updateRecurringExpense, toggleRecurringExpense, deleteRecurringExpense,
} from '@/modules/finance/actions'
import type {
  FinancialExpense, RecurringExpense,
  ExpenseScope, ExpenseType, AddExpenseInput, AddRecurringExpenseInput,
  GroupPnL, BranchPnL, AcademyPnL,
} from '@/modules/finance/types'
import {
  EXPENSE_TYPE_LABELS, EXPENSE_SCOPE_LABELS,
  GROUP_EXPENSE_TYPES, BRANCH_EXPENSE_TYPES, ACADEMY_EXPENSE_TYPES,
} from '@/modules/finance/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Branch { id: string; name: string }
interface Group  { id: string; name: string; branch_id: string; branch_name: string; status: string }

interface Props {
  groupRows:       GroupPnL[]
  branchRows:      BranchPnL[]
  academyPnL:      AcademyPnL
  expenses:        FinancialExpense[]
  recurring:       RecurringExpense[]
  branches:        Branch[]
  groups:          Group[]
  activeTab:       string
  currentBranchId: string
  currentDateFrom: string
  currentDateTo:   string
  includeArchived: boolean
  isSuperAdmin:    boolean
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `EGP ${new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)}`
}

function fmtK(n: number) {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}EGP ${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}EGP ${(abs / 1_000).toFixed(0)}K`
  return fmt(n)
}

function ProfitBadge({ value, size = 'sm' }: { value: number; size?: 'sm' | 'xs' }) {
  const pos = value >= 0
  const cls = pos ? 'text-emerald-700' : 'text-red-600'
  const text = size === 'sm' ? 'text-sm font-bold' : 'text-xs font-semibold'
  return (
    <span className={`${text} ${cls}`}>
      {value < 0 ? '−' : '+'}{fmt(Math.abs(value))}
    </span>
  )
}

function RateBadge({ rate }: { rate: number }) {
  const cls = rate >= 80 ? 'bg-emerald-50 text-emerald-700' : rate >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{rate}%</span>
}

// ── Excel export helpers ───────────────────────────────────────────────────────

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename)
}

function exportGroupsExcel(rows: GroupPnL[]) {
  const data = rows.map(r => ({
    'Group':                   r.group_name,
    'Branch':                  r.branch_name,
    'Status':                  r.group_status,
    'Course':                  r.course_name ?? '',
    'Instructor':              r.instructor_name ?? '',
    'Students':                r.student_count,
    'Share %':                 r.robocode_share_percent,
    'Total Sessions':          r.total_sessions,
    'Completed Sessions':      r.completed_sessions,
    'Remaining Sessions':      r.remaining_sessions,
    'Session Rate (EGP)':      r.session_rate,
    'Gross Expected (EGP)':    r.gross_expected_revenue,
    'Gross Collected (EGP)':   r.gross_collected_revenue,
    'Net Expected (EGP)':      r.net_expected_revenue,
    'Net Collected (EGP)':     r.net_collected_revenue,
    'Outstanding (EGP)':       r.outstanding,
    'Collection Rate':         `${r.collection_rate}%`,
    'Instr. Earned (EGP)':     r.instructor_earned,
    'Instr. Paid (EGP)':       r.instructor_paid,
    'Instr. Remaining (EGP)':  r.instructor_remaining,
    'Future Liability (EGP)':  r.future_liability,
    'Final Instr. Cost (EGP)': r.final_instructor_cost,
    'Manual Exp (EGP)':        r.manual_expenses,
    'Recur. Exp (EGP)':        r.recurring_expenses,
    'Total Exp (EGP)':         r.total_expenses,
    'Exp. Profit (EGP)':       r.expected_profit,
    'Act. Profit (EGP)':       r.actual_profit,
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Groups')
  downloadWorkbook(wb, `groups-pnl-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function exportBranchesExcel(rows: BranchPnL[]) {
  const data = rows.map(r => ({
    'Branch':                  r.branch_name,
    'Groups':                  r.group_count,
    'Students':                r.student_count,
    'Gross Expected (EGP)':    r.gross_expected_revenue,
    'Gross Collected (EGP)':   r.gross_collected_revenue,
    'Net Expected (EGP)':      r.net_expected_revenue,
    'Net Collected (EGP)':     r.net_collected_revenue,
    'Outstanding (EGP)':       r.outstanding,
    'Collection Rate':         `${r.collection_rate}%`,
    'Instr. Earned (EGP)':     r.instructor_earned,
    'Instr. Paid (EGP)':       r.instructor_paid,
    'Instr. Remaining (EGP)':  r.instructor_remaining,
    'Future Liability (EGP)':  r.future_liability,
    'Final Instr. Cost (EGP)': r.final_instructor_cost,
    'Branch Exp (EGP)':        r.branch_expenses,
    'Group Exp (EGP)':         r.group_expenses,
    'Total Exp (EGP)':         r.total_expenses,
    'Exp. Profit (EGP)':       r.expected_profit,
    'Act. Profit (EGP)':       r.actual_profit,
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Branches')
  downloadWorkbook(wb, `branches-pnl-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function exportAcademyExcel(academy: AcademyPnL) {
  const summary = [{
    'Metric': 'Academy P&L Summary', 'Value (EGP)': '',
  }, {
    'Metric': 'Gross Expected Revenue',   'Value (EGP)': academy.gross_expected_revenue,
  }, {
    'Metric': 'Gross Collected Revenue',  'Value (EGP)': academy.gross_collected_revenue,
  }, {
    'Metric': 'Net Expected Revenue',     'Value (EGP)': academy.net_expected_revenue,
  }, {
    'Metric': 'Net Collected Revenue',    'Value (EGP)': academy.net_collected_revenue,
  }, {
    'Metric': 'Outstanding',              'Value (EGP)': academy.outstanding,
  }, {
    'Metric': 'Collection Rate',          'Value (EGP)': `${academy.collection_rate}%`,
  }, {
    'Metric': 'Instructor Earned',        'Value (EGP)': academy.instructor_earned,
  }, {
    'Metric': 'Instructor Paid',          'Value (EGP)': academy.instructor_paid,
  }, {
    'Metric': 'Instructor Remaining',     'Value (EGP)': academy.instructor_remaining,
  }, {
    'Metric': 'Future Liability',         'Value (EGP)': academy.future_liability,
  }, {
    'Metric': 'Final Instructor Cost',    'Value (EGP)': academy.final_instructor_cost,
  }, {
    'Metric': 'Branch Expenses',          'Value (EGP)': academy.branch_expenses,
  }, {
    'Metric': 'Group Expenses',           'Value (EGP)': academy.group_expenses,
  }, {
    'Metric': 'Academy Expenses',         'Value (EGP)': academy.academy_expenses,
  }, {
    'Metric': 'Total Expenses',           'Value (EGP)': academy.total_expenses,
  }, {
    'Metric': 'Expected Profit',          'Value (EGP)': academy.expected_profit,
  }, {
    'Metric': 'Actual Profit',            'Value (EGP)': academy.actual_profit,
  }]

  const trend = academy.monthly_trend.map(m => ({
    'Month':                    m.label,
    'Gross Expected (EGP)':     m.gross_expected_revenue,
    'Gross Collected (EGP)':    m.gross_collected_revenue,
    'Net Collected (EGP)':      m.net_collected_revenue,
    'Instr. Earned (EGP)':      m.instructor_earned,
    'Other Exp (EGP)':          m.other_expenses,
    'Total Exp (EGP)':          m.total_expenses,
    'Act. Profit (EGP)':        m.actual_profit,
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trend),   'Monthly Trend')
  downloadWorkbook(wb, `academy-pnl-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <h2 className="text-base font-semibold text-[#0B1F3A]">{title}</h2>
          <button onClick={onClose} className="text-xl text-[#94A3B8] hover:text-[#64748B] leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ── Add/Edit Expense Modal ─────────────────────────────────────────────────────

function ExpenseModal({
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

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

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

// ── Add Recurring Expense Modal ────────────────────────────────────────────────

function RecurringModal({
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

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

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

// ── Group Detail Modal ─────────────────────────────────────────────────────────

function GroupDetailModal({
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
                  <p className="text-sm font-bold text-red-600">{fmt(amt)}</p>
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
                <thead>
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
                      <td className="px-3 py-2 text-right font-semibold text-red-600">{fmt(e.amount)}</td>
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

// ── Delete button ─────────────────────────────────────────────────────────────

function DeleteBtn({ id, onSuccess }: { id: string; onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState(false)
  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)} className="rounded px-2 py-1 text-[11px] text-[#94A3B8] hover:text-red-600 hover:bg-red-50">
        Delete
      </button>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => startTransition(async () => { await deleteExpense(id); onSuccess() })}
        disabled={isPending}
        className="rounded px-2 py-1 text-[11px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50"
      >
        {isPending ? '…' : 'Confirm'}
      </button>
      <button onClick={() => setConfirm(false)} className="rounded px-2 py-1 text-[11px] text-[#94A3B8]">Cancel</button>
    </div>
  )
}

// ── Live Filter Bar ────────────────────────────────────────────────────────────

function LiveFilterBar({
  branches, currentBranchId, currentDateFrom, currentDateTo, includeArchived, activeTab,
}: {
  branches:        Branch[]
  currentBranchId: string
  currentDateFrom: string
  currentDateTo:   string
  includeArchived: boolean
  activeTab:       string
}) {
  const router = useRouter()
  const [from, setFrom] = useState(currentDateFrom)
  const [to,   setTo]   = useState(currentDateTo)

  function navigate(overrides: { branch?: string; from?: string; to?: string; archived?: boolean } = {}) {
    const branch   = overrides.branch   ?? currentBranchId
    const f        = overrides.from     ?? from
    const t        = overrides.to       ?? to
    const archived = overrides.archived ?? includeArchived
    const params = new URLSearchParams({ tab: activeTab })
    if (branch)   params.set('branch_id', branch)
    if (f)        params.set('date_from',  f)
    if (t)        params.set('date_to',    t)
    if (archived) params.set('archived',   '1')
    router.push(`/admin/expenses?${params.toString()}`)
  }

  function preset(p: string) {
    const today = new Date()
    let f = '', t = today.toISOString().slice(0, 10)
    if (p === 'month') {
      f = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
      t = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)
    } else if (p === 'year') {
      f = `${today.getFullYear()}-01-01`; t = `${today.getFullYear()}-12-31`
    } else if (p === '3m') {
      f = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10)
    } else if (p === '6m') {
      f = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().slice(0, 10)
    }
    setFrom(f); setTo(t)
    navigate({ from: f, to: t })
  }

  function clear() {
    setFrom(''); setTo('')
    router.push(`/admin/expenses?tab=${activeTab}`)
  }

  // Filter status labels for the indicator
  const activeBranch   = branches.find(b => b.id === currentBranchId)
  const hasDateFilter  = !!(currentDateFrom || currentDateTo)
  const hasFilters     = !!(currentBranchId || currentDateFrom || currentDateTo)
  const filterParts: string[] = []
  if (activeBranch)   filterParts.push(`Branch: ${activeBranch.name}`)
  if (hasDateFilter)  filterParts.push(`Period: ${currentDateFrom || '…'} → ${currentDateTo || '…'}`)

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {/* Branch — live on change */}
        <select
          value={currentBranchId}
          onChange={e => navigate({ branch: e.target.value })}
          className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs focus:border-[#FF8A1F] focus:outline-none min-w-[130px]"
        >
          <option value="">All Branches</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        {/* Date presets — live on click */}
        {(['month', 'year', '3m', '6m'] as const).map(p => {
          const isActive =
            p === 'month' && currentDateFrom === new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10) ? true :
            p === 'year'  && currentDateFrom === `${new Date().getFullYear()}-01-01` ? true : false
          return (
            <button key={p} onClick={() => preset(p)}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                isActive
                  ? 'border-[#FF8A1F] bg-orange-50 text-[#FF8A1F]'
                  : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0B1F3A]'
              }`}>
              {p === 'month' ? 'This Month' : p === 'year' ? 'This Year' : p === '3m' ? 'Last 3M' : 'Last 6M'}
            </button>
          )
        })}

        {/* Custom date range — live on blur (avoids mid-type navigations) */}
        <div className="flex items-center gap-1">
          <input
            type="date" value={from}
            onChange={e => setFrom(e.target.value)}
            onBlur={() => from !== currentDateFrom && navigate({ from })}
            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs focus:border-[#FF8A1F] focus:outline-none"
          />
          <span className="text-xs text-[#94A3B8]">—</span>
          <input
            type="date" value={to}
            onChange={e => setTo(e.target.value)}
            onBlur={() => to !== currentDateTo && navigate({ to })}
            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs focus:border-[#FF8A1F] focus:outline-none"
          />
        </div>

        {hasFilters && (
          <button onClick={clear} className="text-[11px] text-[#94A3B8] hover:text-red-500 underline">
            Clear filters
          </button>
        )}
      </div>

      {/* Filter status indicator */}
      <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] ${hasFilters ? 'bg-orange-50 text-[#FF8A1F]' : 'bg-[#F8FAFC] text-[#94A3B8]'}`}>
        <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${hasFilters ? 'bg-[#FF8A1F]' : 'bg-[#CBD5E1]'}`} />
        {hasFilters
          ? <span><b>Filters Active:</b> {filterParts.join(' · ')}</span>
          : <span>No filters applied — showing all data</span>
        }
      </div>
    </div>
  )
}

// ── Status badge ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-emerald-50 text-emerald-700',
  forming:   'bg-blue-50 text-blue-700',
  completed: 'bg-slate-100 text-slate-600',
  archived:  'bg-gray-100 text-gray-500',
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>
      {status}
    </span>
  )
}

const ALL_STATUSES = ['all', 'active', 'forming', 'completed', 'archived'] as const
type StatusFilter = typeof ALL_STATUSES[number]

// ── Groups Tab ─────────────────────────────────────────────────────────────────

function GroupsTab({
  rows, expenses, recurring, branches, groups, onRefresh,
}: {
  rows:      GroupPnL[]
  expenses:  FinancialExpense[]
  recurring: RecurringExpense[]
  branches:  Branch[]
  groups:    Group[]
  onRefresh: () => void
}) {
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortCol,      setSortCol]      = useState<keyof GroupPnL>('gross_expected_revenue')
  const [sortAsc,      setSortAsc]      = useState(false)
  const [detailId,     setDetailId]     = useState<string | null>(null)
  const [addOpen,      setAddOpen]      = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows
      .filter(r => {
        if (statusFilter !== 'all' && r.group_status !== statusFilter) return false
        if (q && !r.group_name.toLowerCase().includes(q) && !r.branch_name.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => {
        const av = a[sortCol] as number, bv = b[sortCol] as number
        return sortAsc ? av - bv : bv - av
      })
  }, [rows, search, statusFilter, sortCol, sortAsc])

  function toggleSort(col: keyof GroupPnL) {
    if (sortCol === col) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(false) }
  }

  const SortTh = ({ col, label }: { col: keyof GroupPnL; label: string }) => (
    <th
      className="px-3 py-3 text-right text-[11px] font-medium text-[#64748B] whitespace-nowrap cursor-pointer hover:text-[#0B1F3A] select-none"
      onClick={() => toggleSort(col)}
    >
      {label}{sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  const detailGroup = detailId ? rows.find(r => r.group_id === detailId) : null

  // Summary KPIs (from filtered rows)
  const totalGrossExpRev = filtered.reduce((s, r) => s + r.gross_expected_revenue, 0)
  const totalNetColRev   = filtered.reduce((s, r) => s + r.net_collected_revenue,  0)
  const totalEarned      = filtered.reduce((s, r) => s + r.instructor_earned,      0)
  const totalFinalCost   = filtered.reduce((s, r) => s + r.final_instructor_cost,  0)
  const totalProfit      = filtered.reduce((s, r) => s + r.actual_profit,          0)

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Gross Expected',    value: fmtK(totalGrossExpRev), color: 'bg-slate-400' },
          { label: 'Net Collected',     value: fmtK(totalNetColRev),   color: 'bg-emerald-400' },
          { label: 'Instr. Earned',     value: fmtK(totalEarned),      color: 'bg-violet-400' },
          { label: 'Final Instr. Cost', value: fmtK(totalFinalCost),   color: 'bg-orange-400' },
          { label: 'Actual Profit',     value: fmtK(totalProfit),      color: totalProfit >= 0 ? 'bg-emerald-400' : 'bg-red-400' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <div className={`mb-2 h-1.5 w-8 rounded-full ${k.color} opacity-80`} />
            <p className={`text-xl font-bold ${k.label === 'Actual Profit' && totalProfit < 0 ? 'text-red-600' : 'text-[#0B1F3A]'}`}>{k.value}</p>
            <p className="mt-0.5 text-xs text-[#64748B]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {ALL_STATUSES.map(s => {
          const count = s === 'all' ? rows.length : rows.filter(r => r.group_status === s).length
          const isActive = statusFilter === s
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition border ${
                isActive
                  ? 'border-[#FF8A1F] bg-orange-50 text-[#FF8A1F]'
                  : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)} ({count})
            </button>
          )
        })}
      </div>

      {/* Search + actions */}
      <div className="flex items-center gap-2">
        <input
          type="text" placeholder="Search groups…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none max-w-xs"
        />
        <button
          onClick={() => exportGroupsExcel(filtered)}
          className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0B1F3A] transition"
          title="Export visible rows to Excel"
        >
          ↓ Excel
        </button>
        <button
          onClick={() => setAddOpen(true)}
          className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#e07a1a]"
        >
          + Add Group Expense
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-2.5">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            Group P&L Dashboard · {filtered.length} groups
          </p>
        </div>
        <table className="w-full text-sm min-w-[1600px]">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="px-3 py-3 text-left text-[11px] font-medium text-[#64748B]">Group</th>
              <th className="px-3 py-3 text-left text-[11px] font-medium text-[#64748B]">Branch</th>
              <th className="px-3 py-3 text-center text-[11px] font-medium text-[#64748B]">Status</th>
              <th className="px-3 py-3 text-center text-[11px] font-medium text-[#64748B]">Students</th>
              <th className="px-3 py-3 text-center text-[11px] font-medium text-[#64748B]">Share %</th>
              <SortTh col="gross_expected_revenue" label="Gross Expected" />
              <SortTh col="gross_collected_revenue" label="Gross Collected" />
              <SortTh col="net_expected_revenue"   label="Net Expected" />
              <SortTh col="net_collected_revenue"  label="Net Collected" />
              <SortTh col="outstanding"          label="Outstanding" />
              <SortTh col="instructor_earned"    label="Instr. Earned" />
              <SortTh col="instructor_paid"      label="Instr. Paid" />
              <SortTh col="instructor_remaining" label="Instr. Owing" />
              <SortTh col="future_liability"     label="Future Liab." />
              <SortTh col="final_instructor_cost" label="Final Instr." />
              <SortTh col="manual_expenses"      label="Manual Exp" />
              <SortTh col="total_expenses"       label="Total Exp" />
              <SortTh col="expected_profit"      label="Exp. Profit" />
              <SortTh col="actual_profit"        label="Act. Profit" />
              <th className="px-3 py-3 text-center text-[11px] font-medium text-[#64748B]">Rate</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(g => (
              <tr
                key={g.group_id}
                className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] cursor-pointer"
                onClick={() => setDetailId(g.group_id)}
              >
                <td className="px-3 py-3 font-semibold text-[#0B1F3A] whitespace-nowrap max-w-[140px] truncate">
                  {g.group_name}
                </td>
                <td className="px-3 py-3 text-[#64748B] whitespace-nowrap">{g.branch_name}</td>
                <td className="px-3 py-3 text-center"><StatusBadge status={g.group_status} /></td>
                <td className="px-3 py-3 text-center text-[#64748B]">{g.student_count}</td>
                <td className="px-3 py-3 text-center">
                  <span className={`font-semibold text-xs ${g.robocode_share_percent < 100 ? 'text-amber-600' : 'text-[#94A3B8]'}`}>
                    {g.robocode_share_percent}%
                  </span>
                </td>
                <td className="px-3 py-3 text-right text-[#0B1F3A]">{fmt(g.gross_expected_revenue)}</td>
                <td className="px-3 py-3 text-right text-[#0B1F3A]">{fmt(g.gross_collected_revenue)}</td>
                <td className="px-3 py-3 text-right font-medium text-emerald-700">{fmt(g.net_expected_revenue)}</td>
                <td className="px-3 py-3 text-right font-medium text-emerald-700">{fmt(g.net_collected_revenue)}</td>
                <td className="px-3 py-3 text-right text-amber-600">{fmt(g.outstanding)}</td>
                <td className="px-3 py-3 text-right text-violet-700">{fmt(g.instructor_earned)}</td>
                <td className="px-3 py-3 text-right text-emerald-700">{fmt(g.instructor_paid)}</td>
                <td className="px-3 py-3 text-right text-orange-600">{fmt(g.instructor_remaining)}</td>
                <td className="px-3 py-3 text-right text-rose-600">{fmt(g.future_liability)}</td>
                <td className="px-3 py-3 text-right font-semibold text-red-700">{fmt(g.final_instructor_cost)}</td>
                <td className="px-3 py-3 text-right text-indigo-700">{fmt(g.manual_expenses)}</td>
                <td className="px-3 py-3 text-right text-red-600 font-medium">{fmt(g.total_expenses)}</td>
                <td className="px-3 py-3 text-right"><ProfitBadge value={g.expected_profit} size="xs" /></td>
                <td className="px-3 py-3 text-right"><ProfitBadge value={g.actual_profit}   size="xs" /></td>
                <td className="px-3 py-3 text-center"><RateBadge rate={g.collection_rate} /></td>
                <td className="px-3 py-3">
                  <button
                    onClick={ev => { ev.stopPropagation(); setDetailId(g.group_id) }}
                    className="text-[11px] font-medium text-[#FF8A1F] hover:underline whitespace-nowrap"
                  >
                    Details →
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={22} className="px-4 py-10 text-center text-sm text-[#94A3B8]">
                  No groups match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Group detail modal */}
      {detailId && detailGroup && (
        <GroupDetailModal
          groupId={detailId}
          groupName={detailGroup.group_name}
          expenses={expenses}
          recurring={recurring}
          branches={branches}
          groups={groups}
          onClose={() => setDetailId(null)}
          onRefresh={onRefresh}
        />
      )}

      {addOpen && (
        <ExpenseModal
          scope="GROUP"
          branches={branches}
          groups={groups}
          onClose={() => setAddOpen(false)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  )
}

// ── Branches Tab ───────────────────────────────────────────────────────────────

function BranchesTab({
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
          { l: 'Gross Expected',  v: fmtK(rows.reduce((s,b) => s + b.gross_expected_revenue,  0)), c: 'bg-slate-400' },
          { l: 'Net Collected',   v: fmtK(rows.reduce((s,b) => s + b.net_collected_revenue,   0)), c: 'bg-emerald-400' },
          { l: 'Total Expenses',  v: fmtK(rows.reduce((s,b) => s + b.total_expenses,          0)), c: 'bg-red-400' },
          { l: 'Actual Profit',   v: fmtK(rows.reduce((s,b) => s + b.actual_profit,           0)), c: rows.reduce((s,b) => s+b.actual_profit,0) >= 0 ? 'bg-emerald-400' : 'bg-red-400' },
        ].map(k => (
          <div key={k.l} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <div className={`mb-2 h-1.5 w-8 rounded-full ${k.c} opacity-80`} />
            <p className="text-xl font-bold text-[#0B1F3A]">{k.v}</p>
            <p className="mt-0.5 text-xs text-[#64748B]">{k.l}</p>
          </div>
        ))}
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <button
          onClick={() => exportBranchesExcel(rows)}
          className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0B1F3A] transition"
        >
          ↓ Export Excel
        </button>
      </div>

      {/* Branch cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(b => (
          <div key={b.branch_id} className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#0B1F3A]">{b.branch_name}</p>
                <p className="text-[11px] text-[#94A3B8]">{b.student_count} students · {b.group_count} groups</p>
              </div>
              <RateBadge rate={b.collection_rate} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div><p className="text-[#94A3B8]">Gross Expected</p><p className="font-semibold text-[#0B1F3A]">{fmt(b.gross_expected_revenue)}</p></div>
              <div><p className="text-[#94A3B8]">Net Collected</p><p className="font-semibold text-emerald-700">{fmt(b.net_collected_revenue)}</p></div>
              <div><p className="text-[#94A3B8]">Outstanding</p><p className="font-semibold text-amber-600">{fmt(b.outstanding)}</p></div>
              <div><p className="text-[#94A3B8]">Total Expenses</p><p className="font-semibold text-red-600">{fmt(b.total_expenses)}</p></div>
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
                    <span className="font-medium text-blue-700">{fmt(b.branch_expenses)}</span>
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
                className={`h-full rounded-full ${b.collection_rate >= 80 ? 'bg-emerald-400' : b.collection_rate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
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
          <div className="col-span-3 rounded-xl border border-[#E2E8F0] bg-white py-14 text-center">
            <p className="text-sm text-[#94A3B8]">No branches found.</p>
          </div>
        )}
      </div>

      {/* Branch expense history table */}
      {expenses.filter(e => e.expense_scope === 'BRANCH').length > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
          <div className="border-b border-[#E2E8F0] px-4 py-2.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">Branch Expense History</p>
          </div>
          <table className="w-full text-sm">
            <thead>
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
                <tr key={e.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">
                    {new Date(e.expense_date).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">{e.branch_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-medium text-[#64748B]">
                      {EXPENSE_TYPE_LABELS[e.expense_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{fmt(e.amount)}</td>
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

// ── Academy Tab ────────────────────────────────────────────────────────────────

function AcademyTab({
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
          { l: 'Gross Expected',    v: fmtK(pnl.gross_expected_revenue),  c: 'bg-slate-400' },
          { l: 'Net Collected',     v: fmtK(pnl.net_collected_revenue),   c: 'bg-emerald-400' },
          { l: 'Outstanding',       v: fmtK(pnl.outstanding),             c: 'bg-amber-400' },
          { l: 'Total Expenses',    v: fmtK(pnl.total_expenses),          c: 'bg-red-400' },
          { l: 'Expected Profit',   v: fmtK(pnl.expected_profit),   c: pnl.expected_profit >= 0 ? 'bg-emerald-400' : 'bg-red-400', neg: pnl.expected_profit < 0 },
          { l: 'Actual Profit',     v: fmtK(pnl.actual_profit),     c: pnl.actual_profit >= 0 ? 'bg-emerald-400' : 'bg-red-400',   neg: pnl.actual_profit < 0 },
        ].map(k => (
          <div key={k.l} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <div className={`mb-2 h-1.5 w-8 rounded-full ${k.c} opacity-80`} />
            <p className={`text-xl font-bold ${'neg' in k && k.neg ? 'text-red-600' : 'text-[#0B1F3A]'}`}>{k.v}</p>
            <p className="mt-0.5 text-xs text-[#64748B]">{k.l}</p>
          </div>
        ))}
      </div>

      {/* Expense breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { l: 'Instr. Earned',    v: fmt(pnl.instructor_earned),    c: 'text-violet-600' },
          { l: 'Instr. Paid',      v: fmt(pnl.instructor_paid),      c: 'text-emerald-600' },
          { l: 'Future Liability', v: fmt(pnl.future_liability),     c: 'text-rose-600' },
          { l: 'Group Expenses',   v: fmt(pnl.group_expenses + pnl.group_recurring_expenses),   c: 'text-indigo-600' },
          { l: 'Branch Expenses',  v: fmt(pnl.branch_expenses + pnl.branch_recurring_expenses), c: 'text-blue-600' },
          { l: 'Academy Expenses', v: fmt(pnl.academy_expenses + pnl.academy_recurring_expenses), c: 'text-cyan-600' },
        ].map(k => (
          <div key={k.l} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">{k.l}</p>
            <p className={`mt-1 text-base font-bold ${k.c}`}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Monthly trend */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">Monthly Trend — Last 6 Months</p>
          <div className="flex items-center gap-4 text-[11px] text-[#64748B]">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-400" /> Collected</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-400" /> Expenses</span>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-end gap-3">
            {pnl.monthly_trend.map(m => {
              const cH = maxBar > 0 ? Math.round((m.net_collected_revenue / maxBar) * 100) : 2
              const eH = maxBar > 0 ? Math.round((m.total_expenses / maxBar) * 100) : 2
              return (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                  <p className={`text-[10px] font-semibold ${m.actual_profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {m.actual_profit >= 0 ? '+' : '−'}{fmtK(Math.abs(m.actual_profit)).replace('EGP ', '')}
                  </p>
                  <div className="flex w-full items-end gap-0.5">
                    <div className="flex-1 rounded-t-sm bg-emerald-400" style={{ height: `${Math.max(cH, 2)}px` }} />
                    <div className="flex-1 rounded-t-sm bg-red-400"     style={{ height: `${Math.max(eH, 2)}px` }} />
                  </div>
                  <p className="text-[10px] text-[#94A3B8]">{m.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Academy expenses */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
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
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                {['Date', 'Type', 'Amount', 'Notes', ''].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-medium text-[#64748B] ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {acExp.map(e => (
                <tr key={e.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3 text-[#64748B]">
                    {new Date(e.expense_date).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-medium text-[#64748B]">
                      {EXPENSE_TYPE_LABELS[e.expense_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{fmt(e.amount)}</td>
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

// ── Recurring Tab ──────────────────────────────────────────────────────────────

function RecurringTab({
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
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">Active Recurring</p>
          <p className="mt-1 text-xl font-bold text-[#0B1F3A]">{active.length}</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">Monthly Commitment</p>
          <p className="mt-1 text-xl font-bold text-red-600">{fmt(monthlyTotal)}</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
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
        <div className="rounded-xl border border-[#E2E8F0] bg-white py-14 text-center">
          <p className="text-sm text-[#94A3B8]">No recurring expenses yet. Add rent, internet, software subscriptions, etc.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                {['Scope','Type','Group / Branch','Amount/mo','Start','End','Status',''].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-medium text-[#64748B] ${h === 'Amount/mo' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recurring.map(r => (
                <tr key={r.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3">
                    <span className="rounded bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-medium text-[#64748B]">
                      {r.expense_scope}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">{EXPENSE_TYPE_LABELS[r.expense_type]}</td>
                  <td className="px-4 py-3 text-[#64748B]">
                    {r.group_name ?? r.branch_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{fmt(r.amount)}</td>
                  <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">{r.start_date}</td>
                  <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">{r.end_date ?? 'Ongoing'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-[#F1F5F9] text-[#94A3B8]'}`}>
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
      <button onClick={() => setConfirm(true)} className="rounded px-2 py-1 text-[11px] text-[#94A3B8] hover:text-red-600 hover:bg-red-50">
        Delete
      </button>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => startTransition(async () => { await deleteRecurringExpense(id); onSuccess() })}
        disabled={isPending}
        className="rounded px-2 py-1 text-[11px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50"
      >
        {isPending ? '…' : 'Confirm'}
      </button>
      <button onClick={() => setConfirm(false)} className="rounded px-2 py-1 text-[11px] text-[#94A3B8]">Cancel</button>
    </div>
  )
}

// ── Main Client Component ──────────────────────────────────────────────────────

export default function FinancialManagementClient({
  groupRows, branchRows, academyPnL, expenses, recurring,
  branches, groups,
  activeTab, currentBranchId, currentDateFrom, currentDateTo, includeArchived,
  isSuperAdmin,
}: Props) {
  const router = useRouter()

  function refresh() {
    router.refresh()
  }

  const tabs = [
    { key: 'groups',    label: 'Groups'    },
    { key: 'branches',  label: 'Branches'  },
    { key: 'academy',   label: 'Academy'   },
    { key: 'recurring', label: 'Recurring' },
  ]

  function switchTab(key: string) {
    const params = new URLSearchParams()
    params.set('tab', key)
    if (currentBranchId) params.set('branch_id',  currentBranchId)
    if (currentDateFrom) params.set('date_from',   currentDateFrom)
    if (currentDateTo)   params.set('date_to',     currentDateTo)
    if (includeArchived) params.set('archived',    '1')
    router.push(`/admin/expenses?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      {/* Tab nav */}
      <div className="flex gap-1 rounded-lg bg-[#F1F5F9] p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`flex-1 rounded-md px-4 py-2 text-xs font-semibold transition ${
              activeTab === t.key
                ? 'bg-white text-[#0B1F3A] shadow-sm'
                : 'text-[#64748B] hover:text-[#0B1F3A]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date + branch filters */}
      <LiveFilterBar
        branches={branches}
        currentBranchId={currentBranchId}
        currentDateFrom={currentDateFrom}
        currentDateTo={currentDateTo}
        includeArchived={includeArchived}
        activeTab={activeTab}
      />

      {/* Tab content */}
      {activeTab === 'groups' && (
        <GroupsTab
          rows={groupRows}
          expenses={expenses}
          recurring={recurring}
          branches={branches}
          groups={groups}
          onRefresh={refresh}
        />
      )}
      {activeTab === 'branches' && (
        <BranchesTab
          rows={branchRows}
          expenses={expenses}
          recurring={recurring}
          branches={branches}
          groups={groups}
          onRefresh={refresh}
        />
      )}
      {activeTab === 'academy' && (
        <AcademyTab
          pnl={academyPnL}
          expenses={expenses}
          recurring={recurring}
          branches={branches}
          groups={groups}
          onRefresh={refresh}
        />
      )}
      {activeTab === 'recurring' && (
        <RecurringTab
          recurring={recurring}
          branches={branches}
          groups={groups}
          onRefresh={refresh}
        />
      )}
    </div>
  )
}
