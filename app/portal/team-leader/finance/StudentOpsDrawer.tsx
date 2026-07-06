'use client'

import { useEffect, useState, useCallback, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type {
  StudentOperationsRow, StudentOpsDetail, PaymentMethod,
  FinancePayment, FinancePaymentReversal,
} from '@/modules/finance/types'
import {
  RISK_LEVEL_CLASSES, RISK_FLAG_LABELS,
  PAYMENT_METHOD_LABELS, ACTIVITY_TYPE_LABELS,
  STATUS_COLORS, STATUS_LABELS,
  INSTALLMENT_STATUS_COLORS,
  computeSessionExhaustion,
  SESSION_EXHAUSTION_LABELS, SESSION_EXHAUSTION_COLORS,
} from '@/modules/finance/types'
import {
  addPayment, quickPayment, addFinanceNote,
  recordActivity, addPaymentPromise, createReversal,
} from '@/modules/finance/actions'
import { compressImage } from '@/lib/uploads/compressImage'
import { buildWhatsAppUrl } from '@/lib/contact-utils'
import EnrollmentWizard, { type StudentResult, type PreselectedPackage } from './EnrollmentWizard'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDateShort(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Running balance computation ────────────────────────────────────────────────

function computeRunningBalance(
  payments: FinancePayment[],
  netAmount: number
): Map<string, { remainingAfter: number; runningPaid: number }> {
  const sorted = [...payments].sort((a, b) => a.payment_date.localeCompare(b.payment_date))
  const map = new Map<string, { remainingAfter: number; runningPaid: number }>()
  let running = 0
  for (const p of sorted) {
    running += p.amount
    const remainingAfter = Math.max(0, netAmount - running)
    map.set(p.id, { remainingAfter, runningPaid: Math.max(0, running) })
  }
  return map
}

// ── Timeline builder ──────────────────────────────────────────────────────────

type TL = {
  id: string; date: string; kind: string
  title: string; sub: string | null
  amount?: number; badge?: string; bColor?: string
  isCredit?: boolean; isReversal?: boolean
  receiptUrl?: string | null
  paymentId?: string
}

function buildTimeline(detail: StudentOpsDetail): TL[] {
  const out: TL[] = []

  for (const p of detail.payments) {
    const isRev = p.amount < 0
    out.push({
      id: `pay-${p.id}`, date: p.payment_date, kind: 'payment',
      title: isRev
        ? `Reversal — EGP ${fmt(Math.abs(p.amount))}`
        : `Payment — EGP ${fmt(p.amount)}`,
      sub: [
        PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method,
        p.reference_number ? `Ref: ${p.reference_number}` : null,
        p.created_by_name ? `by ${p.created_by_name}` : null,
      ].filter(Boolean).join(' · '),
      amount: p.amount, isCredit: !isRev, isReversal: isRev,
      receiptUrl: p.receipt_url,
      paymentId: p.id,
    })
  }

  for (const a of detail.activities) {
    out.push({
      id: `act-${a.id}`, date: a.created_at, kind: 'activity',
      title: ACTIVITY_TYPE_LABELS[a.activity_type] ?? a.activity_type,
      sub: [a.notes, a.created_by_name && `by ${a.created_by_name}`].filter(Boolean).join(' · '),
      badge: a.activity_type, bColor: 'bg-[#F8FAFC] text-[#475569]',
    })
  }

  for (const n of detail.notes) {
    out.push({
      id: `note-${n.id}`, date: n.created_at, kind: 'note',
      title: n.is_internal ? 'Internal Note' : 'Note',
      sub: n.note_text,
    })
  }

  for (const p of detail.promises) {
    out.push({
      id: `prom-${p.id}`, date: p.created_at, kind: 'promise',
      title: `Promise — EGP ${fmt(p.promised_amount)}`,
      sub: `Due ${fmtDate(p.promised_date)}`,
      badge: p.status,
      bColor: { ACTIVE:'bg-[#FFFBEB] text-[#B45309]', FULFILLED:'bg-[#E7F8EE] text-[#15803D]', BROKEN:'bg-[#FEE2E2] text-[#EF4444]' }[p.status] ?? '',
    })
  }

  for (const s of detail.attendance_sessions) {
    if (!s.attendance_status) continue
    const pos = ['present','late','makeup'].includes(s.attendance_status)
    out.push({
      id: `att-${s.schedule_id}`, date: s.scheduled_at, kind: 'attendance',
      title: s.topic ?? 'Session',
      sub: s.late_minutes ? `${s.late_minutes}m late` : null,
      badge: s.attendance_status, isCredit: pos,
      bColor: { present:'bg-[#E7F8EE] text-[#15803D]', late:'bg-[#FFFBEB] text-[#B45309]',
                makeup:'bg-[#EFF6FF] text-[#1D4ED8]', absent:'bg-[#FEE2E2] text-[#EF4444]',
                excused:'bg-purple-50 text-purple-700' }[s.attendance_status] ?? '',
    })
  }

  return out.sort((a, b) => b.date.localeCompare(a.date))
}

const QUICK_AMOUNTS = [500, 1000, 2000] as const
type DrawerTab = 'ledger' | 'timeline' | 'attendance'

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  student: StudentOperationsRow
  onClose: () => void
}

export default function StudentOpsDrawer({ student, onClose }: Props) {
  const router = useRouter()

  // Detail
  const [detail,    setDetail]    = useState<StudentOpsDetail | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [detailErr, setDetailErr] = useState<string | null>(null)

  // Authoritative balance (from server, updated after every payment)
  const [netAmt,       setNetAmt]       = useState(student.net_amount)
  const [paidAmt,      setPaidAmt]      = useState(student.paid_amount)
  const [remainingAmt, setRemainingAmt] = useState(student.remaining_amount)

  // UI state
  const [tab,          setTab]          = useState<DrawerTab>('ledger')
  const [quickPaying,  setQuickPaying]  = useState<number | 'full' | null>(null)
  const [quickErr,     setQuickErr]     = useState<string | null>(null)
  const [showPayForm,  setShowPayForm]  = useState(false)

  // Payment form
  const [payAmt,    setPayAmt]    = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [payDate,   setPayDate]   = useState(new Date().toISOString().slice(0, 10))
  const [payRef,    setPayRef]    = useState('')
  const [payNotes,  setPayNotes]  = useState('')
  const [payErr,    setPayErr]    = useState<string | null>(null)

  // Receipt upload
  const [receiptFile,  setReceiptFile]  = useState<File | null>(null)
  const [receiptPrev,  setReceiptPrev]  = useState<string | null>(null)
  const [receiptUpErr, setReceiptUpErr] = useState<string | null>(null)
  const [compressing,  setCompressing]  = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Reversal state
  const [reversing,        setReversing]        = useState<string | null>(null)
  const [reversalType,     setReversalType]     = useState<'REVERSAL'|'REFUND'|'CORRECTION'>('REVERSAL')
  const [reversalReason,   setReversalReason]   = useState('')
  const [reversalErr,      setReversalErr]      = useState<string | null>(null)
  const [reversalLoading,  setReversalLoading]  = useState(false)

  // Collection actions
  const [noteText,    setNoteText]    = useState('')
  const [noteOpen,    setNoteOpen]    = useState(false)
  const [promiseAmt,  setPromiseAmt]  = useState('')
  const [promiseDate, setPromiseDate] = useState('')
  const [promiseOpen, setPromiseOpen] = useState(false)

  const [isPending, startTransition] = useTransition()
  const [showAddPayment, setShowAddPayment] = useState(false)

  // ── Fetch detail — no 'detail' dependency so the ref trick works ──────────
  const fetchDetail = useCallback(async () => {
    setLoading(true); setDetailErr(null)
    try {
      const qs  = student.enrollment_id ? `?enrollmentId=${student.enrollment_id}` : ''
      const res = await fetch(`/api/student-ops/${student.student_id}${qs}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setDetail(data)
      if (data.net_amount !== undefined)       setNetAmt(data.net_amount)
      if (data.paid_amount !== undefined)      setPaidAmt(data.paid_amount)
      if (data.remaining_amount !== undefined) setRemainingAmt(data.remaining_amount)
    } catch (e: any) {
      setDetailErr(e.message)
    } finally {
      setLoading(false)
    }
  }, [student.student_id, student.enrollment_id])

  // Always hold the latest fetchDetail in a ref so refreshAll never uses a stale closure
  const fetchDetailRef = useRef(fetchDetail)
  useEffect(() => { fetchDetailRef.current = fetchDetail }, [fetchDetail])

  // Initial load
  useEffect(() => { fetchDetail() }, [fetchDetail])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // ── Refresh after action ──────────────────────────────────────────────────
  function refreshAll() {
    setDetail(null)
    setTimeout(() => fetchDetailRef.current(), 400)
    router.refresh()
  }

  function syncBalance(paid: number, remaining: number) {
    setPaidAmt(paid); setRemainingAmt(remaining)
  }

  // ── Receipt handlers ──────────────────────────────────────────────────────
  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setReceiptUpErr(null); setCompressing(true)
    try {
      const { blob } = await compressImage(f, { maxKB: 50, maxWidth: 1200 })
      const compressed = new File([blob], f.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
      setReceiptFile(compressed)
      setReceiptPrev(URL.createObjectURL(blob))
    } catch (err: any) {
      setReceiptUpErr(`Compress error: ${err.message}`)
    } finally { setCompressing(false) }
  }

  async function uploadReceipt(): Promise<string | null> {
    if (!receiptFile) return null
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', receiptFile)
      if (student.enrollment_id) form.append('enrollmentId', student.enrollment_id)
      const res = await fetch('/api/finance/receipts', { method: 'POST', body: form })
      if (!res.ok) { const b = await res.json(); setReceiptUpErr(b.error ?? 'Upload failed'); return null }
      return (await res.json()).url as string
    } finally { setUploading(false) }
  }

  // ── Quick pay ─────────────────────────────────────────────────────────────
  async function handleQuickPay(amount: number | 'full') {
    if (!student.account_id) return
    setQuickPaying(amount); setQuickErr(null)
    startTransition(async () => {
      const res = await quickPayment({
        account_id:    student.account_id!,
        student_id:    student.student_id,
        enrollment_id: student.enrollment_id ?? undefined,
        amount,
      })
      if ('error' in res) {
        setQuickErr(res.error)
      } else {
        syncBalance(res.paid_amount, res.remaining_amount)
        refreshAll()
      }
      setQuickPaying(null)
    })
  }

  // ── Full payment form submit ───────────────────────────────────────────────
  async function handlePayFormSubmit() {
    if (!student.account_id) return
    const amount = parseFloat(payAmt)
    if (!amount || amount <= 0) { setPayErr('Enter a valid amount'); return }
    setPayErr(null)

    let receiptUrl: string | null = null
    if (receiptFile) {
      receiptUrl = await uploadReceipt()
      if (!receiptUrl && receiptFile) return
    }

    startTransition(async () => {
      const res = await addPayment({
        account_id:       student.account_id!,
        student_id:       student.student_id,
        enrollment_id:    student.enrollment_id ?? undefined,
        amount,
        payment_date:     payDate,
        payment_method:   payMethod,
        reference_number: payRef  || undefined,
        notes:            payNotes || undefined,
        receipt_url:      receiptUrl ?? undefined,
      })
      if ('error' in res) {
        setPayErr(res.error as string)
      } else {
        syncBalance((res as any).paid_amount, (res as any).remaining_amount)
        setShowPayForm(false)
        setPayAmt(''); setPayRef(''); setPayNotes('')
        setReceiptFile(null); setReceiptPrev(null)
        refreshAll()
      }
    })
  }

  // ── Reversal submit ───────────────────────────────────────────────────────
  async function handleReversalSubmit(paymentId: string, paymentAmount: number) {
    if (!reversalReason.trim()) { setReversalErr('Reason is required'); return }
    setReversalErr(null)
    setReversalLoading(true)
    try {
      const res = await createReversal({
        original_payment_id: paymentId,
        amount:              paymentAmount,
        reversal_type:       reversalType,
        reason:              reversalReason,
      })
      if (res && 'error' in res) {
        setReversalErr((res as any).error)
      } else {
        setReversing(null)
        setReversalReason('')
        refreshAll()
      }
    } catch (e: any) {
      setReversalErr(e?.message ?? 'Unexpected error — please try again')
    } finally {
      setReversalLoading(false)
    }
  }

  // ── Collection actions (all pass enrollment_id) ───────────────────────────
  async function handleLogActivity(type: 'CALL' | 'WHATSAPP' | 'PAYMENT_REMINDER' | 'FOLLOW_UP') {
    startTransition(async () => {
      await recordActivity({
        student_id:    student.student_id,
        account_id:    student.account_id    ?? undefined,
        enrollment_id: student.enrollment_id ?? undefined,
        activity_type: type,
      })
      refreshAll()
    })
  }

  async function handleAddNote() {
    if (!noteText.trim()) return
    startTransition(async () => {
      await addFinanceNote({
        student_id:    student.student_id,
        account_id:    student.account_id    ?? undefined,
        enrollment_id: student.enrollment_id ?? undefined,
        note_text:     noteText.trim(),
        is_internal:   true,
      })
      setNoteText(''); setNoteOpen(false)
      refreshAll()
    })
  }

  async function handleAddPromise() {
    const amt = parseFloat(promiseAmt)
    if (!amt || !promiseDate) return
    startTransition(async () => {
      await addPaymentPromise({
        student_id:      student.student_id,
        account_id:      student.account_id    ?? undefined,
        enrollment_id:   student.enrollment_id ?? undefined,
        promised_amount: amt,
        promised_date:   promiseDate,
      })
      setPromiseAmt(''); setPromiseDate(''); setPromiseOpen(false)
      refreshAll()
    })
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const parentPhone   = student.parent_phone_1 || student.parent_phone_2

  // Shape used to pre-fill EnrollmentWizard when "Add Payment" is opened from the drawer
  const preselectedStudent: StudentResult = {
    id:                       student.student_id,
    name:                     student.student_name,
    code:                     student.student_code ?? null,
    email:                    null,
    phone:                    student.student_phone ?? null,
    age:                      null,
    branch_id:                student.branch_id,
    branch_name:              student.branch_name,
    parent_name:              student.parent_name ?? null,
    parent_phone:             student.parent_phone_1 ?? student.parent_phone_2 ?? null,
    active_enrollments_count: student.enrollment_id ? 1 : 0,
    active_course_ids:        [],
    active_group_name:        student.group_name ?? null,
    financial_status:         student.financial_status ?? null,
    enrolled_sessions:        student.enrolled_sessions > 0 ? student.enrolled_sessions : null,
    remaining_sessions:       student.enrolled_sessions > 0 ? student.remaining_sessions : null,
    active_summaries:         [],
  }

  const preselectedPackages: PreselectedPackage[] = (detail?.all_enrollments ?? [])
    .filter(e => !!e.account_id)
    .map(e => ({
      enrollment_id:      e.enrollment_id,
      account_id:         e.account_id,
      course_name:        e.course_name,
      group_name:         e.group_name,
      instructor_name:    e.instructor_name,
      enrolled_sessions:  e.enrolled_sessions,
      remaining_sessions: e.remaining_sessions,
      financial_status:   e.financial_status,
      net_amount:         e.net_amount,
      paid_amount:        e.paid_amount,
      remaining_amount:   e.remaining_amount,
    }))

  const progressPct   = netAmt > 0 ? Math.min(100, Math.round((paidAmt / netAmt) * 100)) : 0
  const exhaustion    = computeSessionExhaustion(student.enrolled_sessions, student.remaining_sessions)
  const timeline      = detail ? buildTimeline(detail) : []
  const runningBal    = detail ? computeRunningBalance(detail.payments, netAmt) : new Map()
  const posPayments   = detail?.payments.filter(p => p.amount > 0) ?? []
  const negPayments   = detail?.payments.filter(p => p.amount < 0) ?? []
  const lastFiveSess  = detail?.attendance_sessions.slice(0, 5) ?? []
  const payAmtNum     = parseFloat(payAmt) || 0
  const previewRemaining = Math.max(0, remainingAmt - payAmtNum)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" aria-hidden="true" />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative flex w-full max-w-2xl max-h-[90vh] flex-col bg-white shadow-2xl rounded-2xl overflow-hidden"
        role="dialog" aria-modal="true"
        onClick={e => e.stopPropagation()}
      >

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Name + badges */}
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-[#0B1F3A]">{student.student_name}</h2>
                {student.student_code && (
                  <span className="rounded bg-[#F1F5F9] px-1.5 py-px font-mono text-[10px] text-[#64748B]">
                    #{student.student_code}
                  </span>
                )}
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${RISK_LEVEL_CLASSES[student.risk_level]}`}>
                  {student.risk_level}
                </span>
                {student.financial_status && student.financial_status !== 'CURRENT' && (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[student.financial_status as keyof typeof STATUS_COLORS] ?? ''}`}>
                    {STATUS_LABELS[student.financial_status as keyof typeof STATUS_LABELS] ?? student.financial_status}
                  </span>
                )}
                {student.enrolled_sessions > 0 && exhaustion !== 'HEALTHY' && (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SESSION_EXHAUSTION_COLORS[exhaustion]}`}>
                    {SESSION_EXHAUSTION_LABELS[exhaustion]}
                  </span>
                )}
              </div>

              {/* Group + Instructor */}
              <p className="mt-0.5 text-xs text-[#64748B]">
                {student.group_name ?? <span className="text-[#F59E0B]">No group</span>}
                {student.instructor_name
                  ? <span> · {student.instructor_name}</span>
                  : <span className="text-[#F59E0B]"> · Unassigned</span>}
              </p>

              {/* Phones */}
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[#64748B]">
                {student.student_phone && (
                  <span>Student: <span className="font-medium text-[#0B1F3A]">{student.student_phone}</span></span>
                )}
                {student.parent_name && (
                  <span>Parent: <span className="font-medium text-[#0B1F3A]">{student.parent_name}</span></span>
                )}
                {student.parent_phone_1 && (
                  <span className="font-medium text-[#0B1F3A]">{student.parent_phone_1}</span>
                )}
                {student.parent_phone_2 && student.parent_phone_2 !== student.parent_phone_1 && (
                  <span className="font-medium text-[#0B1F3A]">{student.parent_phone_2}</span>
                )}
              </div>

              {/* Risk flags */}
              {student.risk_flags.filter(f => f !== 'session_milestone').length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {student.risk_flags.filter(f => f !== 'session_milestone').slice(0, 4).map(f => (
                    <span key={f} className="rounded-full bg-[#FEE2E2] px-1.5 py-0.5 text-[10px] font-medium text-[#EF4444]">
                      {RISK_FLAG_LABELS[f] ?? f}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {parentPhone && (
                <>
                  <a href={buildWhatsAppUrl(parentPhone, null) ?? '#'} target="_blank" rel="noopener noreferrer"
                    onClick={() => handleLogActivity('WHATSAPP')}
                    title="WhatsApp (logs activity)"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E7F8EE] text-[#15803D] hover:bg-[#E7F8EE]">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.555 4.127 1.528 5.856L0 24l6.335-1.652A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.875 9.875 0 01-5.031-1.375l-.361-.214-3.741.975.997-3.645-.236-.374A9.86 9.86 0 012.118 12c0-5.453 4.43-9.882 9.882-9.882 5.453 0 9.882 4.43 9.882 9.882 0 5.453-4.43 9.882-9.882 9.882z"/>
                    </svg>
                  </a>
                  <a href={`tel:${parentPhone}`} onClick={() => handleLogActivity('CALL')}
                    title="Call (logs activity)"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#EFF6FF]">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                    </svg>
                  </a>
                </>
              )}
              <button
                onClick={() => setShowAddPayment(true)}
                title="Add Payment"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF8A1F] text-white hover:bg-[#e87c18]"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </button>
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-[#64748B] hover:bg-[#F1F5F9]" aria-label="Close">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── PACKAGES OVERVIEW (only when student has multiple active contracts) ── */}
        {detail?.all_enrollments && detail.all_enrollments.length > 1 && (
          <div className="shrink-0 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">Active Contracts</p>
            <div className="flex flex-wrap gap-1.5">
              {detail.all_enrollments.map(pkg => {
                const isCurrent = pkg.enrollment_id === student.enrollment_id
                const finCls =
                  pkg.financial_status === 'BLOCKED' ? 'border-[#FCA5A5] bg-[#FEE2E2] text-[#DC2626]' :
                  pkg.financial_status === 'OVERDUE'  ? 'border-amber-300 bg-[#FFFBEB] text-[#B45309]' :
                  isCurrent ? 'border-[#FF8A1F]/40 bg-orange-50 text-[#FF8A1F]' :
                  'border-[#E2E8F0] bg-white text-[#0B1F3A]'
                return (
                  <div key={pkg.enrollment_id} className={`rounded-lg border px-2.5 py-1.5 text-xs ${finCls}`}>
                    <p className="max-w-28 truncate font-medium">
                      {pkg.course_name ?? pkg.group_name ?? 'Contract'}
                      {isCurrent && <span className="ml-1 text-[9px] opacity-70">●</span>}
                    </p>
                    <p className="text-[10px] opacity-70">
                      {pkg.remaining_sessions > 0 ? `${pkg.remaining_sessions} sess. left` : 'Exhausted'}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── FINANCIAL SUMMARY CARDS ──────────────────────────────────────── */}
        <div className="shrink-0 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
          <div className="grid grid-cols-3 gap-2">
            {/* Paid */}
            <div className="ds-card px-2.5 py-2">
              <p className="text-[10px] text-[#94A3B8]">Paid</p>
              <p className="text-xs font-bold text-[#15803D]">EGP {fmt(paidAmt)}</p>
              {netAmt > 0 && <p className="text-[10px] text-[#94A3B8]">of {fmt(netAmt)}</p>}
            </div>
            {/* Remaining */}
            <div className={`rounded-lg border px-2.5 py-2 ${remainingAmt > 0 ? 'border-[#FECACA] bg-[#FEE2E2]' : 'border-[#A7F3D0] bg-[#E7F8EE]'}`}>
              <p className="text-[10px] text-[#94A3B8]">Remaining</p>
              <p className={`text-xs font-bold ${remainingAmt > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                {remainingAmt > 0 ? `EGP ${fmt(remainingAmt)}` : 'Paid ✓'}
              </p>
              {student.days_overdue > 0 && (
                <p className="text-[10px] font-medium text-[#EF4444]">{student.days_overdue}d overdue</p>
              )}
            </div>
            {/* Sessions */}
            <div className={`rounded-lg border px-2.5 py-2 ${
              exhaustion === 'EXHAUSTED' ? 'border-purple-200 bg-purple-50' :
              exhaustion === 'CRITICAL'  ? 'border-[#FECACA] bg-[#FEE2E2]' :
              exhaustion === 'WARNING'   ? 'border-[#FDE68A] bg-[#FFFBEB]' :
              'border-[#E2E8F0] bg-white'
            }`}>
              <p className="text-[10px] text-[#94A3B8]">Sessions</p>
              {student.enrolled_sessions > 0 ? (
                <>
                  <p className={`text-xs font-bold ${
                    exhaustion === 'EXHAUSTED' ? 'text-purple-700' :
                    exhaustion === 'CRITICAL'  ? 'text-[#EF4444]' :
                    exhaustion === 'WARNING'   ? 'text-[#B45309]' : 'text-[#2563EB]'
                  }`}>
                    {student.remaining_sessions <= 0 ? 'Exhausted' : `${student.remaining_sessions} left`}
                  </p>
                  <p className="text-[10px] text-[#94A3B8]">{student.consumed_sessions}/{student.enrolled_sessions}</p>
                </>
              ) : (
                <p className="text-xs font-medium text-[#F59E0B]">No pkg</p>
              )}
            </div>
            {/* Attendance */}
            <div className="ds-card px-2.5 py-2">
              <p className="text-[10px] text-[#94A3B8]">Attendance</p>
              <p className={`text-xs font-bold ${
                student.attendance_pct >= 80 ? 'text-[#10B981]' :
                student.attendance_pct >= 60 ? 'text-[#F59E0B]' :
                student.total_sessions > 0   ? 'text-[#EF4444]' : 'text-[#94A3B8]'
              }`}>
                {student.total_sessions > 0 ? `${student.attendance_pct}%` : '—'}
              </p>
              {student.total_sessions > 0 && (
                <p className="text-[10px] text-[#94A3B8]">{student.sessions_attended}/{student.total_sessions}</p>
              )}
            </div>
            {/* Last payment (from detail, fallback to static) */}
            <div className="ds-card px-2.5 py-2">
              <p className="text-[10px] text-[#94A3B8]">Last Payment</p>
              <p className="text-xs font-bold text-[#0B1F3A]">
                {detail?.payments.filter(p => p.amount > 0)[0]
                  ? fmtDateShort(detail.payments.filter(p => p.amount > 0)[0].payment_date)
                  : '—'}
              </p>
              {detail?.payments.filter(p => p.amount > 0)[0] && (
                <p className="text-[10px] text-[#10B981]">
                  EGP {fmt(detail.payments.filter(p => p.amount > 0)[0].amount)}
                </p>
              )}
            </div>
            {/* Next due */}
            <div className={`rounded-lg border px-2.5 py-2 ${student.days_overdue > 0 ? 'border-[#FECACA] bg-[#FEE2E2]' : 'border-[#E2E8F0] bg-white'}`}>
              <p className="text-[10px] text-[#94A3B8]">Next Due</p>
              <p className={`text-xs font-bold ${student.days_overdue > 0 ? 'text-[#EF4444]' : 'text-[#0B1F3A]'}`}>
                {student.next_due_date ? fmtDateShort(student.next_due_date) : '—'}
              </p>
              {student.days_overdue > 0 && (
                <p className="text-[10px] font-medium text-[#EF4444]">{student.days_overdue}d late</p>
              )}
            </div>
          </div>
        </div>

        {/* ── QUICK ACTIONS ────────────────────────────────────────────────── */}
        {student.account_id ? (
          <div className="shrink-0 border-b border-[#E2E8F0] px-5 py-3 space-y-2">
            {quickErr && <p className="rounded-lg bg-[#FEE2E2] px-3 py-1.5 text-xs text-[#EF4444]">{quickErr}</p>}

            {/* One-click pay */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map(amt => (
                <button key={amt} onClick={() => handleQuickPay(amt)}
                  disabled={!!quickPaying || isPending || remainingAmt <= 0}
                  className="flex items-center gap-1 rounded-lg bg-[#0B1F3A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1a3356] disabled:opacity-40">
                  {quickPaying === amt && <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />}
                  +{fmt(amt)}
                </button>
              ))}
              <button onClick={() => handleQuickPay('full')}
                disabled={!!quickPaying || isPending || remainingAmt <= 0}
                className="flex items-center gap-1 rounded-lg bg-[#059669] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#047857] disabled:opacity-40">
                {quickPaying === 'full' && <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />}
                Paid Full ({fmt(remainingAmt)})
              </button>
              <button onClick={() => { setShowPayForm(o => !o) }}
                className="rounded-lg border border-[#FF8A1F]/40 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-[#FF8A1F] hover:bg-orange-100">
                + Add Payment
              </button>
            </div>

            {/* Collection actions */}
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => handleLogActivity('PAYMENT_REMINDER')} disabled={isPending}
                className="rounded-lg bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-medium text-[#475569] hover:bg-[#F1F5F9]">
                Reminder
              </button>
              <button onClick={() => setPromiseOpen(o => !o)}
                className="rounded-lg bg-[#FFFBEB] px-2.5 py-1 text-[11px] font-medium text-[#B45309] hover:bg-[#FFFBEB]">
                Promise
              </button>
              <button onClick={() => setNoteOpen(o => !o)}
                className="rounded-lg bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-medium text-[#475569] hover:bg-[#F1F5F9]">
                Note
              </button>
            </div>

            {/* Note form */}
            {noteOpen && (
              <div className="flex gap-2">
                <input autoFocus value={noteText} onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                  placeholder="Write a note…"
                  className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#FF8A1F] focus:outline-none" />
                <button onClick={handleAddNote} disabled={isPending}
                  className="rounded-lg bg-[#334155] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Save</button>
                <button onClick={() => setNoteOpen(false)} className="text-xs text-[#94A3B8]">✕</button>
              </div>
            )}

            {/* Promise form */}
            {promiseOpen && (
              <div className="flex flex-wrap gap-2">
                <input type="number" min="1" value={promiseAmt} onChange={e => setPromiseAmt(e.target.value)}
                  placeholder="Amount…" className="w-28 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#FF8A1F] focus:outline-none" />
                <input type="date" value={promiseDate} onChange={e => setPromiseDate(e.target.value)}
                  className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#FF8A1F] focus:outline-none" />
                <button onClick={handleAddPromise} disabled={isPending}
                  className="rounded-lg bg-[#D97706] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Save</button>
                <button onClick={() => setPromiseOpen(false)} className="text-xs text-[#94A3B8]">✕</button>
              </div>
            )}

            {/* Full payment form */}
            {showPayForm && (
              <div className="ds-card p-3 space-y-2">
                <p className="text-xs font-semibold text-[#0B1F3A]">Record payment</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-[#94A3B8] mb-1">Amount (EGP)</label>
                    <input type="number" min="1" autoFocus value={payAmt} onChange={e => setPayAmt(e.target.value)}
                      className="w-full rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#FF8A1F] focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#94A3B8] mb-1">Method</label>
                    <select value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)}
                      className="w-full rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-sm focus:border-[#FF8A1F] focus:outline-none">
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#94A3B8] mb-1">Date</label>
                    <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                      className="w-full rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#FF8A1F] focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#94A3B8] mb-1">Reference</label>
                    <input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Instapay / VF ref"
                      className="w-full rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#FF8A1F] focus:outline-none" />
                  </div>
                </div>
                <input value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Notes (optional)"
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#FF8A1F] focus:outline-none" />

                {/* Live payment preview */}
                {payAmtNum > 0 && (
                  <div className="rounded-lg bg-[#EFF6FF] border border-blue-100 px-3 py-2 text-[11px]">
                    <p className="font-semibold text-blue-800 mb-1">After this payment:</p>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Paid:</span>
                      <span className="font-semibold text-[#15803D]">EGP {fmt(paidAmt + payAmtNum)} / {fmt(netAmt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Remaining:</span>
                      <span className={`font-semibold ${previewRemaining > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                        {previewRemaining > 0 ? `EGP ${fmt(previewRemaining)}` : 'Fully paid ✓'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Receipt upload */}
                <div>
                  <label className="block text-[10px] text-[#94A3B8] mb-1">Receipt (auto-compressed ≤50 KB)</label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1.5 text-xs text-[#64748B] hover:border-[#FF8A1F]">
                      {compressing ? 'Compressing…' : receiptFile ? `✓ ${receiptFile.name}` : 'Choose image'}
                    </button>
                    {receiptPrev && <img src={receiptPrev} alt="Preview" className="h-10 w-10 rounded object-cover border border-[#E2E8F0]" />}
                    {receiptFile && <button onClick={() => { setReceiptFile(null); setReceiptPrev(null) }} className="text-xs text-[#EF4444]">✕</button>}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFilePick} />
                  {receiptUpErr && <p className="mt-1 text-xs text-[#EF4444]">{receiptUpErr}</p>}
                </div>

                {payErr && <p className="text-xs text-[#EF4444]">{payErr}</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setShowPayForm(false); setPayErr(null); setPayAmt('') }}
                    className="flex-1 rounded-lg border border-[#E2E8F0] py-1.5 text-xs text-[#64748B]">Cancel</button>
                  <button onClick={handlePayFormSubmit} disabled={isPending || uploading}
                    className="flex-1 rounded-lg bg-[#FF8A1F] py-1.5 text-xs font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-1">
                    {(isPending || uploading) && <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />}
                    {uploading ? 'Uploading…' : 'Save Payment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="shrink-0 border-b border-[#E2E8F0] bg-[#FFFBEB]/60 px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-[#B45309]">No financial package yet.</p>
              <button
                onClick={() => setShowAddPayment(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#e87c18]"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add Payment
              </button>
            </div>
          </div>
        )}

        {/* ── TAB BAR ──────────────────────────────────────────────────────── */}
        <div className="shrink-0 flex border-b border-[#E2E8F0] bg-[#F8FAFC] px-5">
          {(['ledger','timeline','attendance'] as DrawerTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-2.5 px-4 text-xs font-medium capitalize border-b-2 transition-colors ${
                tab === t ? 'border-[#FF8A1F] text-[#0B1F3A]' : 'border-transparent text-[#64748B] hover:text-[#0B1F3A]'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* ── SCROLLABLE BODY ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {loading && (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-[#F1F5F9]" />)}
            </div>
          )}
          {detailErr && (
            <div className="rounded-xl border border-[#FECACA] bg-[#FEE2E2] px-4 py-3 text-sm text-[#EF4444]">{detailErr}</div>
          )}

          {/* ── LEDGER TAB ────────────────────────────────────────────────── */}
          {tab === 'ledger' && detail && !loading && (
            <div className="space-y-4">
              {/* Installments */}
              {detail.installments.length > 0 && (
                <section>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Installment Plan</h3>
                  <div className="space-y-1.5">
                    {detail.installments.map(inst => {
                      const today    = new Date().toISOString().slice(0, 10)
                      const isPaid   = inst.status === 'PAID'
                      const isLate   = !isPaid && inst.due_date < today
                      const daysLate = isLate ? Math.floor((Date.now() - new Date(inst.due_date).getTime()) / 86400000) : 0
                      const leftOver = Math.max(0, inst.amount - inst.paid_amount)
                      return (
                        <div key={inst.id}
                          className={`flex items-center justify-between rounded-xl border px-4 py-2 text-xs ${
                            isPaid   ? 'border-[#A7F3D0] bg-[#E7F8EE]/40' :
                            isLate   ? 'border-[#FECACA] bg-[#FEE2E2]/50' :
                            'border-[#E2E8F0]'
                          }`}>
                          <div>
                            <span className="font-medium text-[#0B1F3A]">#{inst.installment_number}</span>
                            <span className="ml-2 text-[#64748B]">{fmtDate(inst.due_date)}</span>
                            {isLate && <span className="ml-2 font-medium text-[#EF4444]">{daysLate}d late</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Primary: full installment amount */}
                            <span className={`font-semibold ${isPaid ? 'text-[#15803D]' : 'text-[#0B1F3A]'}`}>
                              EGP {fmt(inst.amount)}
                            </span>
                            {/* Secondary: remaining if partially paid */}
                            {!isPaid && inst.paid_amount > 0 && (
                              <span className="text-[10px] text-[#F59E0B]">
                                EGP {fmt(leftOver)} left
                              </span>
                            )}
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${INSTALLMENT_STATUS_COLORS[inst.status]}`}>
                              {inst.status}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Payment ledger — compact cards */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                    Payment Ledger
                  </h3>
                  <span className="text-[10px] text-[#94A3B8]">
                    {posPayments.length} payment{posPayments.length !== 1 ? 's' : ''}
                    {negPayments.length > 0 && ` · ${negPayments.length} reversal${negPayments.length > 1 ? 's' : ''}`}
                  </span>
                </div>

                {posPayments.length === 0 ? (
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-6 text-center">
                    <p className="text-xs text-[#94A3B8]">No payments recorded yet.</p>
                    {student.account_id && (
                      <p className="mt-1 text-xs text-[#94A3B8]">Use <strong>+ Add Payment</strong> above to record the first payment.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {posPayments.map(p => {
                      const bal = runningBal.get(p.id)
                      return (
                        <div key={p.id} className="ds-card px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span className="text-sm font-bold text-[#15803D]">EGP {fmt(p.amount)}</span>
                                <span className="rounded bg-[#F1F5F9] px-1.5 py-px text-[10px] text-[#64748B]">
                                  {PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}
                                </span>
                                <span className="text-[11px] text-[#94A3B8]">{fmtDateShort(p.payment_date)}</span>
                                {p.created_by_name && (
                                  <span className="text-[10px] text-[#CBD5E1]">by {p.created_by_name}</span>
                                )}
                              </div>
                              {p.reference_number && (
                                <p className="mt-0.5 text-[11px] text-[#94A3B8]">Ref: {p.reference_number}</p>
                              )}
                              {p.notes && (
                                <p className="mt-0.5 text-[11px] text-[#64748B]">{p.notes}</p>
                              )}
                              <div className="mt-1 flex items-center gap-2">
                                <span className={`text-[10px] font-medium ${bal && bal.remainingAfter > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                                  Remaining after: EGP {fmt(bal?.remainingAfter ?? 0)}
                                </span>
                                {p.receipt_url && (
                                  <a href={p.receipt_url} target="_blank" rel="noopener noreferrer"
                                    className="text-[10px] text-[#2563EB] hover:underline">
                                    receipt ↗
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0">
                              {reversing === p.id ? (
                                <div className="flex flex-col gap-1.5 w-44">
                                  <select value={reversalType} onChange={e => setReversalType(e.target.value as any)}
                                    className="w-full rounded border border-[#E2E8F0] px-2 py-1 text-xs focus:border-[#FF8A1F] focus:outline-none">
                                    <option value="REVERSAL">Reversal</option>
                                    <option value="REFUND">Refund</option>
                                    <option value="CORRECTION">Correction</option>
                                  </select>
                                  <input value={reversalReason} onChange={e => setReversalReason(e.target.value)}
                                    placeholder="Reason (required)" autoFocus
                                    className="w-full rounded border border-[#E2E8F0] px-2 py-1 text-xs focus:border-[#FF8A1F] focus:outline-none" />
                                  {reversalErr && <p className="text-[10px] text-[#EF4444]">{reversalErr}</p>}
                                  <div className="flex gap-1">
                                    <button onClick={() => handleReversalSubmit(p.id, p.amount)} disabled={reversalLoading}
                                      className="flex-1 rounded bg-[#DC2626] py-1 text-[10px] font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-1">
                                      {reversalLoading && <span className="h-2.5 w-2.5 animate-spin rounded-full border border-white border-t-transparent" />}
                                      Confirm
                                    </button>
                                    <button onClick={() => { setReversing(null); setReversalReason(''); setReversalErr(null) }} disabled={reversalLoading}
                                      className="flex-1 rounded border border-[#E2E8F0] py-1 text-[10px] text-[#64748B] disabled:opacity-40">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <button onClick={() => { setReversing(p.id); setReversalErr(null) }}
                                  className="rounded px-2 py-0.5 text-[10px] font-medium text-[#EF4444] bg-[#FEE2E2] hover:bg-[#FEE2E2]">
                                  Reverse
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {/* Footer totals */}
                    <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs">
                      <span className="font-semibold text-[#0B1F3A]">Total paid</span>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-[#15803D]">EGP {fmt(paidAmt)}</span>
                        <span className={`font-bold ${remainingAmt > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                          {remainingAmt > 0 ? `EGP ${fmt(remainingAmt)} due` : 'Fully paid ✓'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ── TIMELINE TAB ───────────────────────────────────────────────── */}
          {tab === 'timeline' && detail && !loading && (
            <div>
              {timeline.length === 0 ? (
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-8 text-center text-xs text-[#94A3B8]">
                  No activity yet
                </div>
              ) : (
                <div className="relative space-y-0">
                  <div className="absolute left-3.75 top-0 bottom-0 w-px bg-[#E2E8F0]" />
                  {timeline.map(ev => (
                    <div key={ev.id} className="relative flex gap-3 pb-3">
                      <div className={`relative z-10 mt-1 flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold ${
                        ev.kind === 'payment' ? (ev.isCredit ? 'bg-[#E7F8EE] text-[#15803D]' : 'bg-[#FEE2E2] text-[#EF4444]') :
                        ev.kind === 'attendance' ? (ev.isCredit ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'bg-[#F1F5F9] text-[#64748B]') :
                        ev.kind === 'promise' ? 'bg-[#FFFBEB] text-[#B45309]' :
                        'bg-[#F1F5F9] text-[#64748B]'
                      }`}>
                        {ev.kind === 'payment' ? (ev.isCredit ? '₯' : '↩') :
                         ev.kind === 'attendance' ? (ev.isCredit ? '✓' : '✗') :
                         ev.kind === 'promise' ? '!' : '·'}
                      </div>
                      <div className="flex-1 min-w-0 ds-card px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[#0B1F3A] truncate">{ev.title}</p>
                            {ev.sub && <p className="mt-0.5 text-[11px] text-[#64748B] line-clamp-2">{ev.sub}</p>}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-[10px] text-[#94A3B8] whitespace-nowrap">{fmtDateShort(ev.date)}</span>
                            {ev.badge && (
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold capitalize ${ev.bColor ?? 'bg-[#F8FAFC] text-[#475569]'}`}>{ev.badge}</span>
                            )}
                          </div>
                        </div>
                        {ev.receiptUrl && (
                          <a href={ev.receiptUrl} target="_blank" rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#2563EB] hover:underline">
                            View receipt →
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ATTENDANCE TAB ─────────────────────────────────────────────── */}
          {tab === 'attendance' && detail && !loading && (
            <div className="space-y-3">
              {lastFiveSess.length > 0 && (
                <div className="flex items-center gap-3 pb-2 border-b border-[#F1F5F9]">
                  {lastFiveSess.map(s => {
                    const icon = s.attendance_status === 'present' ? '✅' : s.attendance_status === 'absent' ? '❌' : s.attendance_status === 'late' ? '⚠' : '—'
                    return (
                      <div key={s.schedule_id} className="flex flex-col items-center gap-0.5"
                        title={`${fmtDate(s.scheduled_at)} — ${s.attendance_status ?? 'No record'}`}>
                        <span className="text-lg leading-none">{icon}</span>
                        <span className="text-[9px] text-[#94A3B8]">{fmtDateShort(s.scheduled_at)}</span>
                      </div>
                    )
                  })}
                  <span className="ml-auto text-xs text-[#64748B]">
                    {student.sessions_attended}/{student.total_sessions} attended
                    {student.attendance_pct > 0 && ` (${student.attendance_pct}%)`}
                  </span>
                </div>
              )}

              {detail.attendance_sessions.length === 0 ? (
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-6 text-center text-xs text-[#94A3B8]">
                  No sessions recorded yet.
                </div>
              ) : (
                <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="ds-table-head">
                      <tr>
                        <th className="px-3 py-2 text-left text-[#64748B] font-medium">Date</th>
                        <th className="px-3 py-2 text-left text-[#64748B] font-medium">Topic</th>
                        <th className="px-3 py-2 text-left text-[#64748B] font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.attendance_sessions.map(s => {
                        const pos = s.attendance_status && ['present','late','makeup'].includes(s.attendance_status)
                        return (
                          <tr key={s.schedule_id} className="border-b border-[#F1F5F9] last:border-0">
                            <td className="px-3 py-2 text-[#64748B]">{fmtDateShort(s.scheduled_at)}</td>
                            <td className="px-3 py-2 text-[#0B1F3A]">{s.topic ?? <span className="text-[#94A3B8]">—</span>}</td>
                            <td className="px-3 py-2">
                              {s.attendance_status ? (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                                  pos ? 'bg-[#E7F8EE] text-[#15803D]' :
                                  s.attendance_status === 'absent' ? 'bg-[#FEE2E2] text-[#EF4444]' :
                                  'bg-purple-50 text-purple-700'
                                }`}>{s.attendance_status}</span>
                              ) : (
                                <span className="text-[#94A3B8]">—</span>
                              )}
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
        </div>
      </div>
      </div>

      {/* ── Add Payment Wizard (pre-fills student, opens on step 2) ───────── */}
      {showAddPayment && (
        <EnrollmentWizard
          branchIds={[student.branch_id]}
          preselectedStudent={preselectedStudent}
          preselectedPackages={preselectedPackages.length > 0 ? preselectedPackages : undefined}
          onClose={() => setShowAddPayment(false)}
          onSuccess={() => { setShowAddPayment(false); refreshAll() }}
        />
      )}
    </>
  )
}
