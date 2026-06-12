'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { buildWhatsAppUrl, buildTelUrl } from '@/lib/phone'
import {
  getStudentAttendanceHistoryAction,
  type GroupDetailStudent,
  type StudentAttendanceHistoryRecord,
} from '@/modules/groups/modal-actions'
import type { GroupOperationalRow } from '@/modules/groups/operational'

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtCurrency(n: number): string {
  return n.toLocaleString('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 })
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

function statusBadgeCls(status: string) {
  if (status === 'present')  return 'bg-emerald-100 text-emerald-700'
  if (status === 'late')     return 'bg-amber-100 text-amber-700'
  if (status === 'absent')   return 'bg-red-100 text-red-700'
  if (status === 'excused')  return 'bg-blue-100 text-blue-700'
  return 'bg-slate-100 text-slate-600'
}

function paymentStatusCls(s: string | null) {
  if (s === 'OVERDUE')  return 'bg-red-100 text-red-700'
  if (s === 'DUE_SOON') return 'bg-amber-100 text-amber-700'
  if (s === 'PAID')     return 'bg-emerald-100 text-emerald-700'
  return 'bg-slate-100 text-slate-600'
}

// ─── sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">{children}</p>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-[#F1F5F9] py-1.5 last:border-0">
      <span className="shrink-0 text-[11px] text-[#94A3B8]">{label}</span>
      <span className="min-w-0 break-words text-right text-[12px] font-medium text-[#0B1F3A]">{value}</span>
    </div>
  )
}

function WaButton({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-green-600 transition"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      {label}
    </a>
  )
}

function CallButton({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[11px] font-medium text-[#374151] hover:bg-[#F8FAFC] transition"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
      {label}
    </a>
  )
}

function HistorySkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-11 rounded-xl bg-[#F1F5F9] animate-pulse" />
      ))}
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'finance' | 'attendance' | 'learning'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview',   label: 'Overview' },
  { key: 'finance',    label: 'Finance' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'learning',   label: 'Learning' },
]

// ─── Tab panes ────────────────────────────────────────────────────────────────

function OverviewTab({ s, group }: { s: GroupDetailStudent; group: GroupOperationalRow }) {
  const attColor = s.attendance_pct >= 75 ? 'text-emerald-600 bg-emerald-50'
                 : s.attendance_pct >= 60 ? 'text-amber-600 bg-amber-50'
                 : s.attendance_pct > 0   ? 'text-red-600 bg-red-50'
                 :                          'text-[#94A3B8] bg-[#F1F5F9]'

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Contact</SectionLabel>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
          <InfoRow label="Student phone" value={s.phone ?? <span className="text-[#CBD5E1]">—</span>} />
          <InfoRow label="Parent phone"  value={s.parent_phone ?? <span className="text-[#CBD5E1]">—</span>} />
        </div>
      </div>

      <div>
        <SectionLabel>Academic Status</SectionLabel>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
          <InfoRow label="Group"      value={group.name} />
          <InfoRow label="Instructor" value={group.lead_instructor_name ?? <span className="text-[#CBD5E1]">Unassigned</span>} />
          <InfoRow label="Course"     value={group.course_name ?? <span className="text-[#CBD5E1]">No course</span>} />
          <InfoRow label="Attendance" value={
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${attColor}`}>
              {s.attendance_pct > 0 ? `${s.attendance_pct}%` : '—'}
            </span>
          } />
          <InfoRow label="Remaining sessions" value={
            s.sessions_remaining != null
              ? <span className={s.sessions_remaining <= 2 ? 'text-red-600 font-semibold' : ''}>{s.sessions_remaining}</span>
              : <span className="text-[#CBD5E1]">—</span>
          } />
          <InfoRow label="Joined" value={fmtDate(s.joined_at)} />
        </div>
      </div>
    </div>
  )
}

function FinanceTab({ s }: { s: GroupDetailStudent }) {
  const sub = s.subscription_amount ?? 0
  return (
    <div className="space-y-4">
      {sub === 0 && s.paid_amount === 0 ? (
        <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4 text-center text-[12px] text-[#94A3B8]">
          No active financial contract.
        </p>
      ) : (
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
          <InfoRow label="Package / Subscription" value={sub > 0 ? fmtCurrency(sub) : '—'} />
          <InfoRow label="Total paid"             value={s.paid_amount > 0 ? fmtCurrency(s.paid_amount) : '—'} />
          <InfoRow label="Remaining balance"      value={
            s.remaining_balance > 0
              ? <span className="font-semibold text-red-600">{fmtCurrency(s.remaining_balance)}</span>
              : <span className="text-emerald-600">Settled</span>
          } />
          <InfoRow label="Contract status" value={
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${paymentStatusCls(s.payment_status)}`}>
              {s.payment_status?.replace('_', ' ') ?? '—'}
            </span>
          } />
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/portal/team-leader/finance?student=${s.student_id}&mode=collect`}
          className="flex-1 rounded-xl bg-[#FF8A1F] px-4 py-2.5 text-center text-[12px] font-semibold text-white hover:bg-[#e87c18]"
        >
          💰 Collect Payment
        </Link>
        <Link
          href={`/portal/team-leader/finance?student=${s.student_id}&mode=renew`}
          className="flex-1 rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-center text-[12px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
        >
          🔄 Renew Contract
        </Link>
      </div>
    </div>
  )
}

function AttendanceTab({
  history, loading,
  sessionsUsed, sessionsTotal,
}: {
  history: StudentAttendanceHistoryRecord[] | null
  loading: boolean
  sessionsUsed:  number | null
  sessionsTotal: number | null
}) {
  const present = history?.filter(h => h.status === 'present' || h.status === 'late' || h.status === 'makeup').length ?? 0
  const absent  = history?.filter(h => h.status === 'absent').length ?? 0

  return (
    <div className="space-y-4">
      {/* Mini stats */}
      {history && history.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-center">
            <p className="text-[18px] font-bold text-emerald-700">{present}</p>
            <p className="text-[9px] font-medium text-emerald-600 uppercase tracking-wide">Present</p>
          </div>
          <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-center">
            <p className="text-[18px] font-bold text-red-700">{absent}</p>
            <p className="text-[9px] font-medium text-red-600 uppercase tracking-wide">Absent</p>
          </div>
          <div className="rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] px-3 py-2 text-center">
            <p className="text-[18px] font-bold text-[#0B1F3A]">
              {sessionsUsed ?? present + absent}
            </p>
            <p className="text-[9px] font-medium text-[#94A3B8] uppercase tracking-wide">Total</p>
          </div>
        </div>
      )}

      <div>
        <SectionLabel>Recent Attendance</SectionLabel>
        {loading ? (
          <HistorySkeleton />
        ) : !history || history.length === 0 ? (
          <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4 text-center text-[12px] text-[#94A3B8]">
            No attendance records yet.
          </p>
        ) : (
          <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
            {history.map(h => (
              <div key={h.id} className="flex items-center gap-3 border-b border-[#F1F5F9] last:border-0 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-[#0B1F3A]">
                    {h.scheduled_at ? fmtDate(h.scheduled_at) : '—'}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-[#64748B]">
                    {h.topic ?? h.group_name ?? '—'}
                    {h.instructor_name ? ` · ${h.instructor_name}` : ''}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusBadgeCls(h.status)}`}>
                  {h.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LearningTab({ s, group }: { s: GroupDetailStudent; group: GroupOperationalRow }) {
  const pct = s.sessions_used != null && s.sessions_total != null && s.sessions_total > 0
    ? Math.min(100, Math.round((s.sessions_used / s.sessions_total) * 100))
    : null

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Progress</SectionLabel>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
          <InfoRow label="Sessions used" value={s.sessions_used != null ? `${s.sessions_used}` : '—'} />
          <InfoRow label="Total sessions" value={s.sessions_total != null ? `${s.sessions_total}` : '—'} />
          <InfoRow label="Remaining"      value={
            s.sessions_remaining != null
              ? <span className={s.sessions_remaining <= 2 ? 'text-red-600 font-semibold' : ''}>{s.sessions_remaining} sessions</span>
              : '—'
          } />
        </div>
        {pct != null && (
          <div className="mt-2 px-1">
            <div className="flex justify-between text-[10px] text-[#94A3B8] mb-1">
              <span>Progress</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#F1F5F9]">
              <div
                className={`h-2 rounded-full transition-all ${pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-[#CBD5E1]'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <SectionLabel>Course</SectionLabel>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
          <InfoRow label="Course"     value={group.course_name ?? <span className="text-[#CBD5E1]">No course</span>} />
          <InfoRow label="Instructor" value={group.lead_instructor_name ?? <span className="text-[#CBD5E1]">Unassigned</span>} />
        </div>
      </div>

      {/* Link to full profile */}
      <Link
        href={`/portal/team-leader/students/${s.student_id}`}
        className="block w-full rounded-xl border border-[#E2E8F0] py-2.5 text-center text-[12px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
      >
        Open Full Student Profile →
      </Link>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  student: GroupDetailStudent
  group:   GroupOperationalRow
  onClose: () => void
}

export default function StudentQuickViewModal({ student: s, group, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [history, setHistory]     = useState<StudentAttendanceHistoryRecord[] | null>(null)
  const [histLoad, setHistLoad]   = useState(true)

  // ESC to close
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  // Load attendance lazily
  useEffect(() => {
    let cancelled = false
    getStudentAttendanceHistoryAction(s.student_id)
      .then(h => { if (!cancelled) { setHistory(h); setHistLoad(false) } })
      .catch(() => { if (!cancelled) { setHistory([]); setHistLoad(false) } })
    return () => { cancelled = true }
  }, [s.student_id])

  const waUrl  = buildWhatsAppUrl(s.parent_phone, s.phone)
  const telUrl = buildTelUrl(s.parent_phone, s.phone)
  const stuTel = buildTelUrl(null, s.phone)

  const riskCls = s.risk_level === 'HIGH'   ? 'bg-red-100 text-red-700'
                : s.risk_level === 'MEDIUM' ? 'bg-amber-100 text-amber-700'
                :                             'bg-emerald-100 text-emerald-700'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center p-0 sm:p-4" onClick={onClose}>
        <div
          className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ────────────────────────────────────────────────── */}
          <div className="shrink-0 border-b border-[#E2E8F0] bg-white px-5 py-4">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0B1F3A] text-[14px] font-bold text-white">
                {initials(s.student_name)}
              </div>

              {/* Name + meta */}
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-bold text-[#0B1F3A] leading-tight">{s.student_name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {s.student_code && (
                    <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-[10px] text-[#94A3B8]">
                      #{s.student_code}
                    </span>
                  )}
                  {s.age != null && (
                    <span className="text-[11px] text-[#64748B]">{s.age}y</span>
                  )}
                  <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] text-[#64748B]">
                    {group.branch_name}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${riskCls}`}>
                    {s.risk_level} Risk
                  </span>
                  {s.payment_status && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${paymentStatusCls(s.payment_status)}`}>
                      {s.payment_status.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>

              {/* Close */}
              <button
                onClick={onClose}
                className="shrink-0 rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] transition"
                aria-label="Close"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Quick contact actions */}
            <div className="mt-3 flex flex-wrap gap-2">
              {waUrl  && <WaButton  url={waUrl}  label={s.parent_phone ? 'WhatsApp Parent' : 'WhatsApp'} />}
              {telUrl && <CallButton url={telUrl} label={s.parent_phone ? 'Call Parent'    : 'Call'} />}
              {s.parent_phone && stuTel && <CallButton url={stuTel} label="Call Student" />}
            </div>
          </div>

          {/* ── Tab bar ───────────────────────────────────────────────── */}
          <div className="shrink-0 border-b border-[#E2E8F0] bg-white">
            <div className="flex overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 min-w-[80px] px-3 py-2.5 text-[12px] font-medium transition border-b-2 whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'border-[#FF8A1F] text-[#FF8A1F]'
                      : 'border-transparent text-[#64748B] hover:text-[#0B1F3A]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Content ───────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {activeTab === 'overview'   && <OverviewTab    s={s} group={group} />}
            {activeTab === 'finance'    && <FinanceTab     s={s} />}
            {activeTab === 'attendance' && (
              <AttendanceTab
                history={history}
                loading={histLoad}
                sessionsUsed={s.sessions_used}
                sessionsTotal={s.sessions_total}
              />
            )}
            {activeTab === 'learning'   && <LearningTab    s={s} group={group} />}
          </div>
        </div>
      </div>
    </>
  )
}
