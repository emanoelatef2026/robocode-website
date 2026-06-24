'use client'

import { useEffect, useState, useCallback, useTransition } from 'react'
import type { StudentOperationsRow, StudentOpsDetail, PaymentMethod } from '@/modules/finance/types'
import {
  RISK_LEVEL_CLASSES, RISK_FLAG_LABELS,
  PAYMENT_METHOD_LABELS, ACTIVITY_TYPE_LABELS,
  STATUS_COLORS, STATUS_LABELS,
  INSTALLMENT_STATUS_COLORS,
} from '@/modules/finance/types'
import { addPayment } from '@/modules/finance/actions'

type Tab = 'overview' | 'payments' | 'attendance' | 'installments' | 'followup'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview',     label: 'Overview'     },
  { key: 'payments',     label: 'Payments'     },
  { key: 'attendance',   label: 'Attendance'   },
  { key: 'installments', label: 'Installments' },
  { key: 'followup',     label: 'Follow-Up'    },
]

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const ATTENDANCE_COLORS: Record<string, string> = {
  present:  'bg-[#E7F8EE] text-[#15803D]',
  late:     'bg-[#FFFBEB] text-[#B45309]',
  makeup:   'bg-[#EFF6FF] text-[#1D4ED8]',
  absent:   'bg-[#FEE2E2] text-[#EF4444]',
  excused:  'bg-purple-50 text-purple-700',
}

const ACTIVITY_ICONS: Record<string, string> = {
  CALL:             '📞',
  WHATSAPP:         '💬',
  PORTAL_MESSAGE:   '✉️',
  FOLLOW_UP:        '📋',
  PAYMENT_REMINDER: '💰',
}

interface Props {
  student: StudentOperationsRow
  onClose: () => void
}

export default function StudentOpsModal({ student, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [detail, setDetail]       = useState<StudentOpsDetail | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Inline payment form state
  const [showPayForm,  setShowPayForm]  = useState(false)
  const [payAmount,    setPayAmount]    = useState('')
  const [payMethod,    setPayMethod]    = useState<PaymentMethod>('cash')
  const [payDate,      setPayDate]      = useState(new Date().toISOString().slice(0, 10))
  const [payRef,       setPayRef]       = useState('')
  const [payNotes,     setPayNotes]     = useState('')
  const [payError,     setPayError]     = useState<string | null>(null)
  const [isPending,    startTransition] = useTransition()

  function handleAddPayment() {
    if (!student.account_id) return
    const amount = parseFloat(payAmount)
    if (!amount || amount <= 0) { setPayError('Enter a valid amount'); return }
    setPayError(null)
    startTransition(async () => {
      const res = await addPayment({
        account_id:       student.account_id!,
        student_id:       student.student_id,
        amount,
        payment_date:     payDate,
        payment_method:   payMethod,
        reference_number: payRef || undefined,
        notes:            payNotes || undefined,
      })
      if (res && 'error' in res) {
        setPayError(res.error)
      } else {
        setShowPayForm(false)
        setPayAmount(''); setPayRef(''); setPayNotes('')
        // Refresh detail so new payment appears
        setDetail(null)
        fetchDetail()
      }
    })
  }

  const fetchDetail = useCallback(async () => {
    if (detail) return
    setLoading(true)
    setError(null)
    try {
      // Pass enrollment_id so the API filters attendance to this enrollment's start_date
      const qs = student.enrollment_id ? `?enrollmentId=${student.enrollment_id}` : ''
      const res = await fetch(`/api/student-ops/${student.student_id}${qs}`)
      if (!res.ok) throw new Error('Failed to load student detail')
      setDetail(await res.json())
    } catch (e: any) {
      setError(e.message ?? 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [student.student_id, student.enrollment_id, detail])

  useEffect(() => {
    if (activeTab !== 'overview') fetchDetail()
  }, [activeTab, fetchDetail])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const parentPhone = student.parent_phone_1 || student.parent_phone_2

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <div className="relative w-full max-w-4xl rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-[#0B1F3A]">{student.student_name}</h2>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${RISK_LEVEL_CLASSES[student.risk_level]}`}>
                {student.risk_level} RISK
              </span>
            </div>
            <p className="mt-0.5 text-sm text-[#64748B]">
              {student.group_name ?? 'No group'} · {student.branch_name}
              {student.student_code && <span className="ml-2 text-xs text-[#94A3B8]">#{student.student_code}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {student.parent_phone_1 && (
              <a
                href={`https://wa.me/${student.parent_phone_1.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-[#E7F8EE] px-3 py-1.5 text-xs font-medium text-[#15803D] hover:bg-[#E7F8EE]"
              >
                WhatsApp
              </a>
            )}
            {student.parent_phone_1 && (
              <a
                href={`tel:${student.parent_phone_1}`}
                className="inline-flex items-center gap-1 rounded-lg bg-[#EFF6FF] px-3 py-1.5 text-xs font-medium text-[#1D4ED8] hover:bg-[#EFF6FF]"
              >
                Call
              </a>
            )}
            <button
              onClick={onClose}
              className="ml-2 rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9]"
              aria-label="Close"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-0.5 overflow-x-auto border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 pt-2">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`shrink-0 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'border-b-2 border-[#FF8A1F] bg-white text-[#0B1F3A]'
                  : 'text-[#64748B] hover:text-[#0B1F3A]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="max-h-[65vh] overflow-y-auto p-6">

          {/* ── TAB: OVERVIEW ─────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-5">

              {/* Risk flags */}
              {student.risk_flags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {student.risk_flags.map(f => (
                    <span key={f} className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${RISK_LEVEL_CLASSES[student.risk_level]}`}>
                      {RISK_FLAG_LABELS[f] ?? f}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Student info */}
                <div className="rounded-xl border border-[#E2E8F0] p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#64748B]">Student</h3>
                  <dl className="space-y-2">
                    <Row label="Name"   value={student.student_name} />
                    <Row label="Code"   value={student.student_code ?? '—'} />
                    <Row label="Phone"  value={student.student_phone ?? '—'} />
                    <Row label="Branch" value={student.branch_name} />
                  </dl>
                </div>

                {/* Parent info */}
                <div className="rounded-xl border border-[#E2E8F0] p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#64748B]">Parent / Guardian</h3>
                  <dl className="space-y-2">
                    <Row label="Name"    value={student.parent_name ?? '—'} />
                    <Row label="Phone 1" value={student.parent_phone_1 ?? '—'} />
                    <Row label="Phone 2" value={student.parent_phone_2 ?? '—'} />
                  </dl>
                </div>

                {/* Group info */}
                <div className="rounded-xl border border-[#E2E8F0] p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#64748B]">Group & Instructor</h3>
                  <dl className="space-y-2">
                    <Row label="Group"       value={student.group_name ?? '—'} />
                    <Row label="Joined Date" value={fmtDate(student.group_start_date)} />
                    <Row label="Instructor"  value={student.instructor_name ?? '—'} />
                    {student.enrollment_id && (
                      <Row label="Enrollment" value={
                        <span className="rounded-full bg-[#EFF6FF] px-1.5 py-0.5 text-[10px] font-medium text-[#2563EB]">
                          Enrolled ✓
                        </span>
                      } />
                    )}
                  </dl>
                </div>

                {/* Attendance summary */}
                <div className="rounded-xl border border-[#E2E8F0] p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#64748B]">Attendance</h3>
                  <dl className="space-y-2">
                    <Row label="Attended"   value={`${student.sessions_attended} / ${student.total_sessions} sessions`} />
                    <Row label="Rate" value={
                      <span className={`font-semibold ${student.attendance_pct >= 80 ? 'text-[#10B981]' : student.attendance_pct >= 60 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
                        {student.attendance_pct}%
                      </span>
                    } />
                    <Row label="Last Seen"  value={fmtDate(student.last_attendance_date)} />
                    <Row label="Consec. Absences" value={
                      <span className={student.consecutive_absences >= 3 ? 'font-semibold text-[#EF4444]' : ''}>
                        {student.consecutive_absences}
                      </span>
                    } />
                  </dl>
                </div>
              </div>

              {/* Finance summary */}
              {student.account_id && (
                <div className="rounded-xl border border-[#E2E8F0] p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#64748B]">Finance Summary</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Kpi label="Total"     value={`EGP ${fmt(student.net_amount)}`} />
                    <Kpi label="Paid"      value={`EGP ${fmt(student.paid_amount)}`} color="text-[#10B981]" />
                    <Kpi label="Remaining" value={`EGP ${fmt(student.remaining_amount)}`} color={student.remaining_amount > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'} />
                    <Kpi label="Status"    value={
                      student.financial_status
                        ? <span className={`inline-block rounded-full px-2 py-0.5 text-xs border ${STATUS_COLORS[student.financial_status]}`}>
                            {STATUS_LABELS[student.financial_status]}
                          </span>
                        : '—'
                    } />
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-[#94A3B8]">
                      <span>Payment progress</span>
                      <span>{student.payment_progress_pct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#F1F5F9]">
                      <div
                        className={`h-full rounded-full ${student.payment_progress_pct >= 80 ? 'bg-[#10B981]' : student.payment_progress_pct >= 50 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`}
                        style={{ width: `${Math.min(100, student.payment_progress_pct)}%` }}
                      />
                    </div>
                  </div>
                  {student.next_due_date && (
                    <p className="mt-2 text-xs text-[#64748B]">
                      Next due: <span className={student.days_overdue > 0 ? 'font-medium text-[#EF4444]' : 'font-medium'}>{fmtDate(student.next_due_date)}</span>
                      {student.days_overdue > 0 && <span className="ml-1 text-[#EF4444]">({student.days_overdue}d overdue)</span>}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Loading / error state (other tabs) ────────────────────────── */}
          {activeTab !== 'overview' && loading && (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FF8A1F] border-t-transparent" />
            </div>
          )}
          {activeTab !== 'overview' && error && (
            <div className="rounded-xl border border-[#FECACA] bg-[#FEE2E2] px-4 py-3 text-sm text-[#EF4444]">{error}</div>
          )}

          {/* ── TAB: PAYMENTS ─────────────────────────────────────────────── */}
          {activeTab === 'payments' && detail && !loading && (
            <div className="space-y-3">

              {/* Add payment CTA */}
              {student.account_id && !showPayForm && (
                <button
                  onClick={() => setShowPayForm(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#FF8A1F] bg-orange-50 py-3 text-sm font-medium text-[#FF8A1F] hover:bg-orange-100"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Record Payment
                </button>
              )}

              {/* Inline payment form */}
              {showPayForm && (
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-[#0B1F3A]">Record Payment</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-[#94A3B8] mb-1">Amount (EGP)</label>
                      <input
                        type="number" min="1"
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        placeholder="e.g. 500"
                        autoFocus
                        className="w-full ds-card px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#94A3B8] mb-1">Method</label>
                      <select
                        value={payMethod}
                        onChange={e => setPayMethod(e.target.value as PaymentMethod)}
                        className="w-full ds-card px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                      >
                        {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#94A3B8] mb-1">Payment Date</label>
                      <input
                        type="date"
                        value={payDate}
                        onChange={e => setPayDate(e.target.value)}
                        className="w-full ds-card px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#94A3B8] mb-1">Reference (optional)</label>
                      <input
                        value={payRef}
                        onChange={e => setPayRef(e.target.value)}
                        placeholder="e.g. Instapay ref"
                        className="w-full ds-card px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                      />
                    </div>
                  </div>
                  <input
                    value={payNotes}
                    onChange={e => setPayNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="w-full ds-card px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                  />
                  {payError && <p className="text-xs text-[#EF4444]">{payError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowPayForm(false); setPayError(null) }}
                      className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-sm text-[#64748B] hover:border-[#CBD5E1]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddPayment}
                      disabled={isPending}
                      className="flex-1 rounded-lg bg-[#FF8A1F] py-2 text-sm font-medium text-white hover:bg-[#e87c18] disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {isPending ? <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Saving…</> : 'Save Payment'}
                    </button>
                  </div>
                </div>
              )}

              {detail.payments.length === 0 && !showPayForm ? (
                <Empty msg="No payments recorded yet." />
              ) : (
                detail.payments.map((p, i) => {
                  const runningPaid = detail.payments.slice(i).reduce((s, x) => s + x.amount, 0)
                  return (
                    <div key={p.id} className="flex items-start gap-4 rounded-xl border border-[#E2E8F0] p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E7F8EE] text-[#15803D]">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path d="M10.75 10.818v2.614A3.13 3.13 0 0011.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.546-.612-.875a3.13 3.13 0 00-1.138-.432zM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 00-.35.13c-.14.065-.27.143-.386.233-.377.292-.514.627-.514.909 0 .184.058.39.33.615z" />
                          <path fillRule="evenodd" d="M9.99 2C5.57 2 2 5.571 2 9.99 2 14.41 5.571 18 9.99 18c4.42 0 7.99-3.571 7.99-7.99C17.98 5.57 14.41 2 9.99 2zM9.25 4.447v.733a3.985 3.985 0 00-1.985 1.021 2.906 2.906 0 00-.95 2.154c0 .99.47 1.79 1.117 2.309.47.375 1.074.647 1.818.798v2.931a3.99 3.99 0 01-2.48-1.374l-1.06 1.061a5.493 5.493 0 003.54 1.82v.641h1.5v-.667a4.53 4.53 0 001.983-1.019 2.956 2.956 0 001-2.238c0-1.022-.49-1.837-1.16-2.369-.473-.376-1.082-.65-1.823-.801V7.191a2.47 2.47 0 011.733 1.052l1.1-1.008A3.98 3.98 0 0010.75 5.88v-.733h-1.5z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-[#15803D]">EGP {fmt(p.amount)}</p>
                          <span className="text-xs text-[#94A3B8]">{fmtDate(p.payment_date)}</span>
                        </div>
                        <p className="text-xs text-[#64748B]">
                          {PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}
                          {p.reference_number && <span className="ml-2">Ref: {p.reference_number}</span>}
                        </p>
                        {p.notes && <p className="mt-1 text-xs text-[#94A3B8]">{p.notes}</p>}
                        {p.created_by_name && <p className="mt-0.5 text-[11px] text-[#94A3B8]">Recorded by {p.created_by_name}</p>}
                        <p className="mt-0.5 text-[11px] text-[#94A3B8]">Remaining after: EGP {fmt(student.net_amount - runningPaid)}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* ── TAB: ATTENDANCE ───────────────────────────────────────────── */}
          {activeTab === 'attendance' && detail && !loading && (
            <div className="space-y-1">
              {detail.attendance_sessions.length === 0 ? (
                <Empty msg="No sessions found for this group." />
              ) : (
                <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="ds-table-head">
                      <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Date</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Topic</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Status</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.attendance_sessions.map(sess => {
                        const attStatus = sess.attendance_status
                        const attColor  = attStatus ? (ATTENDANCE_COLORS[attStatus] ?? 'bg-[#F8FAFC] text-[#475569]') : 'bg-[#F8FAFC] text-[#94A3B8]'
                        return (
                          <tr key={sess.schedule_id} className="ds-table-row">
                            <td className="px-4 py-2.5 text-xs text-[#64748B]">{fmtDate(sess.scheduled_at)}</td>
                            <td className="px-4 py-2.5 text-xs text-[#0B1F3A]">{sess.topic ?? <span className="text-[#94A3B8]">—</span>}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                sess.session_status === 'completed' ? 'bg-[#E7F8EE] text-[#15803D]' :
                                sess.session_status === 'scheduled' ? 'bg-[#EFF6FF] text-[#1D4ED8]' :
                                'bg-[#F8FAFC] text-[#475569]'
                              }`}>
                                {sess.session_status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${attColor}`}>
                                {attStatus ?? 'No record'}
                              </span>
                              {sess.late_minutes && <span className="ml-1 text-[10px] text-[#94A3B8]">{sess.late_minutes}m late</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: INSTALLMENTS ─────────────────────────────────────────── */}
          {activeTab === 'installments' && detail && !loading && (
            <div className="space-y-3">
              {detail.installments.length === 0 ? (
                <Empty msg="No installments configured for this account." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {detail.installments.map(inst => {
                    const today    = new Date().toISOString().slice(0, 10)
                    const isLate   = inst.status !== 'PAID' && inst.due_date < today
                    const daysLate = isLate
                      ? Math.floor((Date.now() - new Date(inst.due_date).getTime()) / 86400000)
                      : 0
                    return (
                      <div key={inst.id} className={`rounded-xl border p-4 ${isLate ? 'border-[#FECACA] bg-[#FEE2E2]/30' : 'border-[#E2E8F0]'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-[#64748B]">Installment #{inst.installment_number}</span>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${INSTALLMENT_STATUS_COLORS[inst.status]}`}>
                            {inst.status}
                          </span>
                        </div>
                        <p className="text-lg font-bold text-[#0B1F3A]">EGP {fmt(inst.amount)}</p>
                        <div className="mt-2 space-y-0.5 text-xs text-[#64748B]">
                          <p>Due: <span className={isLate ? 'text-[#EF4444] font-medium' : ''}>{fmtDate(inst.due_date)}</span></p>
                          {inst.paid_amount > 0 && <p>Paid: <span className="text-[#10B981]">EGP {fmt(inst.paid_amount)}</span></p>}
                          {inst.paid_amount < inst.amount && <p>Remaining: <span className="font-medium">EGP {fmt(inst.amount - inst.paid_amount)}</span></p>}
                          {isLate && daysLate > 0 && <p className="text-[#EF4444] font-medium">{daysLate} days late</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: FOLLOW-UP ─────────────────────────────────────────────── */}
          {activeTab === 'followup' && detail && !loading && (
            <div className="space-y-4">
              {/* Quick action buttons */}
              <div className="flex flex-wrap gap-2">
                {student.parent_phone_1 && (
                  <>
                    <a
                      href={`https://wa.me/${student.parent_phone_1.replace(/\D/g, '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#E7F8EE] px-3 py-2 text-sm font-medium text-[#15803D] hover:bg-[#E7F8EE]"
                    >
                      💬 WhatsApp Parent
                    </a>
                    <a
                      href={`tel:${student.parent_phone_1}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#EFF6FF] px-3 py-2 text-sm font-medium text-[#1D4ED8] hover:bg-[#EFF6FF]"
                    >
                      📞 Call Parent
                    </a>
                  </>
                )}
              </div>

              {/* Activity timeline */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#64748B]">Activity Timeline</h4>
                {detail.activities.length === 0 && detail.notes.length === 0 && detail.promises.length === 0 ? (
                  <Empty msg="No follow-up activity recorded yet." />
                ) : (
                  <div className="space-y-2">
                    {/* Promises */}
                    {detail.promises.map(p => (
                      <div key={p.id} className={`rounded-xl border p-3 ${p.status === 'BROKEN' ? 'border-[#FECACA] bg-[#FEE2E2]' : p.status === 'FULFILLED' ? 'border-[#A7F3D0] bg-[#E7F8EE]' : 'border-[#FDE68A] bg-[#FFFBEB]'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#0B1F3A]">💰 Payment Promise — EGP {fmt(p.promised_amount)}</span>
                          <span className={`text-[10px] font-medium ${p.status === 'BROKEN' ? 'text-[#EF4444]' : p.status === 'FULFILLED' ? 'text-[#15803D]' : 'text-[#B45309]'}`}>{p.status}</span>
                        </div>
                        <p className="text-xs text-[#64748B]">By {fmtDate(p.promised_date)}</p>
                        {p.notes && <p className="mt-1 text-xs text-[#94A3B8]">{p.notes}</p>}
                        <p className="mt-0.5 text-[11px] text-[#94A3B8]">{fmtDate(p.created_at)}{p.created_by_name && ` · ${p.created_by_name}`}</p>
                      </div>
                    ))}

                    {/* Activities */}
                    {detail.activities.map(a => (
                      <div key={a.id} className="rounded-xl border border-[#E2E8F0] p-3">
                        <div className="flex items-center gap-2">
                          <span>{ACTIVITY_ICONS[a.activity_type] ?? '📋'}</span>
                          <span className="text-xs font-medium text-[#0B1F3A]">{ACTIVITY_TYPE_LABELS[a.activity_type] ?? a.activity_type}</span>
                          <span className="ml-auto text-[11px] text-[#94A3B8]">{fmtDate(a.created_at)}</span>
                        </div>
                        {a.notes && <p className="mt-1 text-xs text-[#64748B]">{a.notes}</p>}
                        {a.created_by_name && <p className="mt-0.5 text-[11px] text-[#94A3B8]">{a.created_by_name}</p>}
                      </div>
                    ))}

                    {/* Notes */}
                    {detail.notes.map(n => (
                      <div key={n.id} className={`rounded-xl border p-3 ${n.is_internal ? 'border-slate-200 bg-[#F8FAFC]' : 'border-[#E2E8F0]'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-[#0B1F3A]">📝 Note{n.is_internal ? ' (internal)' : ''}</span>
                          <span className="ml-auto text-[11px] text-[#94A3B8]">{fmtDate(n.created_at)}</span>
                        </div>
                        <p className="text-xs text-[#64748B]">{n.note_text}</p>
                        {n.created_by_name && <p className="mt-0.5 text-[11px] text-[#94A3B8]">{n.created_by_name}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="shrink-0 text-xs text-[#94A3B8]">{label}</dt>
      <dd className="text-right text-xs font-medium text-[#0B1F3A]">{value}</dd>
    </div>
  )
}

function Kpi({ label, value, color = 'text-[#0B1F3A]' }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-lg bg-[#F8FAFC] p-2.5">
      <p className="text-[11px] text-[#64748B]">{label}</p>
      <div className={`mt-0.5 text-sm font-bold ${color}`}>{value}</div>
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-6 py-8 text-center">
      <p className="text-sm text-[#94A3B8]">{msg}</p>
    </div>
  )
}
