'use client'
import { useState, useTransition, useCallback } from 'react'
import Link from 'next/link'
import {
  fetchStudentFinanceDetail,
  addPayment, addFinanceNote, recordActivity, addInstallment,
  addPaymentPromise, markPromiseFulfilled, fetchAccountPromises,
} from '@/modules/finance/actions'
import {
  STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, INSTALLMENT_STATUS_COLORS,
  PAYMENT_METHOD_LABELS, ACTIVITY_TYPE_LABELS,
  type FinanceListItem, type StudentFinanceDetail,
  type PaymentMethod, type ActivityType,
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

// ─── Main component ───────────────────────────────────────────────────────────

type ModalTab = 'summary' | 'installments' | 'notes' | 'activities' | 'payment' | 'promises'

export default function FinanceTableClient({ accounts, exportUrl }: { accounts: FinanceListItem[]; exportUrl?: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail,     setDetail]     = useState<StudentFinanceDetail | null>(null)
  const [loading,    startLoad]     = useTransition()
  const [tab,        setTab]        = useState<ModalTab>('summary')

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

  const refreshModal = useCallback(() => {
    if (!selectedId) return
    startLoad(async () => {
      const data = await fetchStudentFinanceDetail(selectedId)
      setDetail(data)
    })
  }, [selectedId])

  return (
    <>
      {/* Export bar */}
      {exportUrl && (
        <div className="flex items-center justify-end gap-2 border-b border-[#E2E8F0] px-4 py-2">
          <a
            href={exportUrl}
            download
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F] transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Export CSV
          </a>
          <Link
            href="/admin/finance/queue"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F] transition-colors"
          >
            Collections Queue →
          </Link>
        </div>
      )}

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-[#E2E8F0]">
        {accounts.map(item => (
          <button
            key={item.account_id}
            onClick={() => openModal(item.account_id)}
            className="w-full px-4 py-4 text-left hover:bg-[#F8FAFC] transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-[#0B1F3A] leading-tight truncate">{item.student_name}</p>
                {item.student_code && <p className="mt-0.5 font-mono text-[11px] text-[#94A3B8]">{item.student_code}</p>}
              </div>
              <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[item.status]}`}>
                {STATUS_LABELS[item.status]}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
              <div>
                <p className="text-[#94A3B8]">Paid</p>
                <p className="font-semibold text-emerald-600">EGP {fmt(item.paid_amount)}</p>
              </div>
              <div>
                <p className="text-[#94A3B8]">Remaining</p>
                <p className={`font-semibold ${item.remaining_amount > 0 ? 'text-red-500' : 'text-[#0B1F3A]'}`}>
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
              {item.parent_phone_1 && <><span>·</span><span className="font-medium text-[#0B1F3A]">{item.parent_phone_1}</span></>}
            </div>
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Student</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Parent / Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Branch / Group</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Net Total</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Paid</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[#64748B]">Remaining</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Next Due</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Last Payment</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Priority</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {accounts.map(item => (
              <tr
                key={item.account_id}
                onClick={() => openModal(item.account_id)}
                className={[
                  'border-b border-[#E2E8F0] last:border-0 cursor-pointer transition-colors',
                  selectedId === item.account_id ? 'bg-[#FFF7ED]' : 'hover:bg-[#F8FAFC]',
                ].join(' ')}
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
                    <p className="text-[11px] text-emerald-600">-EGP {fmt(item.discount_amount)} disc.</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                  EGP {fmt(item.paid_amount)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-bold ${item.remaining_amount > 0 ? 'text-red-500' : 'text-[#94A3B8]'}`}>
                    EGP {fmt(item.remaining_amount)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[#64748B]">
                  {item.next_due_date ? (
                    <span className={item.days_overdue > 0 ? 'text-red-500 font-medium' : ''}>
                      {dateFmt(item.next_due_date)}
                      {item.days_overdue > 0 && <span className="ml-1 text-[11px]">({item.days_overdue}d late)</span>}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-[#64748B]">
                  {dateFmt(item.last_payment_date ?? null)}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[item.status]}`}>
                    {STATUS_LABELS[item.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_COLORS[item.priority]}`}>
                    {item.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs font-medium text-[#FF8A1F]">
                  Open →
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Finance Modal — single instance, shared state */}
      {selectedId && (
        <FinanceModal
          accountId={selectedId}
          detail={detail}
          loading={loading}
          tab={tab}
          setTab={setTab}
          onClose={closeModal}
          onRefresh={refreshModal}
        />
      )}
    </>
  )
}

// ─── Finance Modal ─────────────────────────────────────────────────────────────

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
  const tabs: { id: ModalTab; label: string }[] = [
    { id: 'summary',      label: 'Summary' },
    { id: 'installments', label: `Installments${detail ? ` (${detail.installments.length})` : ''}` },
    { id: 'payment',      label: '+ Payment' },
    { id: 'promises',     label: 'Promises' },
    { id: 'notes',        label: `Notes${detail ? ` (${detail.notes.length})` : ''}` },
    { id: 'activities',   label: `Activities${detail ? ` (${detail.activities.length})` : ''}` },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4 shrink-0">
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
        <div className="flex gap-0 overflow-x-auto border-b border-[#E2E8F0] px-2 shrink-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'whitespace-nowrap px-3 py-2.5 text-sm font-medium border-b-2 transition-colors shrink-0',
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
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF8A1F] border-t-transparent" />
            </div>
          )}
          {!loading && !detail && (
            <p className="py-10 text-center text-sm text-[#94A3B8]">Could not load detail. Try again.</p>
          )}
          {!loading && detail && (
            <div className="space-y-4">
              {tab === 'summary'      && <SummaryTab detail={detail} />}
              {tab === 'installments' && <InstallmentsTab detail={detail} accountId={accountId} onRefresh={onRefresh} />}
              {tab === 'payment'      && <PaymentTab detail={detail} accountId={accountId} onRefresh={onRefresh} />}
              {tab === 'promises'     && <PromisesTab detail={detail} accountId={accountId} onRefresh={onRefresh} />}
              {tab === 'notes'        && <NotesTab detail={detail} accountId={accountId} onRefresh={onRefresh} />}
              {tab === 'activities'   && <ActivitiesTab detail={detail} accountId={accountId} onRefresh={onRefresh} />}
            </div>
          )}
        </div>

        {/* Quick actions footer */}
        {!loading && detail && (
          <QuickActionsFooter
            detail={detail}
            accountId={accountId}
            onRefresh={onRefresh}
            setTab={setTab}
          />
        )}
      </div>
    </div>
  )
}

// ─── Summary Tab ──────────────────────────────────────────────────────────────

function SummaryTab({ detail }: { detail: StudentFinanceDetail }) {
  const { student, account } = detail
  const pct = account.net_amount > 0
    ? Math.round((account.paid_amount / account.net_amount) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Student + parent */}
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#F8FAFC] p-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Student</p>
          <p className="mt-0.5 text-sm font-semibold text-[#0B1F3A]">{student.name}</p>
          <p className="text-[12px] text-[#64748B]">{student.email}</p>
          {student.phone && <p className="text-[12px] text-[#64748B]">{student.phone}</p>}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Parent</p>
          <p className="mt-0.5 text-sm font-semibold text-[#0B1F3A]">{student.parent_name ?? '—'}</p>
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
      <div className="rounded-xl border border-[#E2E8F0]">
        <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Financial Summary</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-[#E2E8F0]">
          {[
            { label: 'Total',     value: `EGP ${fmt(account.total_amount)}`,     cls: 'text-[#0B1F3A]' },
            { label: 'Discount',  value: `-EGP ${fmt(account.discount_amount)}`, cls: 'text-emerald-600' },
            { label: 'Net Total', value: `EGP ${fmt(account.net_amount)}`,       cls: 'font-bold text-[#0B1F3A]' },
            { label: 'Paid',      value: `EGP ${fmt(account.paid_amount)}`,      cls: 'font-bold text-emerald-600' },
            { label: 'Remaining', value: `EGP ${fmt(account.remaining_amount)}`, cls: `font-bold ${account.remaining_amount > 0 ? 'text-red-500' : 'text-[#94A3B8]'}` },
            { label: 'Next Due',  value: dateFmt(account.next_due_date),         cls: 'text-[#0B1F3A]' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-white px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">{label}</p>
              <p className={`mt-0.5 text-sm ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-[#E2E8F0] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${STATUS_COLORS[account.status]}`}>
              {STATUS_LABELS[account.status]}
            </span>
            <div className="flex flex-1 items-center gap-2 max-w-[180px]">
              <div className="flex-1 h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                <div className="h-full rounded-full bg-[#FF8A1F]" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-medium text-[#64748B]">{pct}%</span>
            </div>
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
                  <p className="text-sm font-semibold text-emerald-600">EGP {fmt(p.amount)}</p>
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

function InstallmentsTab({ detail, accountId, onRefresh }: { detail: StudentFinanceDetail; accountId: string; onRefresh: () => void }) {
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
        <div className="space-y-2.5">
          {detail.installments.map(inst => (
            <div key={inst.id} className="rounded-xl border border-[#E2E8F0] p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#0B1F3A]">Installment #{inst.installment_number}</p>
                  <p className="mt-0.5 text-xs text-[#64748B]">Due: {dateFmt(inst.due_date)}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${INSTALLMENT_STATUS_COLORS[inst.status]}`}>
                  {inst.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {[
                  { l: 'Due',       v: `EGP ${fmt(inst.amount)}`,                           cls: 'text-[#0B1F3A]' },
                  { l: 'Paid',      v: `EGP ${fmt(inst.paid_amount)}`,                      cls: 'text-emerald-600' },
                  { l: 'Remaining', v: `EGP ${fmt(inst.amount - inst.paid_amount)}`,         cls: inst.amount - inst.paid_amount > 0 ? 'text-red-500' : 'text-[#94A3B8]' },
                ].map(({ l, v, cls }) => (
                  <div key={l}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">{l}</p>
                    <p className={`mt-0.5 text-sm font-semibold ${cls}`}>{v}</p>
                  </div>
                ))}
              </div>
              {inst.amount > 0 && inst.status !== 'PAID' && (
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
              <label className="block text-xs font-medium text-[#64748B] mb-1">Amount (EGP) *</label>
              <input name="amount" type="number" min="1" step="0.01" required
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Due Date *</label>
              <input name="due_date" type="date" required
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
            </div>
          </div>
          <input name="notes" placeholder="Notes (optional)"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending}
              className="flex-1 rounded-lg bg-[#FF8A1F] py-2 text-sm font-semibold text-white disabled:opacity-50">
              {pending ? 'Saving…' : 'Save'}
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

function PaymentTab({ detail, accountId, onRefresh }: { detail: StudentFinanceDetail; accountId: string; onRefresh: () => void }) {
  const [pending, startPending] = useTransition()
  const [err, setErr]           = useState('')
  const [ok,  setOk]            = useState(false)
  const pendingInsts = detail.installments.filter(i => i.status !== 'PAID')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr(''); setOk(false)
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
      setOk(true)
      ;(e.target as HTMLFormElement).reset()
      onRefresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl bg-[#F8FAFC] p-3 flex items-center justify-between">
        <span className="text-sm text-[#64748B]">Remaining balance</span>
        <span className="text-base font-bold text-red-500">EGP {fmt(detail.account.remaining_amount)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">Amount (EGP) *</label>
          <input name="amount" type="number" min="0.01" step="0.01"
            defaultValue={detail.account.remaining_amount > 0 ? detail.account.remaining_amount : undefined}
            required
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">Date *</label>
          <input name="payment_date" type="date"
            defaultValue={new Date().toISOString().slice(0, 10)} required
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[#64748B] mb-1">Method *</label>
        <select name="payment_method" required
          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20">
          {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {pendingInsts.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">Apply to installment (optional)</label>
          <select name="installment_id"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20">
            <option value="">— General payment —</option>
            {pendingInsts.map(i => (
              <option key={i.id} value={i.id}>
                #{i.installment_number} · EGP {fmt(i.amount)} · Due {dateFmt(i.due_date)} ({i.status})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">Reference #</label>
          <input name="reference_number" placeholder="e.g. TRX-12345"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">Notes</label>
          <input name="notes"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
        </div>
      </div>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
      {ok  && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-600">Payment recorded successfully.</p>}

      <button type="submit" disabled={pending}
        className="w-full rounded-xl bg-[#FF8A1F] py-3 text-sm font-bold text-white shadow-sm hover:bg-[#e87c18] disabled:opacity-50 transition-colors">
        {pending ? 'Recording…' : 'Record Payment'}
      </button>
    </form>
  )
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────

function NotesTab({ detail, accountId, onRefresh }: { detail: StudentFinanceDetail; accountId: string; onRefresh: () => void }) {
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
        is_internal: (e.currentTarget.elements.namedItem('is_internal') as HTMLInputElement)?.checked ?? false,
      })
      if (r && 'error' in r) { setErr(String(r.error ?? 'Error')); return }
      ;(e.target as HTMLFormElement).reset()
      onRefresh()
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea name="note_text" rows={3} required placeholder="Add a finance note (e.g. Parent promised payment next week)…"
          className="w-full rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20 resize-none" />
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-[#64748B]">
            <input name="is_internal" type="checkbox" className="rounded" />
            Internal (hidden from parents)
          </label>
          <button type="submit" disabled={pending}
            className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 shrink-0">
            {pending ? 'Adding…' : 'Add Note'}
          </button>
        </div>
        {err && <p className="text-xs text-red-500">{err}</p>}
      </form>

      {detail.notes.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#94A3B8]">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          {detail.notes.map(n => (
            <div key={n.id} className="rounded-xl bg-[#F8FAFC] p-4">
              <div className="flex items-start gap-2">
                <p className="flex-1 text-sm text-[#0B1F3A]">{n.note_text}</p>
                {n.is_internal && (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Internal</span>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-[#94A3B8]">
                {n.created_by_name ?? 'Staff'} · {timeFmt(n.created_at)}
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
  CALL: '📞', WHATSAPP: '💬', PORTAL_MESSAGE: '✉️', FOLLOW_UP: '🔁', PAYMENT_REMINDER: '🔔',
}

function ActivitiesTab({ detail, accountId, onRefresh }: { detail: StudentFinanceDetail; accountId: string; onRefresh: () => void }) {
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
      <form onSubmit={handleSubmit} className="rounded-xl border border-[#E2E8F0] p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Log Activity</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Type *</label>
            <select name="activity_type" required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20">
              {(Object.entries(ACTIVITY_TYPE_LABELS) as [ActivityType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Notes</label>
            <input name="notes" placeholder="Optional…"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
          </div>
        </div>
        {err && <p className="text-xs text-red-500">{err}</p>}
        <button type="submit" disabled={pending}
          className="w-full rounded-lg bg-[#0B1F3A] py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? 'Recording…' : 'Record Activity'}
        </button>
      </form>

      {detail.activities.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#94A3B8]">No activities logged yet.</p>
      ) : (
        <div className="relative ml-3">
          <div className="absolute left-0 top-2 bottom-0 w-0.5 bg-[#E2E8F0]" />
          {detail.activities.map(act => (
            <div key={act.id} className="relative pl-6 pb-4">
              <span className="absolute left-[-8px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[11px]">
                {ACTIVITY_ICONS[act.activity_type] ?? '•'}
              </span>
              <p className="text-sm font-semibold text-[#0B1F3A]">{ACTIVITY_TYPE_LABELS[act.activity_type]}</p>
              {act.notes && <p className="mt-0.5 text-xs text-[#64748B]">{act.notes}</p>}
              <p className="mt-0.5 text-[11px] text-[#94A3B8]">{act.created_by_name ?? 'Staff'} · {timeFmt(act.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Promises Tab ─────────────────────────────────────────────────────────────

function PromisesTab({ detail, accountId, onRefresh }: { detail: StudentFinanceDetail; accountId: string; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false)
  const [pending, start] = useTransition()
  const [err, setErr] = useState('')
  const [promises, setPromises] = useState<any[] | null>(null)

  if (promises === null && !pending) {
    start(async () => {
      const data = await fetchAccountPromises(accountId)
      setPromises(data)
    })
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr('')
    start(async () => {
      const r = await addPaymentPromise({
        student_id:      detail.account.student_id,
        account_id:      accountId,
        promised_amount: Number(fd.get('promised_amount')),
        promised_date:   fd.get('promised_date') as string,
        notes:           (fd.get('notes') as string) || undefined,
      })
      if (r && 'error' in r) { setErr(String(r.error ?? 'Error')); return }
      setShowAdd(false); setPromises(null)
    })
  }

  async function fulfill(id: string) {
    start(async () => {
      await markPromiseFulfilled(id)
      setPromises(null)
    })
  }

  const statusCls: Record<string, string> = {
    ACTIVE:    'bg-blue-50 text-blue-700',
    FULFILLED: 'bg-emerald-50 text-emerald-700',
    BROKEN:    'bg-red-50 text-red-600',
  }

  return (
    <div className="space-y-3">
      {promises === null ? (
        <div className="py-6 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#FF8A1F] border-t-transparent" /></div>
      ) : promises.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#94A3B8]">No promises recorded.</p>
      ) : (
        <div className="space-y-2">
          {promises.map((p: any) => (
            <div key={p.id} className="flex items-start justify-between rounded-lg border border-[#E2E8F0] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#0B1F3A]">EGP {fmt(p.promised_amount)}</p>
                <p className="text-[11px] text-[#64748B]">By {dateFmt(p.promised_date)}</p>
                {p.notes && <p className="text-[11px] text-[#94A3B8]">{p.notes}</p>}
                <p className="text-[11px] text-[#94A3B8]">{p.created_by_name ?? 'Staff'}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusCls[p.status] ?? ''}`}>{p.status}</span>
                {p.status === 'ACTIVE' && (
                  <button onClick={() => fulfill(p.id)} disabled={pending}
                    className="text-[11px] text-emerald-600 hover:underline disabled:opacity-50">
                    Mark Fulfilled
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <form onSubmit={handleAdd} className="space-y-3 rounded-xl border border-[#E2E8F0] p-4">
          <p className="text-xs font-semibold text-[#0B1F3A]">Record Promise to Pay</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Amount (EGP) *</label>
              <input name="promised_amount" type="number" min="1" step="0.01" required
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#64748B]">Promised By *</label>
              <input name="promised_date" type="date" required
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
            </div>
          </div>
          <input name="notes" placeholder="Notes (optional)"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending}
              className="flex-1 rounded-lg bg-[#0B1F3A] py-2 text-sm font-semibold text-white disabled:opacity-50">
              {pending ? '…' : 'Save Promise'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm text-[#64748B]">Cancel</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowAdd(true)}
          className="w-full rounded-xl border-2 border-dashed border-[#E2E8F0] py-3 text-sm text-[#64748B] hover:border-[#FF8A1F]/40 hover:text-[#FF8A1F]">
          + Record Promise to Pay
        </button>
      )}
    </div>
  )
}

// ─── Quick Actions Footer ─────────────────────────────────────────────────────

function QuickActionsFooter({
  detail, accountId, onRefresh, setTab,
}: {
  detail:    StudentFinanceDetail
  accountId: string
  onRefresh: () => void
  setTab:    (t: ModalTab) => void
}) {
  const [pending, startPending] = useTransition()
  const { student, account }    = detail

  function buildWaLink(phone: string | null) {
    if (!phone) return null
    const clean = phone.replace(/\D/g, '').replace(/^0/, '20')
    const msg = encodeURIComponent(
      `عزيزي ولي الأمر،\nنود تذكيركم بأن الدفعة المستحقة من ${student.name} بمبلغ EGP ${fmt(account.remaining_amount)} لم يتم سدادها.${account.next_due_date ? `\nتاريخ الاستحقاق: ${dateFmt(account.next_due_date)}` : ''}\nيرجى التواصل معنا في أقرب وقت. شكراً 🙏\nRobocode Academy`
    )
    return `https://wa.me/${clean}?text=${msg}`
  }

  async function logActivity(type: ActivityType) {
    startPending(async () => {
      await recordActivity({ student_id: account.student_id, account_id: accountId, activity_type: type })
      onRefresh()
    })
  }

  const waLink = buildWaLink(student.parent_phone_1 ?? student.parent_phone_2)

  return (
    <div className="shrink-0 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Quick Actions</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab('payment')}
          className="rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#e87c18]">
          + Payment
        </button>
        {waLink && (
          <a href={waLink} target="_blank" rel="noreferrer"
            onClick={() => logActivity('WHATSAPP')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1eb955]">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M10 0C4.477 0 0 4.373 0 9.763c0 1.73.456 3.359 1.254 4.769L0 20l5.587-1.455A10.08 10.08 0 0010 19.527C15.523 19.527 20 15.154 20 9.763 20 4.373 15.523 0 10 0zm5.194 13.7c-.22.612-1.288 1.172-1.76 1.21-.47.037-.486.356-3.063-.713-2.89-1.21-4.68-4.163-4.82-4.354-.14-.19-1.142-1.524-1.142-2.906 0-1.38.714-2.056.968-2.336.254-.28.553-.35.737-.35l.53.01c.17.009.4-.065.625.477.228.55.773 1.895.843 2.033.07.137.115.3.023.48-.092.18-.138.29-.276.447-.137.157-.29.35-.413.472-.137.137-.28.285-.12.558.16.273.71 1.17 1.525 1.895 1.047.933 1.93 1.22 2.203 1.36.273.138.433.115.593-.07.16-.185.687-.8.872-1.074.186-.274.37-.23.624-.138.254.092 1.616.762 1.893.9.277.138.46.207.527.32.067.113.067.65-.154 1.26z"/>
            </svg>
            WhatsApp
          </a>
        )}
        {student.parent_phone_1 && (
          <a href={`tel:${student.parent_phone_1}`} onClick={() => logActivity('CALL')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-600">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
            Call
          </a>
        )}
        <button onClick={() => setTab('notes')}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748B] hover:border-[#FF8A1F]/40 hover:text-[#FF8A1F]">
          + Note
        </button>
        <button disabled={pending} onClick={() => logActivity('PAYMENT_REMINDER')}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748B] hover:border-[#FF8A1F]/40 hover:text-[#FF8A1F] disabled:opacity-50">
          {pending ? '…' : 'Log Reminder'}
        </button>
        <button onClick={() => setTab('activities')}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748B] hover:border-[#FF8A1F]/40 hover:text-[#FF8A1F]">
          Activities
        </button>
      </div>
    </div>
  )
}
