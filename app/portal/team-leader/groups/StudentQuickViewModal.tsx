'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { buildWhatsAppUrl, buildTelUrl } from '@/lib/phone'
import EnrollmentWizard from '../finance/EnrollmentWizard'
import type { StudentResult } from '../finance/EnrollmentWizard'
import ParentFormModal from '../parents/ParentFormModal'
import {
  getStudentAttendanceHistoryAction,
  getStudentAuthDataAction,
  getParentAuthDataAction,
  getStudentAttendanceSummaryAction,
  getStudentPackageLedgerAction,
  getStudentCourseTimelineAction,
  removeConsumptionAction,
  reconcileStudentConsumptionAction,
  type GroupDetailStudent,
  type StudentAttendanceHistoryRecord,
  type StudentPortalCredentials,
  type ParentPortalCredentials,
  type StudentAttendanceSummary,
  type PackageLedgerRecord,
  type StudentCourseTimelineEntry,
} from '@/modules/groups/modal-actions'
import type { GroupOperationalRow } from '@/modules/groups/operational'
import {
  getWelcomeMessageStatusAction,
  sendWelcomeWhatsAppAction,
  generateMissingWelcomeCredentialsAction,
} from '@/modules/students/welcome-message'
import { getParentEditContextAction } from '@/modules/parents/contact-actions'
import type { ParentOperationalRow, StudentPickerOption } from '@/modules/parents/operational'

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
  if (status === 'present')   return 'bg-[#E7F8EE] text-[#15803D]'
  if (status === 'late')      return 'bg-[#FFFBEB] text-[#B45309]'
  if (status === 'absent')    return 'bg-[#FEE2E2] text-[#DC2626]'
  if (status === 'excused')   return 'bg-[#EFF6FF] text-[#1D4ED8]'
  if (status === 'makeup')    return 'bg-purple-100 text-purple-700'
  if (status === 'cancelled') return 'bg-[#F1F5F9] text-[#94A3B8]'
  return 'bg-[#F1F5F9] text-[#475569]'
}

function paymentStatusCls(s: string | null) {
  if (s === 'OVERDUE')  return 'bg-[#FEE2E2] text-[#DC2626]'
  if (s === 'DUE_SOON') return 'bg-[#FFFBEB] text-[#B45309]'
  if (s === 'PAID')     return 'bg-[#E7F8EE] text-[#15803D]'
  if (s === 'BLOCKED')  return 'bg-[#FECACA] text-[#991B1B]'
  return 'bg-[#F1F5F9] text-[#475569]'
}

function enrollmentStatusCls(status: string) {
  if (status === 'ACTIVE')    return 'bg-[#E7F8EE] text-[#15803D]'
  if (status === 'COMPLETED') return 'bg-[#EFF6FF] text-[#1D4ED8]'
  if (status === 'EXPIRED')   return 'bg-[#F1F5F9] text-[#64748B]'
  return 'bg-[#F1F5F9] text-[#64748B]'
}

async function copyToClipboard(text: string) {
  try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
}

// A wa.me link opened inside a JS-created window (window.open + later
// location.href) doesn't get the OS-level App Link handoff on iOS/Android —
// it just renders the wa.me fallback page, which is why the WhatsApp button
// was landing on WhatsApp Web instead of the native app. A direct same-tab
// navigation is what mobile browsers hand off to the installed app.
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
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
      className="flex items-center gap-1.5 rounded-lg bg-[#10B981] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#059669] transition"
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
      className="flex items-center gap-1.5 ds-card px-3 py-1.5 text-[11px] font-medium text-[#374151] hover:bg-[#F8FAFC] transition"
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

function WelcomeMessageButton({
  disabled, tooltip, sending, onClick,
}: {
  disabled: boolean
  tooltip:  string | null
  sending:  boolean
  onClick:  () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || sending}
      title={tooltip ?? undefined}
      className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1FB855] disabled:cursor-not-allowed disabled:opacity-40 transition"
    >
      🚀 {sending ? 'Sending…' : 'Send Welcome Message'}
    </button>
  )
}

function GenerateCredentialsButton({ generating, onClick }: { generating: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={generating}
      title="Generate a new portal password for the account(s) missing one"
      className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-[#FFFBEB] px-3 py-1.5 text-[11px] font-semibold text-[#B45309] hover:bg-[#FEF3C7] disabled:cursor-not-allowed disabled:opacity-50 transition"
    >
      ⚠ {generating ? 'Generating…' : 'Generate Credentials'}
    </button>
  )
}

function CreateParentAccountButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title="Create a parent portal account for this student"
      className="flex items-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5 text-[11px] font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE] disabled:cursor-not-allowed disabled:opacity-50 transition"
    >
      + {loading ? 'Loading…' : 'Create Parent Account'}
    </button>
  )
}

// ─── Attendance ring ──────────────────────────────────────────────────────────

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

type Tab = 'overview' | 'finance' | 'attendance' | 'package-ledger' | 'history'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview',        label: 'Overview' },
  { key: 'finance',         label: 'Finance' },
  { key: 'attendance',      label: 'Attendance' },
  { key: 'package-ledger',  label: 'Package Ledger' },
  { key: 'history',         label: 'History' },
]

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function portalStatusBadge(status: StudentPortalCredentials['status']) {
  if (status === 'active')           return <span className="rounded-full bg-[#E7F8EE] px-2 py-0.5 text-[9px] font-bold text-[#15803D] uppercase tracking-wide">Active</span>
  if (status === 'password_missing') return <span className="rounded-full bg-[#FFFBEB]  px-2 py-0.5 text-[9px] font-bold text-[#B45309]  uppercase tracking-wide">Password Not Set</span>
  if (status === 'no_access')        return <span className="rounded-full bg-[#FEE2E2]    px-2 py-0.5 text-[9px] font-bold text-[#DC2626]    uppercase tracking-wide">No Portal Access</span>
  return                                    <span className="rounded-full bg-[#F1F5F9]  px-2 py-0.5 text-[9px] font-bold text-[#64748B]  uppercase tracking-wide">No Account</span>
}

// Shared card for displaying portal email/password — used for both the student's
// own account and the parent's account so newly generated credentials show up
// identically in both places without reopening the modal.
function AuthCard({
  title, data, loading,
}: {
  title:   string
  data:    { email: string | null; portal_password: string | null; status: StudentPortalCredentials['status'] } | null
  loading: boolean
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">{title}</p>
        {!loading && data && portalStatusBadge(data.status)}
      </div>
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 space-y-0">
        <div className="flex items-center justify-between gap-2 border-b border-[#F1F5F9] py-1.5">
          <span className="shrink-0 text-[11px] text-[#94A3B8]">Email</span>
          <div className="flex items-center gap-1.5 min-w-0">
            {loading ? (
              <Skeleton className="h-3.5 w-36" />
            ) : data?.email ? (
              <>
                <span className="font-mono text-[11px] text-[#0B1F3A] truncate">{data.email}</span>
                <CopyButton value={data.email} label="email" />
              </>
            ) : (
              <span className="text-[11px] text-[#CBD5E1]">No email</span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 py-1.5">
          <span className="shrink-0 text-[11px] text-[#94A3B8]">Password</span>
          <div className="flex items-center gap-1.5 min-w-0">
            {loading ? (
              <Skeleton className="h-3.5 w-28" />
            ) : data?.portal_password ? (
              <>
                <span className="font-mono text-[12px] font-semibold text-[#0B1F3A] tracking-wide">
                  {data.portal_password}
                </span>
                <CopyButton value={data.portal_password} label="password" />
              </>
            ) : (
              <span className="text-[11px] text-[#CBD5E1]">No portal password assigned</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function OverviewTab({
  s, group, authData, authLoading, parentAuthData, parentAuthLoading, attSummary, attSumLoading,
}: {
  s:            GroupDetailStudent
  group:        GroupOperationalRow
  authData:     StudentPortalCredentials | null
  authLoading:  boolean
  parentAuthData:    ParentPortalCredentials | null
  parentAuthLoading: boolean
  attSummary:   StudentAttendanceSummary | null
  attSumLoading: boolean
}) {
  const attColor = (pct: number) =>
    pct >= 85 ? 'text-[#10B981] bg-[#E7F8EE] border-emerald-100'
    : pct >= 60 ? 'text-[#F59E0B] bg-[#FFFBEB] border-amber-100'
    : pct > 0   ? 'text-[#EF4444] bg-[#FEE2E2] border-[#FEE2E2]'
    :             'text-[#94A3B8] bg-[#F1F5F9] border-[#E2E8F0]'

  return (
    <div className="space-y-4">
      {/* Authentication — student + parent portal accounts, always kept in sync
          with the latest generated credentials so nothing requires reopening. */}
      <AuthCard title="Student Portal" data={authData}       loading={authLoading} />
      <AuthCard title="Parent Portal"  data={parentAuthData} loading={parentAuthLoading} />

      {/* Contact */}
      <div>
        <SectionLabel>Contact</SectionLabel>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
          <InfoRow label="Student phone" value={s.phone ?? <span className="text-[#CBD5E1]">—</span>} />
          <InfoRow label="Parent phone"  value={s.parent_phone ?? <span className="text-[#CBD5E1]">—</span>} />
        </div>
      </div>

      {/* Parent Information */}
      <div>
        <SectionLabel>Parent Information</SectionLabel>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
          <InfoRow label="Parent Name"   value={s.parent?.full_name    ?? <span className="text-[#CBD5E1]">—</span>} />
          <InfoRow label="Parent Email"  value={s.parent?.email        ?? <span className="text-[#CBD5E1]">—</span>} />
          {s.parent?.portal_email && s.parent.portal_email !== s.parent.email && (
            <InfoRow label="Portal Email" value={s.parent.portal_email} />
          )}
          <InfoRow label="Parent Phone"  value={s.parent?.phone ?? s.parent_phone ?? <span className="text-[#CBD5E1]">—</span>} />
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
              ? <span className={s.sessions_remaining <= 2 ? 'text-[#EF4444] font-semibold' : ''}>{s.sessions_remaining}</span>
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
                { label: 'Present',  value: attSummary.present_count,  cls: 'bg-[#E7F8EE] border-emerald-100 text-[#15803D]' },
                { label: 'Absent',   value: attSummary.absent_count,   cls: 'bg-[#FEE2E2] border-[#FEE2E2] text-[#DC2626]' },
                { label: 'Late',     value: attSummary.late_count,     cls: 'bg-[#FFFBEB] border-amber-100 text-[#B45309]' },
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
  s,
  onCollectPayment,
  onCreateContract,
}: {
  s:                GroupDetailStudent
  onCollectPayment: () => void
  onCreateContract: () => void
}) {
  const finCase = detectFinanceCase(s)
  const sub     = s.subscription_amount ?? 0

  return (
    <div className="space-y-4">
      {finCase === 'no_contract' && (
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-5 text-center">
          <div className="mb-2 inline-flex rounded-full bg-[#F1F5F9] px-3 py-1 text-[11px] font-semibold text-[#64748B]">
            No active financial contract
          </div>
          <p className="text-[12px] text-[#94A3B8]">
            Create a contract to start session tracking and payment collection.
          </p>
        </div>
      )}

      {finCase === 'exhausted' && (
        <div className="rounded-xl border border-[#FEE2E2] bg-[#FEE2E2] px-4 py-2.5 flex items-center gap-2">
          <span className="text-[#EF4444] text-[16px]">⚠</span>
          <p className="text-[12px] font-semibold text-[#DC2626]">Package exhausted — renew to continue tracking</p>
        </div>
      )}

      {finCase === 'overdue' && (
        <div className="rounded-xl border border-[#FEE2E2] bg-[#FEE2E2] px-4 py-2.5 flex items-center gap-2">
          <span className="text-[#EF4444] text-[16px]">!</span>
          <p className="text-[12px] font-semibold text-[#DC2626]">Payment overdue — collection action required</p>
        </div>
      )}

      {/* Contract summary */}
      {finCase !== 'no_contract' && (
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
          <InfoRow label="Package / Subscription" value={sub > 0 ? fmtCurrency(sub) : '—'} />
          <InfoRow label="Sessions enrolled"      value={s.sessions_total != null ? `${s.sessions_total}` : '—'} />
          <InfoRow label="Sessions consumed"      value={s.sessions_used  != null ? `${s.sessions_used}`  : '—'} />
          <InfoRow label="Sessions remaining"     value={
            s.sessions_remaining != null
              ? <span className={s.sessions_remaining <= 2 ? 'text-[#EF4444] font-semibold' : ''}>{s.sessions_remaining}</span>
              : '—'
          } />
          <InfoRow label="Total paid"    value={s.paid_amount > 0 ? fmtCurrency(s.paid_amount) : '—'} />
          <InfoRow label="Remaining balance" value={
            s.remaining_balance > 0
              ? <span className="font-semibold text-[#EF4444]">{fmtCurrency(s.remaining_balance)}</span>
              : <span className="text-[#10B981]">Settled</span>
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

      {/* Actions — each button has a distinct, independent purpose */}
      {finCase === 'no_contract' ? (
        <button
          onClick={onCreateContract}
          className="w-full rounded-xl bg-[#FF8A1F] px-4 py-2.5 text-center text-[13px] font-semibold text-white hover:bg-[#e87c18] transition"
        >
          Create Contract
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Collect Payment — opens lightweight payment modal, NOT the enrollment wizard */}
          <button
            onClick={onCollectPayment}
            className="w-full rounded-xl bg-[#FF8A1F] px-4 py-2.5 text-center text-[13px] font-semibold text-white hover:bg-[#e87c18] transition"
          >
            Collect Payment
          </button>
          {/* Renew Contract — opens full enrollment wizard to create a new package */}
          <button
            onClick={onCreateContract}
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
      {attSumLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : attSummary && attSummary.total_records > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[#E7F8EE] border border-emerald-100 px-3 py-2 text-center">
            <p className="text-[18px] font-bold text-[#15803D]">{attSummary.present_count}</p>
            <p className="text-[9px] font-medium text-[#10B981] uppercase tracking-wide">Present</p>
          </div>
          <div className="rounded-xl bg-[#FEE2E2] border border-[#FEE2E2] px-3 py-2 text-center">
            <p className="text-[18px] font-bold text-[#DC2626]">{attSummary.absent_count}</p>
            <p className="text-[9px] font-medium text-[#EF4444] uppercase tracking-wide">Absent</p>
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
                      <span className="rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] font-semibold text-[#64748B]">
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

// ─── Package Ledger Tab ───────────────────────────────────────────────────────

function PackageLedgerTab({
  ledger,
  loading,
  reconciling,
  onRemove,
  onReconcile,
}: {
  ledger:      PackageLedgerRecord[] | null
  loading:     boolean
  reconciling: boolean
  onRemove:    (consumptionId: string) => Promise<void>
  onReconcile: () => Promise<void>
}) {
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  async function handleRemove(consumptionId: string) {
    if (!confirm('Remove this consumption entry? This will restore one session slot to the package.')) return
    setRemovingId(consumptionId)
    setRemoveError(null)
    await onRemove(consumptionId)
    setRemovingId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionLabel>Package Ledger</SectionLabel>
          {ledger && (
            <p className="-mt-1 text-[11px] text-[#64748B]">
              {ledger.length} consumption {ledger.length === 1 ? 'record' : 'records'}
            </p>
          )}
        </div>
        <button
          onClick={onReconcile}
          disabled={reconciling || loading}
          className="shrink-0 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[11px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F] disabled:opacity-50 transition"
        >
          {reconciling ? 'Running…' : 'Reconcile'}
        </button>
      </div>

      {removeError && (
        <p className="rounded-lg bg-[#FEE2E2] border border-[#FEE2E2] px-3 py-2 text-[11px] text-[#EF4444]">{removeError}</p>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : !ledger || ledger.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-8 text-center">
          <p className="text-[13px] font-medium text-[#94A3B8]">No consumption records found</p>
          <p className="mt-1 text-[11px] text-[#CBD5E1]">
            Sessions appear here after attendance is recorded and linked to a package.
          </p>
          <button
            onClick={onReconcile}
            disabled={reconciling}
            className="mt-4 rounded-lg bg-[#FF8A1F] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#e87c18] disabled:opacity-50 transition"
          >
            {reconciling ? 'Running reconciliation…' : 'Run Reconciliation Now'}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
          {ledger.map(rec => (
            <div key={rec.consumption_id} className="border-b border-[#F1F5F9] last:border-0 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] font-semibold text-[#0B1F3A]">{fmtDate(rec.session_date)}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold capitalize ${statusBadgeCls(rec.attendance_status)}`}>
                      {rec.attendance_status}
                    </span>
                    <span className="rounded-full bg-[#E7F8EE] px-1.5 py-0.5 text-[9px] font-semibold text-[#15803D]">
                      consumed
                    </span>
                  </div>
                  {rec.topic && (
                    <p className="mt-0.5 text-[10px] text-[#0B1F3A] font-medium truncate">{rec.topic}</p>
                  )}
                  <p className="mt-0.5 text-[10px] text-[#64748B] truncate">
                    {[rec.course_name, rec.group_name, rec.instructor_name].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mt-0.5 text-[9px] text-[#CBD5E1]">
                    Package: {rec.enrolled_sessions} sessions · From {fmtDate(rec.enrollment_start)}
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(rec.consumption_id)}
                  disabled={removingId === rec.consumption_id}
                  className="shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-medium text-[#EF4444] hover:bg-[#FEE2E2] disabled:opacity-50 transition"
                >
                  {removingId === rec.consumption_id ? '…' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── History Tab (academic timeline) ─────────────────────────────────────────
// Data comes from v_student_course_history, which derives group/course from
// attendance_records → schedules → group_courses. One card per (group, course).

function HistoryTab({
  timeline,
  loading,
}: {
  timeline: StudentCourseTimelineEntry[] | null
  loading:  boolean
}) {
  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Academic History</SectionLabel>
        <p className="-mt-1 text-[11px] text-[#64748B]">Course attendance · one card per course</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : !timeline || timeline.length === 0 ? (
        <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-6 text-center text-[12px] text-[#94A3B8]">
          No attendance history yet.
        </p>
      ) : (
        <div className="space-y-3">
          {timeline.map((entry, idx) => {
            const enrolled  = entry.enrolled_sessions  ?? 0
            const consumed  = entry.consumed_sessions  ?? 0
            const remaining = entry.remaining_sessions ?? 0
            const pct       = enrolled > 0 ? Math.min(100, Math.round((consumed / enrolled) * 100)) : 0
            const rate      = Number(entry.attendance_rate ?? 0)
            const rateCls   = rate >= 85 ? 'bg-[#E7F8EE] border-emerald-100 text-[#15803D]'
                            : rate >= 60 ? 'bg-[#FFFBEB]  border-amber-100  text-[#B45309]'
                            :              'bg-[#FEE2E2]    border-[#FEE2E2]    text-[#DC2626]'
            const rateTextCls = rate >= 85 ? 'text-[#15803D]' : rate >= 60 ? 'text-[#B45309]' : 'text-[#DC2626]'

            return (
              <div key={`${entry.group_id}-${entry.course_id ?? 'none'}-${idx}`}
                   className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">

                {/* Header: course name + enrollment status */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#0B1F3A] truncate">
                      {entry.course_name ?? 'General Sessions'}
                    </p>
                    <p className="text-[11px] text-[#64748B] truncate mt-0.5">
                      {[entry.group_name, entry.instructor_name].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {entry.enrollment_status && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${enrollmentStatusCls(entry.enrollment_status)}`}>
                      {entry.enrollment_status}
                    </span>
                  )}
                </div>

                {/* Date range */}
                <div className="flex flex-wrap gap-x-4 text-[10px] text-[#94A3B8] mb-3">
                  <span>First: {fmtDate(entry.first_session_date)}</span>
                  <span>Last: {fmtDate(entry.last_session_date)}</span>
                </div>

                {/* Attendance stats: present / absent / late / rate */}
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  <div className="rounded-lg bg-[#E7F8EE] border border-emerald-100 px-2 py-2 text-center">
                    <p className="text-[15px] font-bold text-[#15803D]">{entry.total_present}</p>
                    <p className="text-[8px] font-semibold text-[#10B981] uppercase tracking-wide">Present</p>
                  </div>
                  <div className="rounded-lg bg-[#FEE2E2] border border-[#FEE2E2] px-2 py-2 text-center">
                    <p className="text-[15px] font-bold text-[#DC2626]">{entry.total_absent}</p>
                    <p className="text-[8px] font-semibold text-[#EF4444] uppercase tracking-wide">Absent</p>
                  </div>
                  <div className="rounded-lg bg-[#FFFBEB] border border-amber-100 px-2 py-2 text-center">
                    <p className="text-[15px] font-bold text-[#B45309]">{entry.total_late}</p>
                    <p className="text-[8px] font-semibold text-[#F59E0B] uppercase tracking-wide">Late</p>
                  </div>
                  <div className={`rounded-lg border px-2 py-2 text-center ${rateCls}`}>
                    <p className={`text-[15px] font-bold ${rateTextCls}`}>{rate}%</p>
                    <p className={`text-[8px] font-semibold uppercase tracking-wide ${rateTextCls}`}>Rate</p>
                  </div>
                </div>

                {/* Package section — only shown when an enrollment is linked */}
                {enrolled > 0 && (
                  <div className="border-t border-[#E2E8F0] pt-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#94A3B8] mb-2">Package</p>
                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                      <div className="rounded-lg bg-white border border-[#E2E8F0] px-2 py-1.5 text-center">
                        <p className="text-[14px] font-bold text-[#0B1F3A]">{enrolled}</p>
                        <p className="text-[8px] font-medium text-[#94A3B8] uppercase tracking-wide">Enrolled</p>
                      </div>
                      <div className="rounded-lg bg-white border border-[#E2E8F0] px-2 py-1.5 text-center">
                        <p className="text-[14px] font-bold text-[#FF8A1F]">{consumed}</p>
                        <p className="text-[8px] font-medium text-[#94A3B8] uppercase tracking-wide">Consumed</p>
                      </div>
                      <div className="rounded-lg bg-white border border-[#E2E8F0] px-2 py-1.5 text-center">
                        <p className={`text-[14px] font-bold ${remaining <= 2 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                          {remaining}
                        </p>
                        <p className="text-[8px] font-medium text-[#94A3B8] uppercase tracking-wide">Remaining</p>
                      </div>
                    </div>
                    <div className="flex justify-between text-[9px] text-[#94A3B8] mb-0.5">
                      <span>Package progress</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#F1F5F9]">
                      <div
                        className={`h-1.5 rounded-full transition-all ${pct >= 75 ? 'bg-[#10B981]' : pct >= 40 ? 'bg-[#F59E0B]' : 'bg-[#CBD5E1]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
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
  student:              GroupDetailStudent
  group:                GroupOperationalRow
  onClose:              () => void
  onStudentUpdated?:    () => void
  // Background sync only — unlike onStudentUpdated, never closes the dialog.
  // Credentials aren't shown in the outer group table, so this is a no-op by
  // default; callers that surface credential state elsewhere can hook in here.
  onCredentialsRefreshed?: () => void
  onOpenFullFinance?:   () => void
  canSendWelcome?:      boolean
}

export default function StudentQuickViewModal({ student: s, group, onClose, onStudentUpdated, onCredentialsRefreshed, onOpenFullFinance, canSendWelcome = false }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Overview + Attendance data (loaded eagerly)
  const [history,       setHistory]       = useState<StudentAttendanceHistoryRecord[] | null>(null)
  const [histLoad,      setHistLoad]       = useState(true)
  const [authData,      setAuthData]       = useState<StudentPortalCredentials | null>(null)
  const [authLoading,   setAuthLoading]    = useState(true)
  const [parentAuthData,    setParentAuthData]    = useState<ParentPortalCredentials | null>(null)
  const [parentAuthLoading, setParentAuthLoading] = useState(true)
  const [attSummary,    setAttSummary]     = useState<StudentAttendanceSummary | null>(null)
  const [attSumLoading, setAttSumLoading]  = useState(true)

  // Toast — success/error feedback that doesn't interrupt the dialog (no alert()/close)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  // Package Ledger data (loaded on tab open)
  const [ledger,       setLedger]      = useState<PackageLedgerRecord[] | null>(null)
  const [ledgerLoad,   setLedgerLoad]  = useState(false)
  const [ledgerDirty,  setLedgerDirty] = useState(false)
  const [reconciling,  setReconciling] = useState(false)

  // History / timeline data (loaded on tab open)
  const [timeline,     setTimeline]    = useState<StudentCourseTimelineEntry[] | null>(null)
  const [timelineLoad, setTimelineLoad] = useState(false)
  const [timelineDirty, setTimelineDirty] = useState(false)

  // Overlay modals
  const [wizardOpen, setWizardOpen] = useState(false)

  // Parent portal account creation (reuses ParentFormModal from the Parents page)
  const [parentModalOpen,    setParentModalOpen]    = useState(false)
  const [parentModalLoading, setParentModalLoading] = useState(false)
  const [parentEditData,     setParentEditData]     = useState<{
    parent:         ParentOperationalRow
    studentOptions: StudentPickerOption[]
  } | null>(null)

  // Welcome WhatsApp message
  const [welcomeEligible,      setWelcomeEligible]      = useState(false)
  const [welcomeTooltip,       setWelcomeTooltip]       = useState<string | null>('Loading…')
  const [welcomeCanRegenerate, setWelcomeCanRegenerate] = useState(false)
  const [welcomeLastSent,      setWelcomeLastSent]      = useState<string | null>(null)
  const [welcomeSending,       setWelcomeSending]       = useState(false)
  const [welcomeRegenerating,  setWelcomeRegenerating]  = useState(false)

  // ESC to close (but not if an overlay modal is open)
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !wizardOpen && !parentModalOpen) onClose()
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose, wizardOpen, parentModalOpen])

  // Eager-load data needed for Overview + Attendance tabs
  useEffect(() => {
    let cancelled = false
    setHistLoad(true)
    getStudentAttendanceHistoryAction(s.student_id)
      .then(h => { if (!cancelled) { setHistory(h); setHistLoad(false) } })
      .catch(() => { if (!cancelled) { setHistory([]); setHistLoad(false) } })
    return () => { cancelled = true }
  }, [s.student_id])

  // Shared loaders — reused by the eager-load effect below AND by
  // handleGenerateCredentials, so a freshly generated password shows up in this
  // same open dialog without the user closing/reopening it.
  const loadAuthData = useCallback(() => {
    setAuthLoading(true)
    return getStudentAuthDataAction(s.student_id)
      .then(d => { setAuthData(d); setAuthLoading(false); return d })
      .catch(() => { setAuthData(null); setAuthLoading(false); return null })
  }, [s.student_id])

  const loadParentAuthData = useCallback(() => {
    setParentAuthLoading(true)
    return getParentAuthDataAction(s.student_id)
      .then(d => { setParentAuthData(d); setParentAuthLoading(false); return d })
      .catch(() => { setParentAuthData(null); setParentAuthLoading(false); return null })
  }, [s.student_id])

  useEffect(() => {
    let cancelled = false
    setAuthLoading(true)
    getStudentAuthDataAction(s.student_id)
      .then(d => { if (!cancelled) { setAuthData(d); setAuthLoading(false) } })
      .catch(() => { if (!cancelled) { setAuthData(null); setAuthLoading(false) } })
    return () => { cancelled = true }
  }, [s.student_id])

  useEffect(() => {
    let cancelled = false
    setParentAuthLoading(true)
    getParentAuthDataAction(s.student_id)
      .then(d => { if (!cancelled) { setParentAuthData(d); setParentAuthLoading(false) } })
      .catch(() => { if (!cancelled) { setParentAuthData(null); setParentAuthLoading(false) } })
    return () => { cancelled = true }
  }, [s.student_id])

  useEffect(() => {
    let cancelled = false
    setAttSumLoading(true)
    getStudentAttendanceSummaryAction(s.student_id)
      .then(d => { if (!cancelled) { setAttSummary(d); setAttSumLoading(false) } })
      .catch(() => { if (!cancelled) { setAttSummary(null); setAttSumLoading(false) } })
    return () => { cancelled = true }
  }, [s.student_id])

  // Lazy-load Package Ledger when that tab is opened (or when dirty after an action)
  const loadLedger = useCallback(() => {
    let cancelled = false
    setLedgerLoad(true)
    setLedgerDirty(false)
    getStudentPackageLedgerAction(s.student_id)
      .then(d => { if (!cancelled) { setLedger(d); setLedgerLoad(false) } })
      .catch(() => { if (!cancelled) { setLedger([]); setLedgerLoad(false) } })
    return () => { cancelled = true }
  }, [s.student_id])

  useEffect(() => {
    if (activeTab === 'package-ledger' && (ledger === null || ledgerDirty)) {
      loadLedger()
    }
  }, [activeTab, ledger, ledgerDirty, loadLedger])

  // Lazy-load History/Timeline when that tab is opened
  const loadTimeline = useCallback(() => {
    let cancelled = false
    setTimelineLoad(true)
    setTimelineDirty(false)
    getStudentCourseTimelineAction(s.student_id)
      .then(d => { if (!cancelled) { setTimeline(d); setTimelineLoad(false) } })
      .catch(() => { if (!cancelled) { setTimeline([]); setTimelineLoad(false) } })
    return () => { cancelled = true }
  }, [s.student_id])

  useEffect(() => {
    if (activeTab === 'history' && (timeline === null || timelineDirty)) {
      loadTimeline()
    }
  }, [activeTab, timeline, timelineDirty, loadTimeline])

  // Package Ledger actions
  async function handleRemoveConsumption(consumptionId: string) {
    const result = await removeConsumptionAction(consumptionId, s.student_id)
    if ('error' in result) {
      alert(`Failed to remove consumption: ${result.error}`)
      return
    }
    setLedgerDirty(true)
    setTimelineDirty(true)
    getStudentAttendanceSummaryAction(s.student_id).then(d => setAttSummary(d)).catch(() => {})
    router.refresh()
    onStudentUpdated?.()
  }

  async function handleReconcile() {
    setReconciling(true)
    const result = await reconcileStudentConsumptionAction(s.student_id)
    setReconciling(false)
    if ('error' in result) {
      alert(`Reconciliation failed: ${result.error}`)
      return
    }
    setLedgerDirty(true)
    setTimelineDirty(true)
    getStudentAttendanceSummaryAction(s.student_id).then(d => setAttSummary(d)).catch(() => {})
    router.refresh()
    onStudentUpdated?.()
  }

  // Welcome message eligibility (only relevant for TL/super_admin)
  useEffect(() => {
    if (!canSendWelcome) return
    let cancelled = false
    getWelcomeMessageStatusAction(s.student_id)
      .then(status => {
        if (cancelled) return
        setWelcomeEligible(status.eligibility.eligible)
        setWelcomeTooltip(status.eligibility.reason)
        setWelcomeCanRegenerate(status.eligibility.canRegenerate)
        setWelcomeLastSent(status.lastSentAt)
      })
      .catch(() => {
        if (cancelled) return
        setWelcomeEligible(false)
        setWelcomeTooltip('Unable to check eligibility.')
        setWelcomeCanRegenerate(false)
      })
    return () => { cancelled = true }
  }, [canSendWelcome, s.student_id])

  async function handleSendWelcomeMessage() {
    const mobile = isMobileDevice()
    // Desktop: open the tab synchronously, inside the click handler, so the
    // browser still treats it as user-initiated — it would otherwise block
    // window.open() called after an await breaks the user-gesture chain.
    // WhatsApp Web is the correct desktop destination, so this stays a new tab.
    // Mobile: skip the blank tab entirely and navigate the current tab once the
    // URL is ready — that's what actually triggers the native WhatsApp app to
    // open with the message pre-filled, instead of falling back to WhatsApp Web.
    const pending = mobile ? null : window.open('', '_blank')
    setWelcomeSending(true)
    const result = await sendWelcomeWhatsAppAction(s.student_id)
    setWelcomeSending(false)
    if ('error' in result) {
      pending?.close()
      alert(result.error)
      return
    }
    if (mobile) {
      window.location.href = result.url
    } else if (pending) {
      pending.location.href = result.url
    } else {
      window.open(result.url, '_blank')
    }
    setWelcomeLastSent(new Date().toISOString())
  }

  async function handleGenerateCredentials() {
    setWelcomeRegenerating(true)
    const result = await generateMissingWelcomeCredentialsAction(s.student_id)
    setWelcomeRegenerating(false)
    if (!result.success) {
      // Keep the dialog open and preserve everything already loaded — just surface the error.
      showToast('error', result.error)
      return
    }
    // Refresh the credentials shown in this same open dialog (student + parent),
    // plus the Send Welcome Message eligibility that gates the WhatsApp button —
    // no close/reopen needed to see or act on the new credentials.
    const [status] = await Promise.all([
      getWelcomeMessageStatusAction(s.student_id),
      loadAuthData(),
      loadParentAuthData(),
    ])
    setWelcomeEligible(status.eligibility.eligible)
    setWelcomeTooltip(status.eligibility.reason)
    setWelcomeCanRegenerate(status.eligibility.canRegenerate)
    showToast('success', 'Credentials generated — ready to send.')
    // Deliberately NOT onStudentUpdated() — in GroupWorkspace that callback also
    // does setQuickViewStudent(null), which unmounts this dialog. Credentials
    // aren't shown in the outer group table, so only a background sync (if the
    // caller wants one) belongs here — never a close.
    onCredentialsRefreshed?.()
  }

  // Create parent portal account (embeds the Parents page's ParentFormModal)
  async function handleOpenParentAccountModal() {
    if (!s.parent) return
    setParentModalLoading(true)
    const result = await getParentEditContextAction(s.parent.id, group.branch_id)
    setParentModalLoading(false)
    if (!result.success) {
      alert(result.error)
      return
    }
    setParentEditData(result.data)
    setParentModalOpen(true)
  }

  async function handleParentAccountCreated() {
    setParentModalOpen(false)
    setParentEditData(null)
    const [status] = await Promise.all([
      getWelcomeMessageStatusAction(s.student_id),
      loadParentAuthData(),
    ])
    setWelcomeEligible(status.eligibility.eligible)
    setWelcomeTooltip(status.eligibility.reason)
    setWelcomeCanRegenerate(status.eligibility.canRegenerate)
    setWelcomeLastSent(status.lastSentAt)
    showToast('success', 'Parent portal account created.')
    // Same reasoning as handleGenerateCredentials — keep this dialog open.
    onCredentialsRefreshed?.()
  }

  function handleEnrollmentWizardSuccess() {
    setWizardOpen(false)
    getStudentAttendanceSummaryAction(s.student_id).then(d => setAttSummary(d)).catch(() => {})
    getStudentAttendanceHistoryAction(s.student_id).then(h => setHistory(h)).catch(() => {})
    setTimelineDirty(true)
    router.refresh()
    onStudentUpdated?.()
  }


  const waUrl  = buildWhatsAppUrl(s.parent_phone, s.phone)
  const telUrl = buildTelUrl(s.parent_phone, s.phone)
  const stuTel = buildTelUrl(null, s.phone)

  const riskCls = s.risk_level === 'HIGH'   ? 'bg-[#FEE2E2] text-[#DC2626]'
                : s.risk_level === 'MEDIUM' ? 'bg-[#FFFBEB] text-[#B45309]'
                :                             'bg-[#E7F8EE] text-[#15803D]'

  const anyOverlayOpen = wizardOpen || parentModalOpen

  return (
    <>
      {/* Toast — success/error feedback that never closes the dialog */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-medium shadow-lg ${
          toast.type === 'success'
            ? 'border-[#A7F3D0] bg-[#E7F8EE] text-[#15803D]'
            : 'border-[#FECACA] bg-[#FEE2E2] text-[#DC2626]'
        }`}>
          {toast.type === 'success' ? (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
          )}
          {toast.msg}
        </div>
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]"
        onClick={() => { if (!anyOverlayOpen) onClose() }}
      />

      {/* Modal panel */}
      <div
        className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center p-0 sm:p-4"
        onClick={() => { if (!anyOverlayOpen) onClose() }}
      >
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
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {waUrl  && <WaButton  url={waUrl}  label={s.parent_phone ? 'WhatsApp Parent' : 'WhatsApp'} />}
              {telUrl && <CallButton url={telUrl} label={s.parent_phone ? 'Call Parent'    : 'Call'} />}
              {s.parent_phone && stuTel && <CallButton url={stuTel} label="Call Student" />}
              {canSendWelcome && (
                <WelcomeMessageButton
                  disabled={!welcomeEligible}
                  tooltip={welcomeTooltip}
                  sending={welcomeSending}
                  onClick={handleSendWelcomeMessage}
                />
              )}
              {canSendWelcome && !welcomeEligible && welcomeCanRegenerate && (
                <GenerateCredentialsButton
                  generating={welcomeRegenerating}
                  onClick={handleGenerateCredentials}
                />
              )}
              {canSendWelcome && !welcomeEligible && !welcomeCanRegenerate
                && welcomeTooltip === 'Parent portal account has not been created yet.'
                && s.parent && (
                <CreateParentAccountButton
                  loading={parentModalLoading}
                  onClick={handleOpenParentAccountModal}
                />
              )}
            </div>
            {/* Explicit reason text — never leave the disabled button unexplained */}
            {canSendWelcome && !welcomeEligible && welcomeTooltip && (
              <p className="mt-1.5 text-[10px] font-medium text-[#B45309]">⚠ {welcomeTooltip}</p>
            )}
            {canSendWelcome && welcomeEligible && welcomeLastSent && (
              <p className="mt-1.5 text-[10px] text-[#94A3B8]">Last sent: {fmtDate(welcomeLastSent)}</p>
            )}
          </div>

          {/* ── Tab bar ───────────────────────────────────────────────── */}
          <div className="shrink-0 border-b border-[#E2E8F0] bg-white">
            <div className="flex overflow-x-auto scrollbar-none">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-shrink-0 px-3 py-2.5 text-[11px] font-medium transition border-b-2 whitespace-nowrap ${
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
                parentAuthData={parentAuthData}
                parentAuthLoading={parentAuthLoading}
                attSummary={attSummary}
                attSumLoading={attSumLoading}
              />
            )}
            {activeTab === 'finance' && (
              <FinanceTab
                s={s}
                onCollectPayment={() => onOpenFullFinance?.()}
                onCreateContract={() => setWizardOpen(true)}
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
            {activeTab === 'package-ledger' && (
              <PackageLedgerTab
                ledger={ledger}
                loading={ledgerLoad}
                reconciling={reconciling}
                onRemove={handleRemoveConsumption}
                onReconcile={handleReconcile}
              />
            )}
            {activeTab === 'history' && (
              <HistoryTab
                timeline={timeline}
                loading={timelineLoad}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Enrollment Wizard (z-[80]) ─────────────────────────────── */}
      {wizardOpen && (
        <EnrollmentWizard
          branchIds={[group.branch_id]}
          preselectedStudent={buildWizardStudent(s, group)}
          onClose={() => setWizardOpen(false)}
          onSuccess={handleEnrollmentWizardSuccess}
          overlayClassName="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-8"
        />
      )}

      {/* ── Create Parent Account (reuses the Parents page form, z-[75/76]) ── */}
      {parentModalOpen && parentEditData && (
        <ParentFormModal
          mode="edit"
          parent={parentEditData.parent}
          studentOptions={parentEditData.studentOptions}
          onClose={() => setParentModalOpen(false)}
          onSuccess={handleParentAccountCreated}
          nested
        />
      )}
    </>
  )
}
