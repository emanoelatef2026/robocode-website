'use client'

import { useEffect, useState } from 'react'
import type { StudentOperationalRow } from '@/modules/students/operational'
import { getStudentGroupHistory, type GroupHistoryEntry } from '@/modules/students/group-history'

interface Props {
  student:  StudentOperationalRow
  isTL:     boolean
  onClose:  () => void
  onEdit?:  () => void
  onAssign?: () => void
}

type Tab = 'overview' | 'groups' | 'attendance' | 'guardians'

const OP_STATUS_CONFIG: Record<string, { label: string; color: string; text: string }> = {
  ACTIVE:           { label: 'Active',          color: 'bg-emerald-100', text: 'text-emerald-700' },
  NO_GROUP:         { label: 'No Group',        color: 'bg-slate-100',   text: 'text-slate-600'   },
  INACTIVE:         { label: 'Inactive',        color: 'bg-red-100',     text: 'text-red-600'     },
  LOW_ATTENDANCE:   { label: 'Low Attendance',  color: 'bg-amber-100',   text: 'text-amber-700'   },
  NEAR_EXHAUSTION:  { label: 'Near Exhaustion', color: 'bg-orange-100',  text: 'text-orange-700'  },
  MULTI_CONTRACT:   { label: 'Multi-Contract',  color: 'bg-blue-100',    text: 'text-blue-700'    },
  NEW_STUDENT:      { label: 'New',             color: 'bg-purple-100',  text: 'text-purple-700'  },
}

export default function StudentDetailDrawer({ student: s, isTL, onClose, onEdit, onAssign }: Props) {
  const [tab, setTab] = useState<Tab>('overview')

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const opCfg   = OP_STATUS_CONFIG[s.op_status] ?? OP_STATUS_CONFIG.ACTIVE
  const riskClr = s.risk_level === 'HIGH' ? 'bg-red-100 text-red-600' : s.risk_level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[#0B1F3A] truncate">{s.student_name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {s.student_code && (
                <span className="font-mono text-[10px] text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded">
                  #{s.student_code}
                </span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${opCfg.color} ${opCfg.text}`}>
                {opCfg.label}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${riskClr}`}>
                {s.risk_level} Risk
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9]"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Quick actions */}
        {isTL && (
          <div className="flex gap-2 border-b border-[#E2E8F0] px-5 py-3">
            {onEdit && (
              <button onClick={onEdit}
                className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]">
                Edit Student
              </button>
            )}
            {onAssign && (
              <button onClick={onAssign}
                className="flex-1 rounded-lg bg-[#FF8A1F] py-2 text-sm font-medium text-white hover:bg-[#e87c18]">
                Assign Group
              </button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-[#E2E8F0]">
          {(['overview', 'groups', 'attendance', 'guardians'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium capitalize transition
                ${tab === t
                  ? 'border-b-2 border-[#FF8A1F] text-[#FF8A1F]'
                  : 'text-[#64748B] hover:text-[#0B1F3A]'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === 'overview' && <OverviewTab s={s} />}
          {tab === 'groups'   && <GroupsTab   s={s} />}
          {tab === 'attendance' && <AttendanceTab s={s} />}
          {tab === 'guardians' && <GuardiansTab s={s} />}
        </div>
      </div>
    </>
  )
}

// ── Tab: Overview ──────────────────────────────────────────────────────────────

function OverviewTab({ s }: { s: StudentOperationalRow }) {
  return (
    <>
      <section className="rounded-xl border border-[#E2E8F0] p-4 space-y-2.5">
        <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Identity</h3>
        <Row label="Student Phone">{s.student_phone ? <a href={`tel:${s.student_phone}`} className="text-[#0B1F3A] hover:text-[#FF8A1F]">{s.student_phone}</a> : '—'}</Row>
        <Row label="Age">{s.age !== null ? `${s.age} years` : '—'}</Row>
        {s.date_of_birth && (
          <Row label="Date of Birth">
            {new Date(s.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Row>
        )}
        <Row label="Branch">{s.branch_name}</Row>
        <Row label="Grade">{s.school_grade ?? '—'}</Row>
        <Row label="Enrolled">{new Date(s.enrollment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Row>
        <Row label="Status"><span className="capitalize">{s.student_status}</span></Row>
      </section>

      <section className="rounded-xl border border-[#E2E8F0] p-4 space-y-2.5">
        <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Current Group</h3>
        {s.group_name ? (
          <>
            <Row label="Group">{s.group_name}</Row>
            {s.course_name    && <Row label="Course">{s.course_name}</Row>}
            {s.instructor_name && <Row label="Instructor">{s.instructor_name}</Row>}
          </>
        ) : (
          <p className="text-sm text-[#94A3B8]">Not assigned to any group</p>
        )}
      </section>

      <section className="rounded-xl border border-[#E2E8F0] p-4">
        <h3 className="mb-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Metrics</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-[#F8FAFC] px-2 py-3">
            <p className={`text-base font-bold ${s.attendance_pct >= 80 ? 'text-emerald-600' : s.attendance_pct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
              {s.attendance_pct}%
            </p>
            <p className="text-[11px] text-[#94A3B8]">Attendance</p>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] px-2 py-3">
            <p className={`text-base font-bold ${s.enrolled_sessions > 0 && s.remaining_sessions <= 2 ? 'text-red-600' : 'text-[#0B1F3A]'}`}>
              {s.enrolled_sessions > 0 ? `${s.remaining_sessions}/${s.enrolled_sessions}` : '—'}
            </p>
            <p className="text-[11px] text-[#94A3B8]">Sessions</p>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] px-2 py-3">
            <p className="text-base font-bold text-[#0B1F3A]">{s.consecutive_absences}</p>
            <p className="text-[11px] text-[#94A3B8]">Consec. Absent</p>
          </div>
        </div>
      </section>

      {/* Risk flags */}
      {s.risk_flags.length > 0 && (
        <section className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <h3 className="mb-2 text-xs font-semibold text-amber-700 uppercase tracking-wide">Risk Flags</h3>
          <div className="flex flex-wrap gap-1.5">
            {s.risk_flags.map(f => (
              <span key={f} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                {f.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Multi-contract alert */}
      {s.active_enrollment_count > 1 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-xs font-semibold text-blue-700">{s.active_enrollment_count} active contracts</p>
          <p className="text-[11px] text-blue-600 mt-0.5">This student has multiple simultaneous enrollments.</p>
        </div>
      )}
    </>
  )
}

// ── Tab: Groups ────────────────────────────────────────────────────────────────

function GroupsTab({ s }: { s: StudentOperationalRow }) {
  const [history, setHistory] = useState<GroupHistoryEntry[] | null>(null)

  useEffect(() => {
    getStudentGroupHistory(s.student_id).then(setHistory)
  }, [s.student_id])

  const past = history?.filter(h => !h.is_current) ?? []

  return (
    <section className="space-y-3">
      {/* Current group */}
      {s.group_name ? (
        <div className="rounded-xl border border-[#E2E8F0] p-4 space-y-2.5">
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-semibold text-[#0B1F3A]">{s.group_name}</h3>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">CURRENT</span>
          </div>
          {s.course_name     && <Row label="Course">{s.course_name}</Row>}
          {s.instructor_name && <Row label="Instructor">{s.instructor_name}</Row>}
          <div className="pt-1 border-t border-[#E2E8F0]">
            <p className="text-xs font-medium text-[#64748B]">Contract Sessions</p>
            <p className="mt-1 text-sm font-bold text-[#0B1F3A]">
              {s.enrolled_sessions > 0
                ? `${s.remaining_sessions} remaining / ${s.enrolled_sessions} enrolled`
                : 'Unlimited'}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-center">
          <p className="text-sm font-medium text-amber-700">Not assigned to any group</p>
          <p className="mt-1 text-xs text-amber-600">Use the Assign Group button to enroll this student.</p>
        </div>
      )}

      {/* Group history */}
      {history === null ? (
        <p className="text-center text-xs text-[#94A3B8] py-2">Loading history…</p>
      ) : past.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Previous Groups</h3>
          {past.map((h, i) => (
            <div key={`${h.group_id}-${i}`} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-1.5">
              <div className="flex items-start justify-between">
                <p className="text-[13px] font-semibold text-[#0B1F3A]">{h.group_name}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">PAST</span>
              </div>
              {h.course_name     && <p className="text-[11px] text-[#64748B]">Course: {h.course_name}</p>}
              {h.instructor_name && <p className="text-[11px] text-[#64748B]">Instructor: {h.instructor_name}</p>}
              <div className="flex items-center gap-3 text-[10px] text-[#94A3B8]">
                {h.joined_at && (
                  <span>Joined {new Date(h.joined_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                )}
                {h.left_at && (
                  <span>Left {new Date(h.left_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : s.group_name ? (
        <p className="text-center text-xs text-[#94A3B8] py-1">No previous group history.</p>
      ) : null}
    </section>
  )
}

// ── Tab: Attendance ────────────────────────────────────────────────────────────

function AttendanceTab({ s }: { s: StudentOperationalRow }) {
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-center">
          <p className={`text-2xl font-bold ${s.attendance_pct >= 80 ? 'text-emerald-600' : s.attendance_pct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
            {s.attendance_pct}%
          </p>
          <p className="text-xs text-[#94A3B8]">Attendance Rate</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-center">
          <p className="text-2xl font-bold text-[#0B1F3A]">{s.sessions_attended}/{s.total_sessions}</p>
          <p className="text-xs text-[#94A3B8]">Sessions Attended</p>
        </div>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] p-4 space-y-2">
        <Row label="Consecutive Absences">
          <span className={s.consecutive_absences >= 3 ? 'font-semibold text-red-600' : 'text-[#0B1F3A]'}>
            {s.consecutive_absences}
          </span>
        </Row>
        <Row label="Last Attendance">
          {s.last_attendance_date
            ? new Date(s.last_attendance_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—'}
        </Row>
      </div>

      {/* Attendance bar */}
      <div className="rounded-xl border border-[#E2E8F0] p-4">
        <p className="mb-2 text-xs font-medium text-[#64748B]">Attendance Health</p>
        <div className="h-3 rounded-full bg-[#E2E8F0] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${s.attendance_pct >= 80 ? 'bg-emerald-400' : s.attendance_pct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
            style={{ width: `${Math.min(s.attendance_pct, 100)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-[#94A3B8]">
          <span>0%</span>
          <span className="text-[#FF8A1F]">60% threshold</span>
          <span>100%</span>
        </div>
      </div>
    </section>
  )
}

// ── Tab: Guardians ─────────────────────────────────────────────────────────────

function GuardiansTab({ s }: { s: StudentOperationalRow }) {
  if (!s.guardians.length) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] px-4 py-8 text-center">
        <p className="text-sm font-medium text-[#0B1F3A]">No guardians recorded</p>
        <p className="mt-1 text-xs text-[#94A3B8]">Edit the student to add guardian contacts.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {s.guardians.map((g, i) => (
        <div key={g.id || i} className="rounded-xl border border-[#E2E8F0] p-4 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-[#0B1F3A]">{g.name}</p>
              <p className="text-[11px] text-[#94A3B8] capitalize">{g.relation}</p>
            </div>
            <div className="flex gap-1">
              {g.is_primary   && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Primary</span>}
              {g.is_emergency && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">Emergency</span>}
            </div>
          </div>
          <div className="space-y-1.5">
            {g.phone1 && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#94A3B8]">Phone 1</span>
                <div className="flex items-center gap-2">
                  <a href={`tel:${g.phone1}`} className="text-[12px] text-[#0B1F3A] hover:text-[#FF8A1F]">{g.phone1}</a>
                  {g.whatsapp_preferred && (
                    <a
                      href={`https://wa.me/${g.phone1.replace(/\D/g,'')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#25D366] border border-[#25D366]/30 rounded px-1.5 py-0.5"
                    >
                      WA
                    </a>
                  )}
                </div>
              </div>
            )}
            {g.phone2 && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#94A3B8]">Phone 2</span>
                <a href={`tel:${g.phone2}`} className="text-[12px] text-[#0B1F3A] hover:text-[#FF8A1F]">{g.phone2}</a>
              </div>
            )}
          </div>
        </div>
      ))}
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
