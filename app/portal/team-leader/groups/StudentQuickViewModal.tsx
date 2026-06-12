'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { buildWhatsAppUrl, buildTelUrl } from '@/lib/phone'
import EnrollmentWizard from '../finance/EnrollmentWizard'
import type { StudentResult } from '../finance/EnrollmentWizard'
import {
  getStudentAttendanceHistoryAction,
  getStudentAuthDataAction,
  getStudentAttendanceSummaryAction,
  type GroupDetailStudent,
  type StudentAttendanceHistoryRecord,
  type StudentPortalCredentials,
  type StudentAttendanceSummary,
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
  if (status === 'makeup')   return 'bg-purple-100 text-purple-700'
  if (status === 'cancelled') return 'bg-slate-100 text-slate-400'
  return 'bg-slate-100 text-slate-600'
}

function paymentStatusCls(s: string | null) {
  if (s === 'OVERDUE')  return 'bg-red-100 text-red-700'
  if (s === 'DUE_SOON') return 'bg-amber-100 text-amber-700'
  if (s === 'PAID')     return 'bg-emerald-100 text-emerald-700'
  if (s === 'BLOCKED')  return 'bg-red-200 text-red-800'
  return 'bg-slate-100 text-slate-600'
}

async function copyToClipboard(text: string) {
  try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
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

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    copyToClipboard(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={handleCopy}
      title={`Copy ${label ?? value}`}
      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#FF8A1F] transition"
    >
      {copied ? '✓' : 'Copy'}
    </button>
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

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#F1F5F9] ${className ?? 'h-4 w-full'}`} />
}

// ─── Attendance ring badge ────────────────────────────────────────────────────

function AttRing({ pct }: { pct: number }) {
  const color = pct >= 85 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444'
  const r = 14, circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#E2E8F0" strokeWidth="4" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      <text x="18" y="18" textAnchor="middle" dominantBaseline="central"
        className="rotate-90 origin-center"
        style={{ transform: 'rotate(90deg)', transformOrigin: '18px 18px', fontSize: '8px', fontWeight: 700, fill: color }}>
        {pct}%
      </text>
    </svg>
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

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function portalStatusBadge(status: StudentPortalCredentials['status']) {
  if (status === 'active')           return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700 uppercase tracking-wide">Active</span>
  if (status === 'password_missing') return <span className="rounded-full bg-amber-100  px-2 py-0.5 text-[9px] font-bold text-amber-700  uppercase tracking-wide">Password Not Set</span>
  if (status === 'no_access')        return <span className="rounded-full bg-red-100    px-2 py-0.5 text-[9px] font-bold text-red-700    uppercase tracking-wide">No Portal Access</span>
  return                                    <span className="rounded-full bg-slate-100  px-2 py-0.5 text-[9px] font-bold text-slate-500  uppercase tracking-wide">No Account</span>
}

function OverviewTab({
  s, group, authData, authLoading, attSummary, attSumLoading,
}: {
  s:            GroupDetailStudent
  group:        GroupOperationalRow
  authData:     StudentPortalCredentials | null
  authLoading:  boolean
  attSummary:   StudentAttendanceSummary | null
  attSumLoading: boolean
}) {
  const attColor = (pct: number) =>
    pct >= 85 ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
    : pct >= 60 ? 'text-amber-600 bg-amber-50 border-amber-100'
    : pct > 0   ? 'text-red-600 bg-red-50 border-red-100'
    :             'text-[#94A3B8] bg-[#F1F5F9] border-[#E2E8F0]'

  return (
    <div className="space-y-4">

      {/* Authentication */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">Authentication</p>
          {!authLoading && authData && portalStatusBadge(authData.status)}
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 space-y-0">
          {/* Email */}
          <div className="flex items-center justify-between gap-2 border-b border-[#F1F5F9] py-1.5">
            <span className="shrink-0 text-[11px] text-[#94A3B8]">Email</span>
            <div className="flex items-center gap-1.5 min-w-0">
              {authLoading ? (
                <Skeleton className="h-3.5 w-36" />
              ) : authData?.email ? (
                <>
                  <span className="font-mono text-[11px] text-[#0B1F3A] truncate">{authData.email}</span>
                  <CopyButton value={authData.email} label="email" />
                </>
              ) : (
                <span className="text-[11px] text-[#CBD5E1]">No email</span>
              )}
            </div>
          </div>
          {/* Password */}
          <div className="flex items-center justify-between gap-2 py-1.5">
            <span className="shrink-0 text-[11px] text-[#94A3B8]">Password</span>
            <div className="flex items-center gap-1.5 min-w-0">
              {authLoading ? (
                <Skeleton className="h-3.5 w-28" />
              ) : authData?.portal_password ? (
                <>
                  <span className="font-mono text-[12px] font-semibold text-[#0B1F3A] tracking-wide">
                    {authData.portal_password}
                  </span>
                  <CopyButton value={authData.portal_password} label="password" />
                </>
              ) : (
                <span className="text-[11px] text-[#CBD5E1]">No portal password assigned</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div>
        <SectionLabel>Contact</SectionLabel>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
          <InfoRow label="Student phone" value={s.phone ?? <span className="text-[#CBD5E1]">—</span>} />
          <InfoRow label="Parent phone"  value={s.parent_phone ?? <span className="text-[#CBD5E1]">—</span>} />
        </div>
      </div>

      {/* Academic */}
      <div>
        <SectionLabel>Academic Status</SectionLabel>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
          <InfoRow label="Group"      value={group.name} />
          <InfoRow label="Instructor" value={group.lead_instructor_name ?? <span className="text-[#CBD5E1]">Unassigned</span>} />
          <InfoRow label="Course"     value={group.course_name ?? <span className="text-[#CBD5E1]">No course</span>} />
          <InfoRow label="Joined"     value={fmtDate(s.joined_at)} />
          <InfoRow label="Remaining sessions" value={
            s.sessions_remaining != null
              ? <span className={s.sessions_remaining <= 2 ? 'text-red-600 font-semibold' : ''}>{s.sessions_remaining}</span>
              : <span className="text-[#CBD5E1]">—</span>
          } />
        </div>
      </div>

      {/* Attendance summary */}
      <div>
        <SectionLabel>Attendance Summary</SectionLabel>
        {attSumLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : attSummary ? (
          <>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[
                { label: 'Present',  value: attSummary.present_count,  cls: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
                { label: 'Absent',   value: attSummary.absent_count,   cls: 'bg-red-50 border-red-100 text-red-700' },
                { label: 'Late',     value: attSummary.late_count,     cls: 'bg-amber-50 border-amber-100 text-amber-700' },
                { label: 'Consumed', value: attSummary.consumed_count, cls: 'bg-[#F8FAFC] border-[#E2E8F0] text-[#0B1F3A]' },
              ].map(card => (
                <div key={card.label} className={`rounded-xl border px-2 py-2 text-center ${card.cls}`}>
                  <p className="text-[17px] font-bold leading-none">{card.value}</p>
                  <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-80">{card.label}</p>
                </div>
              ))}
            </div>
            <div className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${attColor(attSummary.attendance_pct)}`}>
              <AttRing pct={attSummary.attendance_pct} />
              <div>
                <p className="text-[11px] font-semibold">Attendance Rate</p>
                <p className="text-[10px] opacity-75 mt-0.5">
                  {attSummary.present_count} present out of {attSummary.present_count + attSummary.absent_count + attSummary.late_count} recorded sessions
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-center text-[12px] text-[#94A3B8]">
            No attendance records yet.
          </p>
        )}
      </div>

    </div>
  )
}

// ─── Finance Tab ──────────────────────────────────────────────────────────────

type FinanceCase = 'no_contract' | 'active' | 'exhausted' | 'overdue'

function detectFinanceCase(s: GroupDetailStudent): FinanceCase {
  const hasContract = (s.sessions_total ?? 0) > 0 || s.subscription_amount
  if (!hasContract && s.paid_amount === 0) return 'no_contract'
  if (s.payment_status === 'OVERDUE' || s.payment_status === 'BLOCKED') return 'overdue'
  if ((s.sessions_remaining ?? 1) <= 0 && (s.sessions_total ?? 0) > 0) return 'exhausted'
  return 'active'
}

function FinanceTab({
  s, group, onOpenFinance,
}: {
  s:             GroupDetailStudent
  group:         GroupOperationalRow
  onOpenFinance: (mode: 'collect' | 'create') => void
}) {
  const finCase = detectFinanceCase(s)
  const sub     = s.subscription_amount ?? 0

  return (
    <div className="space-y-4">

      {/* Case badge */}
      {finCase === 'no_contract' && (
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-5 text-center">
          <div className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-[#64748B]">
            No active financial contract
          </div>
          <p className="text-[12px] text-[#94A3B8]">
            Create a contract to start session tracking and payment collection.
          </p>
        </div>
      )}

      {finCase === 'exhausted' && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 flex items-center gap-2">
          <span className="text-red-500 text-[16px]">⚠</span>
          <p className="text-[12px] font-semibold text-red-700">Package exhausted — renew to continue tracking</p>
        </div>
      )}

      {finCase === 'overdue' && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 flex items-center gap-2">
          <span className="text-red-500 text-[16px]">!</span>
          <p className="text-[12px] font-semibold text-red-700">Payment overdue — collection action required</p>
        </div>
      )}

      {/* Contract summary (cases active / exhausted / overdue) */}
      {finCase !== 'no_contract' && (
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
          <InfoRow label="Package / Subscription" value={sub > 0 ? fmtCurrency(sub) : '—'} />
          <InfoRow label="Sessions enrolled"      value={s.sessions_total != null ? `${s.sessions_total}` : '—'} />
          <InfoRow label="Sessions consumed"      value={s.sessions_used  != null ? `${s.sessions_used}`  : '—'} />
          <InfoRow label="Sessions remaining"     value={
            s.sessions_remaining != null
              ? <span className={s.sessions_remaining <= 2 ? 'text-red-600 font-semibold' : ''}>{s.sessions_remaining}</span>
              : '—'
          } />
          <InfoRow label="Total paid"             value={s.paid_amount > 0 ? fmtCurrency(s.paid_amount) : '—'} />
          <InfoRow label="Remaining balance"      value={
            s.remaining_balance > 0
              ? <span className="font-semibold text-red-600">{fmtCurrency(s.remaining_balance)}</span>
              : <span className="text-emerald-600">Settled</span>
          } />
          <InfoRow label="Payment status" value={
            s.payment_status ? (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${paymentStatusCls(s.payment_status)}`}>
                {s.payment_status.replace('_', ' ')}
              </span>
            ) : '—'
          } />
        </div>
      )}

      {/* Actions */}
      {finCase === 'no_contract' ? (
        <button
          onClick={() => onOpenFinance('create')}
          className="w-full rounded-xl bg-[#FF8A1F] px-4 py-2.5 text-center text-[13px] font-semibold text-white hover:bg-[#e87c18] transition"
        >
          Create Contract
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onOpenFinance('collect')}
            className="w-full rounded-xl bg-[#FF8A1F] px-4 py-2.5 text-center text-[13px] font-semibold text-white hover:bg-[#e87c18] transition"
          >
            Collect Payment
          </button>
          <button
            onClick={() => onOpenFinance('create')}
            className="w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-center text-[12px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F] transition"
          >
            Renew Contract
          </button>
        </div>
      )}

    </div>
  )
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceTab({
  history, loading, attSummary, attSumLoading,
}: {
  history:       StudentAttendanceHistoryRecord[] | null
  loading:       boolean
  attSummary:    StudentAttendanceSummary | null
  attSumLoading: boolean
}) {
  return (
    <div className="space-y-4">
      {/* Stats bar */}
      {attSumLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : attSummary && attSummary.total_records > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-center">
            <p className="text-[18px] font-bold text-emerald-700">{attSummary.present_count}</p>
            <p className="text-[9px] font-medium text-emerald-600 uppercase tracking-wide">Present</p>
          </div>
          <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-center">
            <p className="text-[18px] font-bold text-red-700">{attSummary.absent_count}</p>
            <p className="text-[9px] font-medium text-red-600 uppercase tracking-wide">Absent</p>
          </div>
          <div className="rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] px-3 py-2 text-center">
            <p className="text-[18px] font-bold text-[#0B1F3A]">{attSummary.consumed_count}</p>
            <p className="text-[9px] font-medium text-[#94A3B8] uppercase tracking-wide">Consumed</p>
          </div>
        </div>
      ) : null}

      <div>
        <SectionLabel>Recent Attendance (latest 10)</SectionLabel>
        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <Skeleton key={i} className="h-11 rounded-xl" />)}
          </div>
        ) : !history || history.length === 0 ? (
          <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4 text-center text-[12px] text-[#94A3B8]">
            No attendance records yet.
          </p>
        ) : (
          <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
            {history.map(h => (
              <div key={h.id} className="flex items-center gap-3 border-b border-[#F1F5F9] last:border-0 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-medium text-[#0B1F3A]">
                      {h.scheduled_at ? fmtDate(h.scheduled_at) : '—'}
                    </p>
                    {h.is_consumed && (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-[#64748B]">
                        Consumed
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-[#64748B]">
                    {[h.group_name, h.instructor_name].filter(Boolean).join(' · ') || h.topic || '—'}
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

// ─── Learning Tab ─────────────────────────────────────────────────────────────

function LearningTab({
  s, group, history, histLoad, attSummary,
}: {
  s:          GroupDetailStudent
  group:      GroupOperationalRow
  history:    StudentAttendanceHistoryRecord[] | null
  histLoad:   boolean
  attSummary: StudentAttendanceSummary | null
}) {
  const pct = s.sessions_used != null && s.sessions_total != null && s.sessions_total > 0
    ? Math.min(100, Math.round((s.sessions_used / s.sessions_total) * 100))
    : null

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Course & Instructor</SectionLabel>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
          <InfoRow label="Course"     value={group.course_name ?? <span className="text-[#CBD5E1]">No course</span>} />
          <InfoRow label="Instructor" value={group.lead_instructor_name ?? <span className="text-[#CBD5E1]">Unassigned</span>} />
          <InfoRow label="Joined"     value={fmtDate(s.joined_at)} />
        </div>
      </div>

      <div>
        <SectionLabel>Session Progress</SectionLabel>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
          <InfoRow label="Total sessions attended" value={
            attSummary ? (
              <span className="font-semibold text-emerald-600">{attSummary.present_count + attSummary.late_count + attSummary.makeup_count}</span>
            ) : s.sessions_used != null ? `${s.sessions_used}` : '—'
          } />
          <InfoRow label="Total sessions missed" value={
            attSummary ? (
              <span className={attSummary.absent_count > 0 ? 'text-red-600 font-semibold' : ''}>{attSummary.absent_count}</span>
            ) : '—'
          } />
          <InfoRow label="Package enrolled"  value={s.sessions_total != null ? `${s.sessions_total}` : '—'} />
          <InfoRow label="Package consumed"  value={s.sessions_used  != null ? `${s.sessions_used}`  : '—'} />
          <InfoRow label="Package remaining" value={
            s.sessions_remaining != null
              ? <span className={s.sessions_remaining <= 2 ? 'text-red-600 font-semibold' : ''}>{s.sessions_remaining} sessions</span>
              : '—'
          } />
        </div>
        {pct != null && (
          <div className="mt-2 px-1">
            <div className="flex justify-between text-[10px] text-[#94A3B8] mb-1">
              <span>Package progress</span>
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

      {/* Latest attendance timeline */}
      <div>
        <SectionLabel>Latest Attendance Timeline</SectionLabel>
        {histLoad ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded-xl" />)}</div>
        ) : !history || history.length === 0 ? (
          <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-center text-[12px] text-[#94A3B8]">
            No attendance history yet.
          </p>
        ) : (
          <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
            {history.map(h => (
              <div key={h.id} className="flex items-center gap-3 border-b border-[#F1F5F9] last:border-0 px-4 py-2">
                <div className={`h-2 w-2 shrink-0 rounded-full ${
                  h.status === 'present' ? 'bg-emerald-500'
                  : h.status === 'late'  ? 'bg-amber-500'
                  : h.status === 'absent' ? 'bg-red-500'
                  : h.status === 'excused' ? 'bg-blue-400'
                  : h.status === 'makeup'  ? 'bg-purple-400'
                  : 'bg-slate-300'
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-[#0B1F3A]">
                    {h.scheduled_at ? fmtDate(h.scheduled_at) : '—'}
                    {h.instructor_name && <span className="ml-1.5 text-[10px] text-[#94A3B8]">· {h.instructor_name}</span>}
                    {h.group_name    && <span className="ml-1.5 text-[10px] text-[#94A3B8]">· {h.group_name}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {h.is_consumed && (
                    <span className="text-[9px] text-[#94A3B8]">consumed</span>
                  )}
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold capitalize ${statusBadgeCls(h.status)}`}>
                    {h.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

// ─── Build StudentResult for wizard ──────────────────────────────────────────

function buildWizardStudent(s: GroupDetailStudent, group: GroupOperationalRow): StudentResult {
  return {
    id:                       s.student_id,
    name:                     s.student_name,
    code:                     s.student_code,
    email:                    null,
    phone:                    s.phone,
    age:                      s.age,
    branch_id:                group.branch_id,
    branch_name:              group.branch_name,
    parent_name:              null,
    parent_phone:             s.parent_phone,
    active_enrollments_count: s.enrollment_id ? 1 : 0,
    active_course_ids:        [],
    active_group_name:        group.name,
    financial_status:         s.payment_status,
    enrolled_sessions:        s.sessions_total,
    remaining_sessions:       s.sessions_remaining,
    active_summaries: s.enrollment_id ? [{
      course_name:        group.course_name ?? null,
      group_name:         group.name,
      remaining_sessions: s.sessions_remaining ?? 0,
      financial_status:   s.payment_status,
    }] : [],
  }
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  student:          GroupDetailStudent
  group:            GroupOperationalRow
  onClose:          () => void
  onStudentUpdated?: () => void
}

export default function StudentQuickViewModal({ student: s, group, onClose, onStudentUpdated }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab]       = useState<Tab>('overview')
  const [history, setHistory]           = useState<StudentAttendanceHistoryRecord[] | null>(null)
  const [histLoad, setHistLoad]         = useState(true)
  const [authData, setAuthData]         = useState<StudentPortalCredentials | null>(null)
  const [authLoading, setAuthLoading]   = useState(true)
  const [attSummary, setAttSummary]     = useState<StudentAttendanceSummary | null>(null)
  const [attSumLoading, setAttSumLoading] = useState(true)
  const [financeOpen, setFinanceOpen]   = useState(false)

  // ESC to close (but not if finance wizard is open)
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !financeOpen) onClose()
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose, financeOpen])

  // Load attendance history
  useEffect(() => {
    let cancelled = false
    setHistLoad(true)
    getStudentAttendanceHistoryAction(s.student_id)
      .then(h => { if (!cancelled) { setHistory(h); setHistLoad(false) } })
      .catch(() => { if (!cancelled) { setHistory([]); setHistLoad(false) } })
    return () => { cancelled = true }
  }, [s.student_id])

  // Load auth data
  useEffect(() => {
    let cancelled = false
    setAuthLoading(true)
    getStudentAuthDataAction(s.student_id)
      .then(d => { if (!cancelled) { setAuthData(d); setAuthLoading(false) } })
      .catch(() => { if (!cancelled) { setAuthData(null); setAuthLoading(false) } })
    return () => { cancelled = true }
  }, [s.student_id])

  // Load attendance summary
  useEffect(() => {
    let cancelled = false
    setAttSumLoading(true)
    getStudentAttendanceSummaryAction(s.student_id)
      .then(d => { if (!cancelled) { setAttSummary(d); setAttSumLoading(false) } })
      .catch(() => { if (!cancelled) { setAttSummary(null); setAttSumLoading(false) } })
    return () => { cancelled = true }
  }, [s.student_id])

  const waUrl  = buildWhatsAppUrl(s.parent_phone, s.phone)
  const telUrl = buildTelUrl(s.parent_phone, s.phone)
  const stuTel = buildTelUrl(null, s.phone)

  const riskCls = s.risk_level === 'HIGH'   ? 'bg-red-100 text-red-700'
                : s.risk_level === 'MEDIUM' ? 'bg-amber-100 text-amber-700'
                :                             'bg-emerald-100 text-emerald-700'

  function handleOpenFinance(_mode: 'collect' | 'create') {
    setFinanceOpen(true)
  }

  function handleFinanceSuccess() {
    setFinanceOpen(false)
    // Refresh attendance summary + history to reflect new consumption state
    getStudentAttendanceSummaryAction(s.student_id).then(d => setAttSummary(d)).catch(() => {})
    getStudentAttendanceHistoryAction(s.student_id).then(h => setHistory(h)).catch(() => {})
    router.refresh()
    onStudentUpdated?.()
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]" onClick={() => { if (!financeOpen) onClose() }} />

      {/* Modal panel */}
      <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center p-0 sm:p-4" onClick={() => { if (!financeOpen) onClose() }}>
        <div
          className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ────────────────────────────────────────────────── */}
          <div className="shrink-0 border-b border-[#E2E8F0] bg-white px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0B1F3A] text-[14px] font-bold text-white">
                {initials(s.student_name)}
              </div>

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

            {/* Quick contact */}
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
            {activeTab === 'overview' && (
              <OverviewTab
                s={s}
                group={group}
                authData={authData}
                authLoading={authLoading}
                attSummary={attSummary}
                attSumLoading={attSumLoading}
              />
            )}
            {activeTab === 'finance' && (
              <FinanceTab
                s={s}
                group={group}
                onOpenFinance={handleOpenFinance}
              />
            )}
            {activeTab === 'attendance' && (
              <AttendanceTab
                history={history}
                loading={histLoad}
                attSummary={attSummary}
                attSumLoading={attSumLoading}
              />
            )}
            {activeTab === 'learning' && (
              <LearningTab
                s={s}
                group={group}
                history={history}
                histLoad={histLoad}
                attSummary={attSummary}
              />
            )}
          </div>
        </div>
      </div>

      {/* Finance wizard — rendered above student modal */}
      {financeOpen && (
        <EnrollmentWizard
          branchIds={[group.branch_id]}
          preselectedStudent={buildWizardStudent(s, group)}
          onClose={() => setFinanceOpen(false)}
          onSuccess={handleFinanceSuccess}
          overlayClassName="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
        />
      )}
    </>
  )
}
