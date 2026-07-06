'use client'

import { useEffect, useState, useTransition } from 'react'
import type { ParentOperationalRow, LinkedChild } from '@/modules/parents/operational'
import { resetParentPassword } from '@/modules/parents/modal-actions'
import { buildWhatsAppUrl } from '@/lib/contact-utils'

interface Props {
  parent:  ParentOperationalRow
  isTL:    boolean
  onClose: () => void
  onEdit?: () => void
}

type Tab = 'overview' | 'children' | 'contracts' | 'attendance' | 'communication' | 'account'

const HEALTH_CONFIG: Record<string, { label: string; color: string; text: string }> = {
  HEALTHY:         { label: 'Active',       color: 'bg-[#E7F8EE]', text: 'text-[#15803D]' },
  AT_RISK:         { label: 'At Risk',      color: 'bg-[#FEE2E2]',     text: 'text-[#EF4444]'     },
  NEEDS_ATTENTION: { label: 'Needs Action', color: 'bg-[#FFFBEB]',   text: 'text-[#B45309]'   },
  NO_ENROLLMENTS:  { label: 'No Enrollment',color: 'bg-orange-100',  text: 'text-orange-700'  },
  GRADUATED:       { label: 'Graduated',    color: 'bg-[#EFF6FF]',    text: 'text-[#1D4ED8]'    },
  INACTIVE:        { label: 'Inactive',     color: 'bg-[#F1F5F9]',   text: 'text-[#64748B]'   },
  ARCHIVED:        { label: 'Archived',     color: 'bg-[#F1F5F9]',   text: 'text-[#94A3B8]'   },
  NO_CHILDREN:     { label: 'No Children',  color: 'bg-[#F1F5F9]',   text: 'text-[#64748B]'   },
}

const RISK_CLR: Record<string, string> = {
  HIGH:   'bg-[#FEE2E2] text-[#EF4444]',
  MEDIUM: 'bg-[#FFFBEB] text-[#B45309]',
  LOW:    'bg-[#E7F8EE] text-[#15803D]',
}

export default function ParentDetailDrawer({ parent: p, isTL, onClose, onEdit }: Props) {
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const hCfg = HEALTH_CONFIG[p.op_health] ?? HEALTH_CONFIG.HEALTHY

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[#0B1F3A] truncate">{p.parent_name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {p.email && <span className="text-[11px] text-[#94A3B8]">{p.email}</span>}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${hCfg.color} ${hCfg.text}`}>
                {hCfg.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="ml-3 shrink-0 rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9]">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Quick actions */}
        {isTL && onEdit && (
          <div className="border-b border-[#E2E8F0] px-5 py-3">
            <button
              onClick={onEdit}
              className="w-full rounded-lg border border-[#E2E8F0] py-2 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]"
            >
              Edit Parent
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-[#E2E8F0] shrink-0">
          {([
            'overview', 'children', 'contracts', 'attendance', 'communication',
            ...(isTL && !!p.user_id ? ['account'] : []),
          ] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 px-3 py-2.5 text-xs font-medium capitalize transition whitespace-nowrap
                ${tab === t
                  ? 'border-b-2 border-[#FF8A1F] text-[#FF8A1F]'
                  : 'text-[#64748B] hover:text-[#0B1F3A]'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === 'overview'       && <OverviewTab p={p} hCfg={hCfg} />}
          {tab === 'children'       && <ChildrenTab p={p} />}
          {tab === 'contracts'      && <ContractsTab p={p} />}
          {tab === 'attendance'     && <AttendanceTab p={p} />}
          {tab === 'communication'  && <CommunicationTab p={p} />}
          {tab === 'account' && isTL && <AccountTab p={p} />}
        </div>
      </div>
    </>
  )
}

// ── Tab: Overview ──────────────────────────────────────────────────────────────

function OverviewTab({ p, hCfg }: { p: ParentOperationalRow; hCfg: { label: string; color: string; text: string } }) {
  return (
    <>
      <section className="rounded-xl border border-[#E2E8F0] p-4 space-y-2.5">
        <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Contact</h3>
        <Row label="Phone">
          {p.phone ? (
            <div className="flex items-center gap-2">
              <a href={`tel:${p.phone}`} className="text-[#0B1F3A] hover:text-[#FF8A1F]">{p.phone}</a>
              <a href={buildWhatsAppUrl(p.phone, null) ?? '#'} target="_blank" rel="noopener noreferrer"
                className="rounded border border-[#25D366]/30 px-1.5 py-0.5 text-[10px] font-medium text-[#25D366]">
                WA
              </a>
            </div>
          ) : '—'}
        </Row>
        <Row label="Email">{p.email || '—'}</Row>
      </section>

      <section className="rounded-xl border border-[#E2E8F0] p-4">
        <h3 className="mb-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Operational Summary</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-[#F8FAFC] px-2 py-3">
            <p className="text-base font-bold text-[#0B1F3A]">{p.children_count}</p>
            <p className="text-[11px] text-[#94A3B8]">Children</p>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] px-2 py-3">
            <p className={`text-base font-bold ${p.near_exhaustion_children_count > 0 ? 'text-[#F59E0B]' : 'text-[#0B1F3A]'}`}>
              {p.total_sessions_remaining}
            </p>
            <p className="text-[11px] text-[#94A3B8]">Sessions Left</p>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] px-2 py-3">
            <p className={`text-base font-bold ${p.attendance_risk_children_count > 0 ? 'text-[#EF4444]' : 'text-[#0B1F3A]'}`}>
              {p.attendance_risk_children_count}
            </p>
            <p className="text-[11px] text-[#94A3B8]">At-Risk Kids</p>
          </div>
        </div>
      </section>

      {/* Badges */}
      {(p.children_count > 1 || p.attendance_risk_children_count > 0 || p.near_exhaustion_children_count > 0) && (
        <section className="rounded-xl border border-amber-100 bg-[#FFFBEB] p-4">
          <h3 className="mb-2 text-xs font-semibold text-[#B45309] uppercase tracking-wide">Flags</h3>
          <div className="flex flex-wrap gap-1.5">
            {p.children_count > 1 && (
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                Multi-Child Family
              </span>
            )}
            {p.attendance_risk_children_count > 0 && (
              <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-bold text-[#EF4444]">
                {p.attendance_risk_children_count} child{p.attendance_risk_children_count > 1 ? 'ren' : ''} at attendance risk
              </span>
            )}
            {p.near_exhaustion_children_count > 0 && (
              <span className="rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-bold text-[#B45309]">
                {p.near_exhaustion_children_count} child{p.near_exhaustion_children_count > 1 ? 'ren' : ''} near session end
              </span>
            )}
          </div>
        </section>
      )}

      {p.last_attendance_at && (
        <p className="text-center text-[11px] text-[#94A3B8]">
          Last family attendance: {new Date(p.last_attendance_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </>
  )
}

// ── Tab: Children ──────────────────────────────────────────────────────────────

const RISK_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

function ChildrenTab({ p }: { p: ParentOperationalRow }) {
  if (!p.children.length) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] px-4 py-8 text-center">
        <p className="text-sm font-medium text-[#0B1F3A]">No children linked</p>
        <p className="mt-1 text-xs text-[#94A3B8]">Edit the parent to link students.</p>
      </div>
    )
  }

  // Active first, then by risk level (HIGH → MEDIUM → LOW)
  const sorted = [...p.children].sort((a, b) => {
    const aActive = a.student_status === 'active' ? 0 : 1
    const bActive = b.student_status === 'active' ? 0 : 1
    if (aActive !== bActive) return aActive - bActive
    return (RISK_ORDER[a.risk_level] ?? 2) - (RISK_ORDER[b.risk_level] ?? 2)
  })

  const activeCount   = sorted.filter(c => c.student_status === 'active').length
  const inactiveCount = sorted.length - activeCount

  return (
    <div className="space-y-3">
      {activeCount > 0 && inactiveCount > 0 && (
        <p className="text-[11px] font-medium text-[#64748B]">
          {activeCount} active · {inactiveCount} inactive
        </p>
      )}
      {sorted.map(c => <ChildCard key={c.student_id} c={c} />)}
    </div>
  )
}

function ChildCard({ c }: { c: LinkedChild }) {
  const isInactive = c.student_status !== 'active'
  return (
    <div className={`rounded-xl border p-4 space-y-2.5 ${isInactive ? 'border-slate-200 bg-[#F8FAFC]/60' : 'border-[#E2E8F0]'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#0B1F3A]">{c.student_name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {c.student_code && <span className="font-mono text-[10px] text-[#94A3B8]">#{c.student_code}</span>}
            {c.age !== null && <span className="text-[10px] text-[#94A3B8]">Age {c.age}</span>}
            <span className="text-[10px] text-[#94A3B8] capitalize">{c.relationship}</span>
            {/* Status chip */}
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${isInactive ? 'bg-[#F1F5F9] text-[#64748B]' : 'bg-[#E7F8EE] text-[#15803D]'}`}>
              {isInactive ? 'INACTIVE' : 'ACTIVE'}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${RISK_CLR[c.risk_level]}`}>
            {c.risk_level}
          </span>
          {c.is_primary && (
            <span className="rounded-full bg-[#FF8A1F]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#FF8A1F]">
              PRIMARY
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
        <div className="rounded-lg bg-[#F8FAFC] px-2 py-2">
          <p className={`font-bold ${c.attendance_pct >= 80 ? 'text-[#10B981]' : c.attendance_pct >= 60 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
            {c.attendance_pct}%
          </p>
          <p className="text-[#94A3B8]">Attend.</p>
        </div>
        <div className="rounded-lg bg-[#F8FAFC] px-2 py-2">
          <p className={`font-bold ${c.enrolled_sessions > 0 && c.remaining_sessions <= 2 ? 'text-[#EF4444]' : 'text-[#0B1F3A]'}`}>
            {c.enrolled_sessions > 0 ? `${c.remaining_sessions}/${c.enrolled_sessions}` : '—'}
          </p>
          <p className="text-[#94A3B8]">Sessions</p>
        </div>
        <div className="rounded-lg bg-[#F8FAFC] px-2 py-2">
          <p className={`font-bold ${c.consecutive_absences >= 3 ? 'text-[#EF4444]' : c.consecutive_absences >= 2 ? 'text-[#F59E0B]' : 'text-[#0B1F3A]'}`}>
            {c.consecutive_absences}
          </p>
          <p className="text-[#94A3B8]">Absences</p>
        </div>
      </div>

      {/* Last attendance */}
      {c.last_attendance_date && (
        <p className="text-[10px] text-[#94A3B8]">
          Last attended: {new Date(c.last_attendance_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}

      {(c.group_name || c.course_name || c.instructor_name) && (
        <div className="space-y-1 border-t border-[#E2E8F0] pt-2">
          {c.group_name    && <Row label="Group">{c.group_name}</Row>}
          {c.course_name   && <Row label="Course">{c.course_name}</Row>}
          {c.instructor_name && <Row label="Instructor">{c.instructor_name}</Row>}
          <Row label="Branch">{c.branch_name}</Row>
        </div>
      )}
    </div>
  )
}

// ── Tab: Contracts ─────────────────────────────────────────────────────────────

function ContractsTab({ p }: { p: ParentOperationalRow }) {
  const active = p.children.filter(c => c.enrolled_sessions > 0)

  if (!active.length) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] px-4 py-8 text-center">
        <p className="text-sm font-medium text-[#0B1F3A]">No active contracts</p>
        <p className="mt-1 text-xs text-[#94A3B8]">No children have active session enrollments.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {active.map(c => (
        <div key={c.student_id} className="rounded-xl border border-[#E2E8F0] p-4 space-y-2.5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-[#0B1F3A]">{c.student_name}</p>
              {c.course_name && <p className="text-[11px] text-[#64748B]">{c.course_name}</p>}
            </div>
            {c.remaining_sessions <= 2 && (
              <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-bold text-[#EF4444]">
                NEAR END
              </span>
            )}
          </div>

          {(c.group_name || c.instructor_name) && (
            <div className="space-y-1">
              {c.group_name      && <Row label="Group">{c.group_name}</Row>}
              {c.instructor_name && <Row label="Instructor">{c.instructor_name}</Row>}
            </div>
          )}

          {/* Sessions progress */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-[#64748B]">Sessions Used</span>
              <span className="text-[11px] font-bold text-[#0B1F3A]">
                {c.consumed_sessions}/{c.enrolled_sessions}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
              <div
                className={`h-full rounded-full ${c.remaining_sessions <= 2 ? 'bg-[#EF4444]' : c.remaining_sessions <= 5 ? 'bg-[#F59E0B]' : 'bg-[#10B981]'}`}
                style={{ width: `${Math.min((c.consumed_sessions / Math.max(c.enrolled_sessions, 1)) * 100, 100)}%` }}
              />
            </div>
            <p className={`mt-1 text-[11px] font-medium ${c.remaining_sessions <= 2 ? 'text-[#EF4444]' : c.remaining_sessions <= 5 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
              {c.remaining_sessions} session{c.remaining_sessions !== 1 ? 's' : ''} remaining
            </p>
          </div>

          {/* Attendance in contract context */}
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 rounded-full bg-[#E2E8F0] overflow-hidden">
              <div
                className={`h-full rounded-full ${c.attendance_pct >= 80 ? 'bg-[#10B981]' : c.attendance_pct >= 60 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`}
                style={{ width: `${Math.min(c.attendance_pct, 100)}%` }}
              />
            </div>
            <span className="text-[11px] text-[#64748B]">{c.attendance_pct}% attendance</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab: Attendance ────────────────────────────────────────────────────────────

function AttendanceTab({ p }: { p: ParentOperationalRow }) {
  if (!p.children.length) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] px-4 py-8 text-center">
        <p className="text-sm text-[#94A3B8]">No children to display attendance for.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {p.children.map(c => (
        <div key={c.student_id} className="rounded-xl border border-[#E2E8F0] p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#0B1F3A]">{c.student_name}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${RISK_CLR[c.risk_level]}`}>
              {c.risk_level}
            </span>
          </div>

          {/* Attendance bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-[#64748B]">Attendance Rate</span>
              <span className={`text-[12px] font-bold ${c.attendance_pct >= 80 ? 'text-[#10B981]' : c.attendance_pct >= 60 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
                {c.attendance_pct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
              <div
                className={`h-full rounded-full ${c.attendance_pct >= 80 ? 'bg-[#10B981]' : c.attendance_pct >= 60 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`}
                style={{ width: `${Math.min(c.attendance_pct, 100)}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Row label="Sessions Attended">{c.sessions_attended}/{c.total_sessions}</Row>
            <Row label="Consecutive Absences">
              <span className={c.consecutive_absences >= 3 ? 'font-bold text-[#EF4444]' : 'text-[#0B1F3A]'}>
                {c.consecutive_absences}
              </span>
            </Row>
            {c.last_attendance_date && (
              <Row label="Last Attended">
                {new Date(c.last_attendance_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Row>
            )}
            {c.group_name && <Row label="Group">{c.group_name}</Row>}
          </div>

          {/* Trend label */}
          {c.consecutive_absences >= 3 ? (
            <div className="rounded-lg border border-[#FEE2E2] bg-[#FEE2E2] px-3 py-2">
              <p className="text-[11px] font-semibold text-[#DC2626]">Warning: {c.consecutive_absences} consecutive absences</p>
              <p className="text-[10px] text-[#EF4444] mt-0.5">Immediate follow-up recommended.</p>
            </div>
          ) : c.consecutive_absences >= 2 ? (
            <div className="rounded-lg border border-amber-100 bg-[#FFFBEB] px-3 py-2">
              <p className="text-[11px] font-semibold text-[#B45309]">{c.consecutive_absences} consecutive absences — monitor closely</p>
            </div>
          ) : c.student_status !== 'active' ? (
            <div className="rounded-lg border border-slate-100 bg-[#F8FAFC] px-3 py-2">
              <p className="text-[11px] text-[#64748B]">Student is inactive</p>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

// ── Tab: Communication ─────────────────────────────────────────────────────────

function CommunicationTab({ p }: { p: ParentOperationalRow }) {
  const firstName = p.first_name || p.parent_name.split(' ')[0] || 'there'

  // Build contextual templates based on at-risk children
  const atRiskChild = p.children.find(c => c.risk_level === 'HIGH')
  const nearEndChild = p.children.find(c => c.enrolled_sessions > 0 && c.remaining_sessions <= 2)

  const templates: { label: string; msg: string }[] = [
    {
      label: 'General Follow-up',
      msg: `Hello ${firstName}, this is Robocode. We wanted to check in regarding your child's progress. Please let us know if you have any questions.`,
    },
    ...(atRiskChild ? [{
      label: 'Attendance Alert',
      msg: `Hello ${firstName}, we noticed ${atRiskChild.student_name} has had ${atRiskChild.consecutive_absences} consecutive absences. We hope everything is okay — please reach out so we can help.`,
    }] : []),
    ...(nearEndChild ? [{
      label: 'Sessions Running Low',
      msg: `Hello ${firstName}, ${nearEndChild.student_name} has only ${nearEndChild.remaining_sessions} session${nearEndChild.remaining_sessions !== 1 ? 's' : ''} remaining. Please contact us to renew before sessions run out.`,
    }] : []),
  ]

  return (
    <div className="space-y-4">
      {/* Quick contact */}
      <section className="rounded-xl border border-[#E2E8F0] p-4 space-y-3">
        <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Quick Contact</h3>
        {p.phone ? (
          <div className="flex gap-2">
            <a
              href={buildWhatsAppUrl(p.phone, null) ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 bg-[#25D366]/5 py-2.5 text-sm font-medium text-[#25D366] hover:bg-[#25D366]/10"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.522 5.851L.057 23.882l6.186-1.623A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.888 0-3.648-.523-5.15-1.433l-.369-.22-3.671.963.981-3.585-.243-.376A9.945 9.945 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              </svg>
              WhatsApp
            </a>
            <a
              href={`tel:${p.phone}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] py-2.5 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 7V5z" />
              </svg>
              Call
            </a>
          </div>
        ) : (
          <p className="text-[12px] text-[#F87171]">No phone number on file</p>
        )}
      </section>

      {/* WA templates */}
      {p.phone && templates.length > 0 && (
        <section className="rounded-xl border border-[#E2E8F0] p-4 space-y-2">
          <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Message Templates</h3>
          {templates.map(t => (
            <a
              key={t.label}
              href={`${buildWhatsAppUrl(p.phone, null)}?text=${encodeURIComponent(t.msg)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full rounded-xl border border-[#25D366]/30 bg-[#25D366]/5 px-3 py-2.5 hover:bg-[#25D366]/10"
            >
              <span className="text-[12px] font-medium text-[#25D366]">{t.label}</span>
              <svg className="h-3.5 w-3.5 text-[#25D366] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </a>
          ))}
        </section>
      )}

      {/* Per-child summary */}
      {p.children.length > 0 && (
        <section className="rounded-xl border border-[#E2E8F0] p-4 space-y-3">
          <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">
            Children ({p.children.length})
          </h3>
          <div className="space-y-3">
            {p.children.map(c => (
              <div key={c.student_id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium text-[#0B1F3A]">{c.student_name}</p>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${RISK_CLR[c.risk_level]}`}>
                    {c.risk_level}
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B] space-y-0.5">
                  {c.group_name      && <p>Group: {c.group_name}</p>}
                  {c.instructor_name && <p>Instructor: {c.instructor_name}</p>}
                  {c.course_name     && <p>Course: {c.course_name}</p>}
                  <p className="capitalize">{c.relationship} · {c.student_status}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Email */}
      {p.email && (
        <a
          href={`mailto:${p.email}`}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] py-2.5 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Email Parent
        </a>
      )}
    </div>
  )
}

// ── Tab: Account ───────────────────────────────────────────────────────────────

function AccountTab({ p }: { p: ParentOperationalRow }) {
  const [copied,        setCopied]        = useState(false)
  const [confirmReset,  setConfirmReset]  = useState(false)
  const [isPending,     startTransition]  = useTransition()
  const [resetResult,   setResetResult]   = useState<{ temp_password: string } | null>(null)
  const [resetError,    setResetError]    = useState<string | null>(null)

  function copyEmail() {
    if (!p.email) return
    navigator.clipboard.writeText(p.email)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleReset() {
    setResetError(null)
    setResetResult(null)
    startTransition(async () => {
      const result = await resetParentPassword(p.parent_id)
      if (result.success) {
        setResetResult(result.data)
        setConfirmReset(false)
      } else {
        setResetError(result.error.message)
        setConfirmReset(false)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Login email */}
      <section className="rounded-xl border border-[#E2E8F0] p-4 space-y-3">
        <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Login Account</h3>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-[#94A3B8]">Email</p>
            <p className="text-sm font-medium text-[#0B1F3A] truncate">{p.email || '—'}</p>
          </div>
          {p.email && (
            <button
              onClick={copyEmail}
              className="shrink-0 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[11px] font-medium text-[#64748B] hover:border-[#CBD5E1] transition"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      </section>

      {/* Password reset */}
      <section className="rounded-xl border border-[#E2E8F0] p-4 space-y-3">
        <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Password Reset</h3>
        <p className="text-[12px] text-[#94A3B8]">
          Generate a temporary password. Share it with the parent securely — they should change it after first login.
        </p>

        {resetResult && (
          <div className="rounded-xl border border-[#A7F3D0] bg-[#E7F8EE] p-3 space-y-1.5">
            <p className="text-[12px] font-semibold text-[#15803D]">Password reset successfully</p>
            <p className="text-[11px] text-[#10B981]">Temporary password:</p>
            <div className="flex items-center gap-2">
              <p className="flex-1 font-mono text-sm font-bold text-[#0B1F3A] bg-white rounded-lg px-3 py-1.5 border border-[#A7F3D0] tracking-wider">
                {resetResult.temp_password}
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(resetResult.temp_password)}
                className="shrink-0 rounded-lg border border-[#A7F3D0] px-2 py-1.5 text-[11px] font-medium text-[#15803D] hover:bg-[#E7F8EE]"
              >
                Copy
              </button>
            </div>
            <p className="text-[10px] text-[#10B981]">Advise parent to change this after logging in.</p>
          </div>
        )}

        {resetError && (
          <div className="rounded-xl border border-[#FECACA] bg-[#FEE2E2] px-3 py-2 text-[12px] text-[#DC2626]">
            {resetError}
          </div>
        )}

        {!confirmReset ? (
          <button
            onClick={() => { setResetResult(null); setResetError(null); setConfirmReset(true) }}
            className="w-full rounded-xl border border-[#FDE68A] bg-[#FFFBEB] py-2.5 text-sm font-medium text-[#B45309] hover:bg-[#FFFBEB] transition"
          >
            Reset Password
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-[12px] font-medium text-[#0B1F3A]">
              Generate a new temporary password for <span className="font-semibold">{p.parent_name}</span>?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 rounded-xl border border-[#E2E8F0] py-2 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={isPending}
                className="flex-1 rounded-xl bg-[#F59E0B] py-2 text-sm font-semibold text-white hover:bg-[#D97706] disabled:opacity-60 transition"
              >
                {isPending ? 'Resetting…' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <dt className="text-[#94A3B8]">{label}</dt>
      <dd className="text-[#0B1F3A] text-right max-w-[60%] truncate">{children}</dd>
    </div>
  )
}
