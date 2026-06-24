'use client'
import { useState, useTransition, useCallback } from 'react'
import Link from 'next/link'
import {
  fetchStudentFinanceDetail,
  addPayment, addFinanceNote, recordActivity, addInstallment,
} from '@/modules/finance/actions'
import {
  STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, INSTALLMENT_STATUS_COLORS,
  PAYMENT_METHOD_LABELS, ACTIVITY_TYPE_LABELS,
  type FinanceListItem, type StudentFinanceDetail, type PaymentMethod, type ActivityType,
} from '@/modules/finance/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}
function dateFmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function timeFmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Root ──────────────────────────────────────────────────────────────────────

interface Props {
  mode:          'row-mobile' | 'row-desktop' | 'modal-trigger'
  item?:         FinanceListItem
  openAccountId?: string
}

export default function FinanceClient({ mode, item, openAccountId }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(openAccountId ?? null)
  const [detail,     setDetail]     = useState<StudentFinanceDetail | null>(null)
  const [loading,    startLoad]     = useTransition()
  const [tab,        setTab]        = useState<'summary' | 'installments' | 'notes' | 'activities' | 'payment'>('summary')

  const openModal = useCallback((accountId: string) => {
    setSelectedId(accountId)
    setDetail(null)
    setTab('summary')
    startLoad(async () => {
      const data = await fetchStudentFinanceDetail(accountId)
      setDetail(data)
    })
  }, [])

  const closeModal = useCallback(() => {
    setSelectedId(null)
    setDetail(null)
  }, [])

  if (mode === 'row-mobile' && item) {
    return (
      <>
        <button
          onClick={() => openModal(item.account_id)}
          className="w-full px-4 py-4 text-left hover:bg-[#F8FAFC] transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[#0B1F3A] leading-tight truncate">{item.student_name}</p>
              {item.student_code && <p className="mt-0.5 font-mono text-[11px] text-[#94A3B8]">{item.student_code}</p>}
            </div>
            <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[item.status]}`}>
              {STATUS_LABELS[item.status]}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
            <div>
              <p className="text-[#94A3B8]">Paid</p>
              <p className="font-semibold text-[#10B981]">EGP {fmt(item.paid_amount)}</p>
            </div>
            <div>
              <p className="text-[#94A3B8]">Remaining</p>
              <p className={`font-semibold ${item.remaining_amount > 0 ? 'text-[#EF4444]' : 'text-[#0B1F3A]'}`}>
                EGP {fmt(item.remaining_amount)}
              </p>
            </div>
            <div>
              <p className="text-[#94A3B8]">Due</p>
              <p className="font-medium text-[#0B1F3A]">{dateFmt(item.next_due_date)}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[12px] text-[#64748B]">
            <span>{item.branch_name}</span>
            {item.group_name && <><span>·</span><span>{item.group_name}</span></>}
            {item.parent_phone_1 && <><span>·</span><span className="font-medium">{item.parent_phone_1}</span></>}
          </div>
        </button>

        {selectedId === item.account_id && (
          <FinanceModal
            accountId={selectedId}
            detail={detail}
            loading={loading}
            tab={tab}
            setTab={setTab}
            onClose={closeModal}
            onRefresh={() => openModal(item.account_id)}
          />
        )}
      </>
    )
  }

  if (mode === 'row-desktop' && item) {
    return (
      <>
        <tr
          onClick={() => openModal(item.account_id)}
          className="ds-table-row cursor-pointer"
        >
          <td className="px-4 py-3">
            <p className="font-medium text-[#0B1F3A]">{item.student_name}</p>
            {item.student_code && <p className="font-mono text-[11px] text-[#94A3B8]">{item.student_code}</p>}
          </td>
          <td className="px-4 py-3">
            <p className="text-[#64748B]">{item.parent_name ?? '—'}</p>
            {item.parent_phone_1 && <p className="text-[12px] font-medium text-[#0B1F3A]">{item.parent_phone_1}</p>}
          </td>
          <td className="px-4 py-3">
            <p className="text-[#64748B]">{item.branch_name}</p>
            {item.group_name && <p className="text-[12px] text-[#94A3B8]">{item.group_name}</p>}
          </td>
          <td className="px-4 py-3 text-right">
            <p className="font-medium text-[#0B1F3A]">EGP {fmt(item.net_amount)}</p>
            {item.discount_amount > 0 && (
              <p className="text-[11px] text-[#10B981]">-EGP {fmt(item.discount_amount)}</p>
            )}
          </td>
          <td className="px-4 py-3 text-right font-semibold text-[#10B981]">
            EGP {fmt(item.paid_amount)}
          </td>
          <td className="px-4 py-3 text-right">
            <span className={`font-bold ${item.remaining_amount > 0 ? 'text-[#EF4444]' : 'text-[#94A3B8]'}`}>
              EGP {fmt(item.remaining_amount)}
            </span>
          </td>
          <td className="px-4 py-3 text-[#64748B]">
            {item.next_due_date ? (
              <span className={item.days_overdue > 0 ? 'text-[#EF4444] font-medium' : ''}>
                {dateFmt(item.next_due_date)}
                {item.days_overdue > 0 && <span className="ml-1 text-[11px]">({item.days_overdue}d)</span>}
              </span>
            ) : '—'}
          </td>
          <td className="px-4 py-3">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[item.status]}`}>
              {STATUS_LABELS[item.status]}
            </span>
          </td>
          <td className="px-4 py-3">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_COLORS[item.priority]}`}>
              {item.priority}
            </span>
          </td>
          <td className="px-4 py-3 text-right">
            <span className="text-xs font-medium text-[#FF8A1F]">Open →</span>
          </td>
        </tr>

        {selectedId === item.account_id && (
          <tr>
            <td colSpan={10} className="p-0">
              <FinanceModal
                accountId={selectedId}
                detail={detail}
                loading={loading}
                tab={tab}
                setTab={setTab}
                onClose={closeModal}
                onRefresh={() => openModal(item.account_id)}
              />
            </td>
          </tr>
        )}
      </>
    )
  }

  if (mode === 'modal-trigger' && openAccountId) {
    return (
      <FinanceModal
        accountId={selectedId ?? openAccountId}
        detail={detail}
        loading={loading}
        tab={tab}
        setTab={setTab}
        onClose={closeModal}
        onRefresh={() => openModal(openAccountId)}
      />
    )
  }

  return null
}

// ─── Finance Modal ─────────────────────────────────────────────────────────────

type ModalTab = 'summary' | 'installments' | 'notes' | 'activities' | 'payment'

function FinanceModal({
  accountId, detail, loading, tab, setTab, onClose, onRefresh,
}: {
  accountId:  string
  detail:     StudentFinanceDetail | null
  loading:    boolean
  tab:        ModalTab
  setTab:     (t: ModalTab) => void
  onClose:    () => void
  onRefresh:  () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#0B1F3A]">
              {loading ? 'Loading…' : (detail?.student.name ?? 'Finance Detail')}
            </h2>
            {detail?.student.student_code && (
              <p className="font-mono text-xs text-[#94A3B8]">{detail.student.student_code}</p>
            )}
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-[#F1F5F9] transition-colors">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-[#64748B]">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 overflow-x-auto border-b border-[#E2E8F0] px-2">
          {([
            { id: 'summary',      label: 'Summary' },
            { id: 'installments', label: `Installments${detail ? ` (${detail.installments.length})` : ''}` },
            { id: 'payment',      label: '+ Payment' },
            { id: 'notes',        label: `Notes${detail ? ` (${detail.notes.length})` : ''}` },
            { id: 'activities',   label: `Activities${detail ? ` (${detail.activities.length})` : ''}` },
          ] as { id: ModalTab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'whitespace-nowrap px-3 py-2.5 text-sm font-medium border-b-2 transition-colors',
                tab === t.id
                  ? 'border-[#FF8A1F] text-[#FF8A1F]'
                  : 'border-transparent text-[#64748B] hover:text-[#0B1F3A]',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF8A1F] border-t-transparent" />
            </div>
          )}

          {!loading && !detail && (
            <p className="py-10 text-center text-sm text-[#94A3B8]">Failed to load. Please try again.</p>
          )}

          {!loading && detail && (
            <>
              {tab === 'summary'      && <SummaryTab detail={detail} />}
              {tab === 'installments' && <InstallmentsTab detail={detail} accountId={accountId} onRefresh={onRefresh} />}
              {tab === 'payment'      && <PaymentTab detail={detail} accountId={accountId} onRefresh={onRefresh} />}
              {tab === 'notes'        && <NotesTab detail={detail} accountId={accountId} onRefresh={onRefresh} />}
              {tab === 'activities'   && <ActivitiesTab detail={detail} accountId={accountId} onRefresh={onRefresh} />}
            </>
          )}
        </div>

        {/* Quick actions footer */}
        {!loading && detail && (
          <QuickActionsFooter detail={detail} accountId={accountId} onRefresh={onRefresh} setTab={setTab} />
        )}
      </div>
    </div>
  )
}

// ─── Summary Tab ──────────────────────────────────────────────────────────────

function SummaryTab({ detail }: { detail: StudentFinanceDetail }) {
  const { student, account } = detail
  return (
    <div className="space-y-4">
      {/* Student info */}
      <div className="rounded-xl bg-[#F8FAFC] p-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Student</p>
          <p className="mt-0.5 text-sm font-medium text-[#0B1F3A]">{student.name}</p>
          <p className="text-[12px] text-[#64748B]">{student.email}</p>
          {student.phone && <p className="text-[12px] text-[#64748B]">{student.phone}</p>}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Parent</p>
          <p className="mt-0.5 text-sm font-medium text-[#0B1F3A]">{student.parent_name ?? '—'}</p>
          {student.parent_phone_1 && <p className="text-[12px] text-[#64748B]">{student.parent_phone_1}</p>}
          {student.parent_phone_2 && <p className="text-[12px] text-[#64748B]">{student.parent_phone_2}</p>}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Branch</p>
          <p className="mt-0.5 text-sm text-[#0B1F3A]">{student.branch_name}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Group / Course</p>
          <p className="mt-0.5 text-sm text-[#0B1F3A]">{student.group_name ?? '—'}</p>
          {student.course_title && <p className="text-[12px] text-[#94A3B8]">{student.course_title}</p>}
        </div>
      </div>

      {/* Financial summary */}
      <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="bg-[#F8FAFC] px-4 py-2.5 border-b border-[#E2E8F0]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Financial Summary</p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-[#E2E8F0]">
          {[
            { label: 'Total',         value: `EGP ${fmt(account.total_amount)}`,     cls: 'text-[#0B1F3A]' },
            { label: 'Discount',      value: `-EGP ${fmt(account.discount_amount)}`, cls: 'text-[#10B981]' },
            { label: 'Net Total',     value: `EGP ${fmt(account.net_amount)}`,       cls: 'font-bold text-[#0B1F3A]' },
            { label: 'Paid',          value: `EGP ${fmt(account.paid_amount)}`,      cls: 'font-bold text-[#10B981]' },
            { label: 'Remaining',     value: `EGP ${fmt(account.remaining_amount)}`, cls: `font-bold ${account.remaining_amount > 0 ? 'text-[#EF4444]' : 'text-[#94A3B8]'}` },
            { label: 'Next Due Date', value: dateFmt(account.next_due_date),         cls: 'text-[#0B1F3A]' },
          ].map(({ label, value, cls }, i) => (
            <div key={label} className={`px-4 py-3 ${i % 2 === 0 ? '' : ''}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">{label}</p>
              <p className={`mt-0.5 text-sm ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-[#E2E8F0] px-4 py-3">
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${STATUS_COLORS[account.status]}`}>
              {STATUS_LABELS[account.status]}
            </span>
            {account.remaining_amount > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-28 rounded-full bg-[#F1F5F9] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#FF8A1F]"
                    style={{ width: `${Math.round((account.paid_amount / account.net_amount) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-[#64748B]">
                  {Math.round((account.paid_amount / account.net_amount) * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent payments */}
      {detail.payments.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Recent Payments</p>
          <div className="space-y-1.5">
            {detail.payments.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-[#F8FAFC] px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-[#0B1F3A]">EGP {fmt(p.amount)}</p>
                  <p className="text-[11px] text-[#94A3B8]">
                    {PAYMENT_METHOD_LABELS[p.payment_method]} · {timeFmt(p.payment_date)}
                  </p>
                </div>
                {p.reference_number && <p className="text-[11px] text-[#64748B]">#{p.reference_number}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Installments Tab ─────────────────────────────────────────────────────────

function InstallmentsTab({
  detail, accountId, onRefresh,
}: {
  detail: StudentFinanceDetail
  accountId: string
  onRefresh: () => void
}) {
  const [showAdd, setShowAdd]   = useState(false)
  const [pending, startPending] = useTransition()
  const [err, setErr]           = useState('')

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr('')
    startPending(async () => {
      const r = await addInstallment({
        account_id:         accountId,
        installment_number: detail.installments.length + 1,
        amount:             Number(fd.get('amount')),
        due_date:           fd.get('due_date') as string,
        notes:              (fd.get('notes') as string) || undefined,
      })
      if (r && 'error' in r) { setErr(String(r.error ?? 'Error')); return }
      setShowAdd(false)
      onRefresh()
    })
  }

  return (
    <div className="space-y-3">
      {detail.installments.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#94A3B8]">No installments set up yet.</p>
      ) : (
        <div className="space-y-2">
          {detail.installments.map(inst => (
            <div key={inst.id} className="rounded-xl border border-[#E2E8F0] p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#0B1F3A]">
                    Installment #{inst.installment_number}
                  </p>
                  <p className="mt-0.5 text-xs text-[#64748B]">Due: {dateFmt(inst.due_date)}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${INSTALLMENT_STATUS_COLORS[inst.status]}`}>
                  {inst.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Due</p>
                  <p className="mt-0.5 font-medium text-[#0B1F3A]">EGP {fmt(inst.amount)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Paid</p>
                  <p className="mt-0.5 font-medium text-[#10B981]">EGP {fmt(inst.paid_amount)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Remaining</p>
                  <p className={`mt-0.5 font-medium ${inst.amount - inst.paid_amount > 0 ? 'text-[#EF4444]' : 'text-[#94A3B8]'}`}>
                    EGP {fmt(inst.amount - inst.paid_amount)}
                  </p>
                </div>
              </div>
              {inst.status !== 'PAID' && inst.amount > 0 && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                  <div
                    className="h-full rounded-full bg-[#FF8A1F]"
                    style={{ width: `${Math.min(100, Math.round((inst.paid_amount / inst.amount) * 100))}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <form onSubmit={handleAdd} className="rounded-xl border border-[#E2E8F0] p-4 space-y-3">
          <p className="text-sm font-semibold text-[#0B1F3A]">Add Installment #{detail.installments.length + 1}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Amount (EGP)</label>
              <input name="amount" type="number" min="1" step="0.01" required
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Due Date</label>
              <input name="due_date" type="date" required
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Notes (optional)</label>
            <input name="notes"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
          </div>
          {err && <p className="text-xs text-[#EF4444]">{err}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending}
              className="flex-1 rounded-lg bg-[#FF8A1F] py-2 text-sm font-medium text-white disabled:opacity-50">
              {pending ? 'Saving…' : 'Save Installment'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm text-[#64748B]">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowAdd(true)}
          className="w-full rounded-xl border-2 border-dashed border-[#E2E8F0] py-3 text-sm text-[#64748B] hover:border-[#FF8A1F]/40 hover:text-[#FF8A1F] transition-colors">
          + Add Installment
        </button>
      )}
    </div>
  )
}

// ─── Payment Tab ──────────────────────────────────────────────────────────────

function PaymentTab({
  detail, accountId, onRefresh,
}: {
  detail: StudentFinanceDetail
  accountId: string
  onRefresh: () => void
}) {
  const [pending, startPending] = useTransition()
  const [err, setErr]           = useState('')
  const [success, setSuccess]   = useState(false)
  const pendingInsts = detail.installments.filter(i => i.status !== 'PAID')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr('')
    setSuccess(false)
    startPending(async () => {
      const r = await addPayment({
        account_id:       accountId,
        student_id:       detail.account.student_id,
        amount:           Number(fd.get('amount')),
        payment_date:     fd.get('payment_date') as string,
        payment_method:   fd.get('payment_method') as PaymentMethod,
        reference_number: (fd.get('reference_number') as string) || undefined,
        notes:            (fd.get('notes') as string) || undefined,
        installment_id:   (fd.get('installment_id') as string) || undefined,
      })
      if (r && 'error' in r) { setErr(String(r.error ?? 'Error')); return }
      setSuccess(true)
      ;(e.target as HTMLFormElement).reset()
      onRefresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm font-semibold text-[#0B1F3A]">Record Payment</p>

      <div className="rounded-xl bg-[#F8FAFC] p-3 text-sm">
        <span className="text-[#64748B]">Remaining: </span>
        <span className="font-bold text-[#EF4444]">EGP {fmt(detail.account.remaining_amount)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">Amount (EGP) *</label>
          <input name="amount" type="number" min="0.01" step="0.01"
            defaultValue={detail.account.remaining_amount || undefined}
            required
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">Date *</label>
          <input name="payment_date" type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[#64748B] mb-1">Payment Method *</label>
        <select name="payment_method" required
          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20">
          {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {pendingInsts.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">Apply to Installment (optional)</label>
          <select name="installment_id"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20">
            <option value="">— General payment —</option>
            {pendingInsts.map(inst => (
              <option key={inst.id} value={inst.id}>
                #{inst.installment_number} — EGP {fmt(inst.amount)} — Due {dateFmt(inst.due_date)} ({inst.status})
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-[#64748B] mb-1">Reference Number</label>
        <input name="reference_number" placeholder="e.g. TRX-12345"
          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
      </div>

      <div>
        <label className="block text-xs font-medium text-[#64748B] mb-1">Notes</label>
        <textarea name="notes" rows={2} placeholder="Optional payment note…"
          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20 resize-none" />
      </div>

      {err     && <p className="rounded-lg bg-[#FEE2E2] px-3 py-2 text-xs text-[#EF4444]">{err}</p>}
      {success && <p className="rounded-lg bg-[#E7F8EE] px-3 py-2 text-xs text-[#10B981]">Payment recorded successfully.</p>}

      <button type="submit" disabled={pending}
        className="w-full rounded-xl bg-[#FF8A1F] py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#e87c18] disabled:opacity-50 transition-colors">
        {pending ? 'Recording…' : 'Record Payment'}
      </button>
    </form>
  )
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────

function NotesTab({
  detail, accountId, onRefresh,
}: {
  detail: StudentFinanceDetail
  accountId: string
  onRefresh: () => void
}) {
  const [pending, startPending] = useTransition()
  const [err, setErr]           = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr('')
    startPending(async () => {
      const r = await addFinanceNote({
        student_id:  detail.account.student_id,
        account_id:  accountId,
        note_text:   fd.get('note_text') as string,
        is_internal: fd.get('is_internal') === 'true',
      })
      if (r && 'error' in r) { setErr(String(r.error ?? 'Error')); return }
      ;(e.target as HTMLFormElement).reset()
      onRefresh()
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea name="note_text" rows={3} required placeholder="Add finance note…"
          className="w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20 resize-none" />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-[#64748B]">
            <input name="is_internal" type="checkbox" value="true" className="rounded" />
            Internal note (hidden from parents)
          </label>
          <button type="submit" disabled={pending}
            className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {pending ? 'Adding…' : 'Add Note'}
          </button>
        </div>
        {err && <p className="text-xs text-[#EF4444]">{err}</p>}
      </form>

      {detail.notes.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#94A3B8]">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          {detail.notes.map(note => (
            <div key={note.id} className="rounded-xl bg-[#F8FAFC] p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-[#0B1F3A]">{note.note_text}</p>
                {note.is_internal && (
                  <span className="shrink-0 rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-medium text-[#B45309]">Internal</span>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-[#94A3B8]">
                {note.created_by_name ?? 'Staff'} · {timeFmt(note.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Activities Tab ───────────────────────────────────────────────────────────

const ACTIVITY_ICONS: Record<string, string> = {
  CALL:             '📞',
  WHATSAPP:         '💬',
  PORTAL_MESSAGE:   '✉️',
  FOLLOW_UP:        '🔁',
  PAYMENT_REMINDER: '🔔',
}

function ActivitiesTab({
  detail, accountId, onRefresh,
}: {
  detail: StudentFinanceDetail
  accountId: string
  onRefresh: () => void
}) {
  const [pending, startPending] = useTransition()
  const [err, setErr]           = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr('')
    startPending(async () => {
      const r = await recordActivity({
        student_id:    detail.account.student_id,
        account_id:    accountId,
        activity_type: fd.get('activity_type') as ActivityType,
        notes:         (fd.get('notes') as string) || undefined,
      })
      if (r && 'error' in r) { setErr(String(r.error ?? 'Error')); return }
      ;(e.target as HTMLFormElement).reset()
      onRefresh()
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-[#E2E8F0] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Record Activity</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Type</label>
            <select name="activity_type" required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20">
              {(Object.entries(ACTIVITY_TYPE_LABELS) as [ActivityType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Notes</label>
            <input name="notes" placeholder="Optional notes…"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
          </div>
        </div>
        {err && <p className="text-xs text-[#EF4444]">{err}</p>}
        <button type="submit" disabled={pending}
          className="w-full rounded-lg bg-[#0B1F3A] py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? 'Recording…' : 'Record Activity'}
        </button>
      </form>

      {detail.activities.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#94A3B8]">No activities logged yet.</p>
      ) : (
        <div className="relative ml-3 space-y-0">
          <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-[#E2E8F0]" />
          {detail.activities.map(act => (
            <div key={act.id} className="relative pl-6 pb-4">
              <span className="absolute left-[-8px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white border border-[#E2E8F0] text-[11px]">
                {ACTIVITY_ICONS[act.activity_type] ?? '•'}
              </span>
              <p className="text-sm font-medium text-[#0B1F3A]">{ACTIVITY_TYPE_LABELS[act.activity_type]}</p>
              {act.notes && <p className="mt-0.5 text-xs text-[#64748B]">{act.notes}</p>}
              <p className="mt-0.5 text-[11px] text-[#94A3B8]">
                {act.created_by_name ?? 'Staff'} · {timeFmt(act.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Quick Actions Footer ─────────────────────────────────────────────────────

function QuickActionsFooter({
  detail, accountId, onRefresh, setTab,
}: {
  detail:     StudentFinanceDetail
  accountId:  string
  onRefresh:  () => void
  setTab:     (t: ModalTab) => void
}) {
  const { student, account } = detail
  const [pending, startPending] = useTransition()

  const buildWaLink = (phone: string | null) => {
    if (!phone) return null
    const cleanPhone = phone.replace(/\D/g, '').replace(/^0/, '20')
    const msg = encodeURIComponent(
      `عزيزي ولي الأمر،\nنود تذكيركم بأن الدفعة المستحقة من ${student.name} بمبلغ EGP ${fmt(account.remaining_amount)} لم يتم سدادها بعد.${account.next_due_date ? `\nتاريخ الاستحقاق: ${dateFmt(account.next_due_date)}` : ''}\nيرجى التواصل معنا في أقرب وقت. شكراً 🙏\nRobocode Academy`
    )
    return `https://wa.me/${cleanPhone}?text=${msg}`
  }

  async function handleQuickActivity(type: ActivityType) {
    startPending(async () => {
      await recordActivity({ student_id: account.student_id, account_id: accountId, activity_type: type })
      onRefresh()
    })
  }

  const waLink = buildWaLink(student.parent_phone_1 ?? student.parent_phone_2)

  return (
    <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Quick Actions</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab('payment')}
          className="rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#e87c18] transition-colors">
          + Payment
        </button>
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            onClick={() => handleQuickActivity('WHATSAPP')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1eb955] transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.556 4.117 1.528 5.845L.057 23.899c-.085.334.24.642.572.535l6.235-1.999A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.921 0-3.714-.519-5.244-1.422l-.376-.224-3.884 1.244 1.268-3.773-.247-.389A9.818 9.818 0 012.182 12c0-5.422 4.396-9.818 9.818-9.818 5.423 0 9.818 4.396 9.818 9.818 0 5.423-4.395 9.818-9.818 9.818z" />
            </svg>
            WhatsApp
          </a>
        )}
        {student.parent_phone_1 && (
          <a
            href={`tel:${student.parent_phone_1}`}
            onClick={() => handleQuickActivity('CALL')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1a3557] transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
            Call
          </a>
        )}
        <button onClick={() => setTab('notes')}
          className="ds-card px-3 py-1.5 text-xs font-medium text-[#64748B] hover:border-[#FF8A1F]/40 hover:text-[#FF8A1F] transition-colors">
          + Note
        </button>
        <button onClick={() => handleQuickActivity('PAYMENT_REMINDER')} disabled={pending}
          className="ds-card px-3 py-1.5 text-xs font-medium text-[#64748B] hover:border-[#FF8A1F]/40 hover:text-[#FF8A1F] transition-colors disabled:opacity-50">
          {pending ? '…' : 'Log Reminder'}
        </button>
        <button onClick={() => setTab('activities')}
          className="ds-card px-3 py-1.5 text-xs font-medium text-[#64748B] hover:border-[#FF8A1F]/40 hover:text-[#FF8A1F] transition-colors">
          Activities
        </button>
      </div>
    </div>
  )
}
