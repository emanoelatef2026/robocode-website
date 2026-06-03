'use client'
import { useState, useTransition, useCallback } from 'react'
import { fetchStudentFinanceDetail } from '@/modules/finance/actions'
import { addPayment, addFinanceNote, recordActivity, addInstallment, addPaymentPromise, markPromiseFulfilled, updateAccountDiscount } from '@/modules/finance/actions'
import {
  STATUS_COLORS, STATUS_LABELS, INSTALLMENT_STATUS_COLORS,
  PAYMENT_METHOD_LABELS, ACTIVITY_TYPE_LABELS, PRIORITY_COLORS,
  type StudentFinanceDetail, type PaymentMethod, type ActivityType,
} from '@/modules/finance/types'
import Link from 'next/link'

type WidgetTab = 'summary' | 'installments' | 'payment' | 'notes' | 'activities' | 'promises' | 'discount'

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}
function dateFmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  accountId:  string | null
  studentId:  string
  branchId:   string
}

export default function StudentFinanceWidget({ accountId, studentId, branchId }: Props) {
  const [detail,  setDetail]  = useState<StudentFinanceDetail | null>(null)
  const [loaded,  setLoaded]  = useState(false)
  const [loading, startLoad]  = useTransition()
  const [tab,     setTab]     = useState<WidgetTab>('summary')

  const load = useCallback(() => {
    if (!accountId) return
    startLoad(async () => {
      const data = await fetchStudentFinanceDetail(accountId)
      setDetail(data)
      setLoaded(true)
    })
  }, [accountId])

  const refresh = useCallback(() => {
    if (!accountId) return
    startLoad(async () => {
      const data = await fetchStudentFinanceDetail(accountId)
      setDetail(data)
    })
  }, [accountId])

  if (!accountId) {
    return (
      <div className="rounded-xl border border-dashed border-[#E2E8F0] px-6 py-10 text-center">
        <p className="text-sm font-medium text-[#0B1F3A]">No financial account</p>
        <p className="mt-1 text-xs text-[#94A3B8]">Create a financial account to start tracking payments.</p>
        <Link
          href={`/admin/finance/new?student=${studentId}`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e87c18]"
        >
          Create Account
        </Link>
      </div>
    )
  }

  if (!loaded && !loading) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-center">
        <button
          onClick={load}
          className="rounded-xl bg-[#FF8A1F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e87c18]"
        >
          Load Finance Data
        </button>
      </div>
    )
  }

  if (loading && !detail) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-[#E2E8F0] bg-white py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF8A1F] border-t-transparent" />
      </div>
    )
  }

  if (!detail) return null

  const { account, student } = detail
  const pct = account.net_amount > 0 ? Math.round((account.paid_amount / account.net_amount) * 100) : 0

  const tabs: { id: WidgetTab; label: string }[] = [
    { id: 'summary',      label: 'Summary' },
    { id: 'installments', label: `Installments (${detail.installments.length})` },
    { id: 'payment',      label: '+ Payment' },
    { id: 'promises',     label: 'Promises' },
    { id: 'notes',        label: `Notes (${detail.notes.length})` },
    { id: 'activities',   label: `Activities (${detail.activities.length})` },
    { id: 'discount',     label: 'Discount' },
  ]

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">

      {/* Finance header bar */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[account.status]}`}>
            {STATUS_LABELS[account.status]}
          </span>
          <span className="text-sm font-bold text-red-500">
            EGP {fmt(account.remaining_amount)} remaining
          </span>
          <span className="hidden sm:inline text-xs text-[#64748B]">
            of EGP {fmt(account.net_amount)} net
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2">
            <div className="h-2 w-20 overflow-hidden rounded-full bg-[#F1F5F9]">
              <div className="h-full rounded-full bg-[#FF8A1F]" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-[#64748B]">{pct}%</span>
          </div>
          <Link
            href={`/admin/finance?q=${encodeURIComponent(student.name)}`}
            className="text-xs font-medium text-[#FF8A1F] hover:underline"
          >
            Full View →
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-[#E2E8F0] px-2">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'whitespace-nowrap px-3 py-2.5 text-[13px] font-medium border-b-2 transition-colors shrink-0',
              tab === t.id
                ? 'border-[#FF8A1F] text-[#FF8A1F]'
                : 'border-transparent text-[#64748B] hover:text-[#0B1F3A]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {tab === 'summary' && <SummaryTab detail={detail} />}
        {tab === 'installments' && <InstallmentsTab detail={detail} accountId={accountId} onRefresh={refresh} />}
        {tab === 'payment' && <PaymentTab detail={detail} accountId={accountId} onRefresh={refresh} />}
        {tab === 'promises' && <PromisesTab detail={detail} accountId={accountId} studentId={studentId} onRefresh={refresh} />}
        {tab === 'notes' && <NotesTab detail={detail} accountId={accountId} onRefresh={refresh} />}
        {tab === 'activities' && <ActivitiesTab detail={detail} accountId={accountId} onRefresh={refresh} />}
        {tab === 'discount' && <DiscountTab detail={detail} accountId={accountId} onRefresh={refresh} />}
      </div>

      {/* Quick actions */}
      <QuickActionsBar detail={detail} accountId={accountId} setTab={setTab} onRefresh={refresh} />
    </div>
  )
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function SummaryTab({ detail }: { detail: StudentFinanceDetail }) {
  const { account } = detail
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-[#E2E8F0] rounded-xl overflow-hidden border border-[#E2E8F0]">
        {[
          { l: 'Total',     v: `EGP ${fmt(account.total_amount)}`,     c: 'text-[#0B1F3A]' },
          { l: 'Discount',  v: `-EGP ${fmt(account.discount_amount)}`, c: 'text-emerald-600' },
          { l: 'Net Total', v: `EGP ${fmt(account.net_amount)}`,       c: 'font-bold text-[#0B1F3A]' },
          { l: 'Paid',      v: `EGP ${fmt(account.paid_amount)}`,      c: 'font-bold text-emerald-600' },
          { l: 'Remaining', v: `EGP ${fmt(account.remaining_amount)}`, c: `font-bold ${account.remaining_amount > 0 ? 'text-red-500' : 'text-[#94A3B8]'}` },
          { l: 'Next Due',  v: dateFmt(account.next_due_date),         c: 'text-[#0B1F3A]' },
        ].map(({ l, v, c }) => (
          <div key={l} className="bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">{l}</p>
            <p className={`mt-0.5 text-sm ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      {detail.payments.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Recent Payments</p>
          <div className="space-y-1.5">
            {detail.payments.slice(0, 3).map(p => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-[#F8FAFC] px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-emerald-600">EGP {fmt(p.amount)}</p>
                  <p className="text-[11px] text-[#94A3B8]">{PAYMENT_METHOD_LABELS[p.payment_method]} · {dateFmt(p.payment_date)}</p>
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

// ─── Installments ─────────────────────────────────────────────────────────────

function InstallmentsTab({ detail, accountId, onRefresh }: { detail: StudentFinanceDetail; accountId: string; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false)
  const [pending, start] = useTransition()
  const [err, setErr] = useState('')

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr('')
    start(async () => {
      const r = await addInstallment({
        account_id: accountId,
        installment_number: detail.installments.length + 1,
        amount: Number(fd.get('amount')),
        due_date: fd.get('due_date') as string,
        notes: (fd.get('notes') as string) || undefined,
      })
      if (r?.error) { setErr(r.error); return }
      setShowAdd(false); onRefresh()
    })
  }

  return (
    <div className="space-y-3">
      {detail.installments.length === 0 ? (
        <p className="py-4 text-center text-sm text-[#94A3B8]">No installments yet.</p>
      ) : (
        <div className="space-y-2">
          {detail.installments.map(inst => (
            <div key={inst.id} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#0B1F3A]">#{inst.installment_number} — EGP {fmt(inst.amount)}</p>
                <p className="text-[11px] text-[#64748B]">Due: {dateFmt(inst.due_date)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-emerald-600">Paid: EGP {fmt(inst.paid_amount)}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${INSTALLMENT_STATUS_COLORS[inst.status]}`}>{inst.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {showAdd ? (
        <form onSubmit={handleAdd} className="space-y-3 rounded-xl border border-[#E2E8F0] p-3">
          <div className="grid grid-cols-2 gap-2">
            <input name="amount" type="number" min="1" step="0.01" required placeholder="Amount *"
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
            <input name="due_date" type="date" required
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
          </div>
          <input name="notes" placeholder="Notes (optional)"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending}
              className="flex-1 rounded-lg bg-[#FF8A1F] py-2 text-sm font-semibold text-white disabled:opacity-50">
              {pending ? '…' : 'Add'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#64748B]">Cancel</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowAdd(true)}
          className="w-full rounded-xl border-2 border-dashed border-[#E2E8F0] py-2.5 text-sm text-[#64748B] hover:border-[#FF8A1F]/40 hover:text-[#FF8A1F]">
          + Add Installment
        </button>
      )}
    </div>
  )
}

// ─── Payment ──────────────────────────────────────────────────────────────────

function PaymentTab({ detail, accountId, onRefresh }: { detail: StudentFinanceDetail; accountId: string; onRefresh: () => void }) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState(''); const [ok, setOk] = useState(false)
  const pendingInsts = detail.installments.filter(i => i.status !== 'PAID')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr(''); setOk(false)
    start(async () => {
      const r = await addPayment({
        account_id: accountId, student_id: detail.account.student_id,
        amount: Number(fd.get('amount')),
        payment_date: fd.get('payment_date') as string,
        payment_method: fd.get('payment_method') as PaymentMethod,
        reference_number: (fd.get('reference_number') as string) || undefined,
        notes: (fd.get('notes') as string) || undefined,
        installment_id: (fd.get('installment_id') as string) || undefined,
      })
      if (r?.error) { setErr(r.error); return }
      setOk(true); ;(e.target as HTMLFormElement).reset(); onRefresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-3 py-2.5">
        <span className="text-xs text-[#64748B]">Remaining</span>
        <span className="font-bold text-red-500">EGP {fmt(detail.account.remaining_amount)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#64748B]">Amount *</label>
          <input name="amount" type="number" min="0.01" step="0.01" required
            defaultValue={detail.account.remaining_amount > 0 ? detail.account.remaining_amount : undefined}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#64748B]">Date *</label>
          <input name="payment_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
        </div>
      </div>
      <select name="payment_method" required
        className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20">
        {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      {pendingInsts.length > 0 && (
        <select name="installment_id"
          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20">
          <option value="">— General payment —</option>
          {pendingInsts.map(i => (
            <option key={i.id} value={i.id}>#{i.installment_number} · EGP {fmt(i.amount)} · {dateFmt(i.due_date)}</option>
          ))}
        </select>
      )}
      <input name="reference_number" placeholder="Reference # (optional)"
        className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
      {err && <p className="text-xs text-red-500">{err}</p>}
      {ok  && <p className="text-xs text-emerald-600">Payment recorded.</p>}
      <button type="submit" disabled={pending}
        className="w-full rounded-xl bg-[#FF8A1F] py-2.5 text-sm font-bold text-white disabled:opacity-50">
        {pending ? 'Recording…' : 'Record Payment'}
      </button>
    </form>
  )
}

// ─── Promises ─────────────────────────────────────────────────────────────────

function PromisesTab({ detail, accountId, studentId, onRefresh }: { detail: StudentFinanceDetail; accountId: string; studentId: string; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false)
  const [pending, start] = useTransition()
  const [err, setErr] = useState('')
  const [promises, setPromises] = useState<any[] | null>(null)

  // Load promises on mount
  if (promises === null && !pending) {
    start(async () => {
      const { fetchAccountPromises } = await import('@/modules/finance/actions')
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
        student_id:      studentId,
        account_id:      accountId,
        promised_amount: Number(fd.get('promised_amount')),
        promised_date:   fd.get('promised_date') as string,
        notes:           (fd.get('notes') as string) || undefined,
      })
      if (r?.error) { setErr(r.error); return }
      setShowAdd(false)
      setPromises(null) // trigger reload
    })
  }

  async function fulfill(id: string) {
    start(async () => {
      await markPromiseFulfilled(id)
      setPromises(null)
    })
  }

  const statusColors: Record<string, string> = {
    ACTIVE:    'bg-blue-50 text-blue-700',
    FULFILLED: 'bg-emerald-50 text-emerald-700',
    BROKEN:    'bg-red-50 text-red-600',
  }

  return (
    <div className="space-y-3">
      {promises === null ? (
        <div className="py-4 text-center"><div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#FF8A1F] border-t-transparent" /></div>
      ) : promises.length === 0 ? (
        <p className="py-4 text-center text-sm text-[#94A3B8]">No promises recorded.</p>
      ) : (
        <div className="space-y-2">
          {promises.map((p: any) => (
            <div key={p.id} className="flex items-start justify-between rounded-lg border border-[#E2E8F0] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#0B1F3A]">EGP {fmt(p.promised_amount)}</p>
                <p className="text-[11px] text-[#64748B]">By {dateFmt(p.promised_date)}</p>
                {p.notes && <p className="text-[11px] text-[#94A3B8]">{p.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColors[p.status] ?? ''}`}>{p.status}</span>
                {p.status === 'ACTIVE' && (
                  <button onClick={() => fulfill(p.id)} disabled={pending}
                    className="text-[11px] text-emerald-600 hover:underline disabled:opacity-50">Mark Fulfilled</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <form onSubmit={handleAdd} className="space-y-3 rounded-xl border border-[#E2E8F0] p-3">
          <p className="text-xs font-semibold text-[#0B1F3A]">Add Promise to Pay</p>
          <div className="grid grid-cols-2 gap-2">
            <input name="promised_amount" type="number" min="1" step="0.01" required placeholder="Amount *"
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
            <input name="promised_date" type="date" required
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
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
              className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#64748B]">Cancel</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowAdd(true)}
          className="w-full rounded-xl border-2 border-dashed border-[#E2E8F0] py-2.5 text-sm text-[#64748B] hover:border-[#FF8A1F]/40 hover:text-[#FF8A1F]">
          + Record Promise to Pay
        </button>
      )}
    </div>
  )
}

// ─── Notes ────────────────────────────────────────────────────────────────────

function NotesTab({ detail, accountId, onRefresh }: { detail: StudentFinanceDetail; accountId: string; onRefresh: () => void }) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr('')
    start(async () => {
      const r = await addFinanceNote({
        student_id: detail.account.student_id, account_id: accountId,
        note_text: fd.get('note_text') as string,
        is_internal: (e.currentTarget.elements.namedItem('is_internal') as HTMLInputElement)?.checked ?? false,
      })
      if (r?.error) { setErr(r.error); return }
      ;(e.target as HTMLFormElement).reset(); onRefresh()
    })
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea name="note_text" rows={2} required placeholder="Add finance note…"
          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20 resize-none" />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-[#64748B]">
            <input name="is_internal" type="checkbox" className="rounded" /> Internal
          </label>
          <button type="submit" disabled={pending}
            className="rounded-lg bg-[#FF8A1F] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            {pending ? '…' : 'Add'}
          </button>
        </div>
        {err && <p className="text-xs text-red-500">{err}</p>}
      </form>
      {detail.notes.length === 0 ? (
        <p className="py-3 text-center text-sm text-[#94A3B8]">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          {detail.notes.map(n => (
            <div key={n.id} className="rounded-xl bg-[#F8FAFC] p-3">
              <div className="flex items-start gap-2">
                <p className="flex-1 text-sm text-[#0B1F3A]">{n.note_text}</p>
                {n.is_internal && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Internal</span>}
              </div>
              <p className="mt-1 text-[11px] text-[#94A3B8]">{n.created_by_name ?? 'Staff'} · {dateFmt(n.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Activities ───────────────────────────────────────────────────────────────

const ACT_ICONS: Record<string, string> = {
  CALL: '📞', WHATSAPP: '💬', PORTAL_MESSAGE: '✉️', FOLLOW_UP: '🔁', PAYMENT_REMINDER: '🔔',
}

function ActivitiesTab({ detail, accountId, onRefresh }: { detail: StudentFinanceDetail; accountId: string; onRefresh: () => void }) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr('')
    start(async () => {
      const r = await recordActivity({
        student_id: detail.account.student_id, account_id: accountId,
        activity_type: fd.get('activity_type') as ActivityType,
        notes: (fd.get('notes') as string) || undefined,
      })
      if (r?.error) { setErr(r.error); return }
      ;(e.target as HTMLFormElement).reset(); onRefresh()
    })
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <select name="activity_type" required
          className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20">
          {(Object.entries(ACTIVITY_TYPE_LABELS) as [ActivityType, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <button type="submit" disabled={pending}
          className="rounded-lg bg-[#0B1F3A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? '…' : 'Log'}
        </button>
      </form>
      {err && <p className="text-xs text-red-500">{err}</p>}
      {detail.activities.length === 0 ? (
        <p className="py-3 text-center text-sm text-[#94A3B8]">No activities yet.</p>
      ) : (
        <div className="space-y-1.5">
          {detail.activities.slice(0, 8).map(act => (
            <div key={act.id} className="flex items-center gap-3 rounded-lg bg-[#F8FAFC] px-3 py-2">
              <span className="text-base">{ACT_ICONS[act.activity_type] ?? '•'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#0B1F3A]">{ACTIVITY_TYPE_LABELS[act.activity_type]}</p>
                {act.notes && <p className="truncate text-[11px] text-[#64748B]">{act.notes}</p>}
              </div>
              <p className="shrink-0 text-[11px] text-[#94A3B8]">{dateFmt(act.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Discount ─────────────────────────────────────────────────────────────────

function DiscountTab({ detail, accountId, onRefresh }: { detail: StudentFinanceDetail; accountId: string; onRefresh: () => void }) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState(''); const [ok, setOk] = useState(false)
  const { account } = detail

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr(''); setOk(false)
    start(async () => {
      const r = await updateAccountDiscount(accountId, Number(fd.get('discount_amount')))
      if (r?.error) { setErr(r.error); return }
      setOk(true); onRefresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl bg-[#F8FAFC] p-4 space-y-2">
        {[
          { l: 'Total Amount',     v: `EGP ${fmt(account.total_amount)}` },
          { l: 'Current Discount', v: `EGP ${fmt(account.discount_amount)}` },
          { l: 'Current Net',      v: `EGP ${fmt(account.net_amount)}` },
        ].map(({ l, v }) => (
          <div key={l} className="flex justify-between text-sm">
            <span className="text-[#64748B]">{l}</span>
            <span className="font-medium text-[#0B1F3A]">{v}</span>
          </div>
        ))}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[#64748B]">New Discount Amount (EGP)</label>
        <input name="discount_amount" type="number" min="0" max={account.total_amount} step="0.01"
          defaultValue={account.discount_amount}
          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8A1F]/20" />
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
      {ok  && <p className="text-xs text-emerald-600">Discount updated.</p>}
      <button type="submit" disabled={pending}
        className="w-full rounded-xl bg-[#FF8A1F] py-2.5 text-sm font-bold text-white disabled:opacity-50">
        {pending ? 'Updating…' : 'Update Discount'}
      </button>
    </form>
  )
}

// ─── Quick Actions Bar ────────────────────────────────────────────────────────

function QuickActionsBar({ detail, accountId, setTab, onRefresh }: {
  detail: StudentFinanceDetail; accountId: string
  setTab: (t: WidgetTab) => void; onRefresh: () => void
}) {
  const { student, account } = detail
  const [pending, start] = useTransition()

  function buildWa(phone: string | null) {
    if (!phone) return null
    const clean = phone.replace(/\D/g, '').replace(/^0/, '20')
    const msg = encodeURIComponent(
      `عزيزي ولي الأمر، نود تذكيركم بأن الدفعة المستحقة من ${student.name} بمبلغ EGP ${fmt(account.remaining_amount)} لم يتم سدادها.${account.next_due_date ? ` تاريخ الاستحقاق: ${dateFmt(account.next_due_date)}` : ''} يرجى التواصل معنا. شكراً 🙏 Robocode Academy`
    )
    return `https://wa.me/${clean}?text=${msg}`
  }

  async function logAct(type: ActivityType) {
    start(async () => {
      await recordActivity({ student_id: account.student_id, account_id: accountId, activity_type: type })
      onRefresh()
    })
  }

  const waLink = buildWa(student.parent_phone_1 ?? student.parent_phone_2)

  return (
    <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab('payment')}
          className="rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#e87c18]">
          + Payment
        </button>
        {waLink && (
          <a href={waLink} target="_blank" rel="noreferrer" onClick={() => logAct('WHATSAPP')}
            className="inline-flex items-center gap-1 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1eb955]">
            💬 WhatsApp
          </a>
        )}
        {student.parent_phone_1 && (
          <a href={`tel:${student.parent_phone_1}`} onClick={() => logAct('CALL')}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-600">
            📞 Call
          </a>
        )}
        <button onClick={() => setTab('promises')}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748B] hover:border-[#FF8A1F]/40 hover:text-[#FF8A1F]">
          Promise
        </button>
        <button disabled={pending} onClick={() => logAct('PAYMENT_REMINDER')}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748B] hover:border-[#FF8A1F]/40 hover:text-[#FF8A1F] disabled:opacity-50">
          {pending ? '…' : 'Log Reminder'}
        </button>
        <button onClick={() => setTab('discount')}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748B] hover:border-[#FF8A1F]/40 hover:text-[#FF8A1F]">
          Discount
        </button>
      </div>
    </div>
  )
}
