'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'
import {
  getGroupDetailDataAction,
  archiveGroupAction,
  addGroupSessionAction,
  editGroupSessionAction,
  deleteGroupSessionAction,
  rebuildGroupAttendanceAction,
} from '@/modules/groups/modal-actions'
import type { GroupDetailData, GroupDetailStudent, GroupDetailSession, SessionAttendanceRecord }
  from '@/modules/groups/modal-actions'
import type { GroupOperationalRow } from '@/modules/groups/operational'

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'students' | 'attendance' | 'performance' | 'schedule'

interface Props {
  group:      GroupOperationalRow | null
  isTL:       boolean
  onClose:    () => void
  onEdit:     (g: GroupOperationalRow) => void
  onArchived: () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const DAYS_FULL: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function estimateTotalSessions(
  startDate: string | null,
  dayOfWeek: string | null,
  endDate:   string | null | undefined,
): number | null {
  if (!startDate || !endDate) return null
  const start = parseLocalDate(startDate)
  const end   = parseLocalDate(endDate)
  if (start >= end) return null
  if (dayOfWeek && DAY_INDEX[dayOfWeek] !== undefined) {
    const target      = DAY_INDEX[dayOfWeek]
    const daysToFirst = (target - start.getDay() + 7) % 7
    const first       = new Date(start.getTime() + daysToFirst * 86_400_000)
    if (first > end) return 0
    return Math.floor((end.getTime() - first.getTime()) / (7 * 86_400_000)) + 1
  }
  return Math.floor((end.getTime() - start.getTime()) / (7 * 86_400_000))
}

function fmt12(time: string | null) {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12  = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function RiskBadge({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const cls = level === 'HIGH' ? 'bg-red-100 text-red-700' : level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{level}</span>
}

function PctBar({ value }: { value: number }) {
  const color = value >= 75 ? 'bg-green-500' : value >= 60 ? 'bg-amber-400' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#E2E8F0]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className={`text-[12px] font-semibold ${value >= 75 ? 'text-green-600' : value >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{value}%</span>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#0B1F3A]">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[#64748B]">{sub}</p>}
    </div>
  )
}

// ── Tab: Overview ──────────────────────────────────────────────────────────────

function OverviewTab({ group }: { group: GroupOperationalRow }) {
  const schedule    = [group.day_of_week ? DAYS_FULL[group.day_of_week] : null, fmt12(group.start_time)]
    .filter(Boolean).join(' · ')
  const elapsed     = group.completed_sessions
  const total       = estimateTotalSessions(group.start_date, group.day_of_week, group.end_date)
  const progressPct = total ? Math.min(100, Math.round((elapsed / total) * 100)) : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Students" value={group.student_count} sub={group.capacity ? `of ${group.capacity} max` : undefined} />
        <StatCard label="Health" value={group.health_score > 0 ? `${group.health_score}%` : '—'} />
        <StatCard label="Status" value={<span className="capitalize">{group.status}</span>} />
        <StatCard
          label="Sessions"
          value={total != null ? `${elapsed} / ${total}` : elapsed > 0 ? `${elapsed} done` : '—'}
          sub={progressPct != null ? `${progressPct}% complete` : undefined}
        />
      </div>

      <div className="space-y-2.5 rounded-xl border border-[#E2E8F0] bg-white p-4">
        <Row label="Branch"      value={group.branch_name} />
        <Row label="Course"      value={group.course_name ?? '—'} />
        <Row
          label="Instructor"
          value={
            group.active_allocation
              ? `${group.active_allocation.instructor_name} (Sessions ${group.active_allocation.from_session}–${group.active_allocation.to_session ?? '∞'})`
              : group.status === 'handoff_pending'
                ? 'Awaiting Instructor Handoff'
                : (group.lead_instructor_name ?? '—')
          }
        />
        <Row label="Schedule"    value={schedule || '—'} />
        {group.duration_minutes && <Row label="Duration" value={`${group.duration_minutes} min`} />}
        <Row label="Start Date"  value={fmtDate(group.start_date)} />
        {group.end_date && <Row label="End Date" value={fmtDate(group.end_date)} />}

        {/* Session progress bar */}
        {progressPct != null && (
          <div className="flex items-start justify-between gap-4">
            <span className="min-w-24 text-[12px] font-medium text-[#64748B]">Progress</span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#E2E8F0]">
                <div
                  className={`h-full rounded-full transition-all ${
                    progressPct >= 100 ? 'bg-red-400' :
                    progressPct >= 70  ? 'bg-amber-400' :
                    progressPct >= 10  ? 'bg-blue-400' : 'bg-[#CBD5E1]'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-[12px] text-[#64748B]">{progressPct}%</span>
            </div>
          </div>
        )}

        {group.meeting_link && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-[#64748B]">Meeting Link</span>
            <a href={group.meeting_link} target="_blank" rel="noopener noreferrer"
               className="text-[12px] text-[#FF8A1F] underline hover:text-[#e87c18]">
              Open →
            </a>
          </div>
        )}
        {group.notes && <Row label="Notes" value={group.notes} />}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="min-w-24 text-[12px] font-medium text-[#64748B]">{label}</span>
      <span className="text-right text-[13px] text-[#0B1F3A]">{value}</span>
    </div>
  )
}

// ── Tab: Students ──────────────────────────────────────────────────────────────

function StudentsTab({ students, loading }: { students: GroupDetailStudent[]; loading: boolean }) {
  if (loading) return <LoadingState />

  if (!students.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#94A3B8]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mb-3 h-10 w-10 opacity-40">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-sm">No students enrolled yet.</p>
      </div>
    )
  }

  const sorted = [...students].sort((a, b) => {
    const ro: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    return (ro[a.risk_level] ?? 3) - (ro[b.risk_level] ?? 3)
  })

  return (
    <div className="divide-y divide-[#F1F5F9]">
      {sorted.map(s => (
        <div key={s.student_id} className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            {/* Line 1: Name */}
            <p className="text-[13px] font-semibold text-[#0B1F3A]">{s.student_name}</p>
            {/* Line 2: Code • Age */}
            <p className="text-[11px] text-[#64748B]">
              {s.student_code ?? '—'}{' • '}{s.age != null ? `${s.age}y` : '—'}
            </p>
            {/* Line 3: Student phone */}
            <p className="font-mono text-[11px] text-[#374151]">{s.phone ?? '—'}</p>
            {/* Line 4: Parent phone */}
            <p className="font-mono text-[11px] text-[#374151]">Parent: {s.parent_phone ?? '—'}</p>
            {/* Line 5: Joined date */}
            <p className="text-[11px] text-[#94A3B8]">Joined {fmtDate(s.joined_at)}</p>
            {/* Line 6: Attendance + sessions */}
            <p className="text-[11px]">
              <span className={s.attendance_pct >= 75 ? 'text-green-600' : s.attendance_pct >= 60 ? 'text-amber-600' : 'text-red-500'}>
                {s.attendance_pct}% att.
              </span>
              <span className="text-[#94A3B8]">{' • '}</span>
              <span className={s.sessions_remaining != null && s.sessions_remaining <= 2 ? 'text-red-500' : 'text-[#64748B]'}>
                {s.sessions_remaining != null ? `${s.sessions_remaining} left` : '—'}
              </span>
            </p>
          </div>
          <div className="shrink-0 pt-0.5">
            <RiskBadge level={s.risk_level} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Attendance status helpers ─────────────────────────────────────────────────

const ATT_STATUSES = ['present', 'absent', 'late', 'excused', 'makeup'] as const
type AttStatus = typeof ATT_STATUSES[number]

function attStatusCls(s: AttStatus | string): string {
  if (s === 'present') return 'bg-emerald-100 text-emerald-700'
  if (s === 'late')    return 'bg-amber-100 text-amber-700'
  if (s === 'absent')  return 'bg-red-100 text-red-700'
  if (s === 'excused') return 'bg-blue-100 text-blue-700'
  if (s === 'makeup')  return 'bg-purple-100 text-purple-700'
  return 'bg-slate-100 text-slate-500'
}

// ── Record Session inline panel ───────────────────────────────────────────────

function RecordSessionPanel({
  group,
  students,
  onSuccess,
  onCancel,
}: {
  group:     GroupOperationalRow
  students:  GroupDetailStudent[]
  onSuccess: () => void
  onCancel:  () => void
}) {
  const now = new Date()
  const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16)

  const [datetime,  setDatetime]  = useState(localISO)
  const [topic,     setTopic]     = useState('')
  const [duration,  setDuration]  = useState('60')
  const [delivery,  setDelivery]  = useState<'online' | 'offline'>('online')
  const [statuses,  setStatuses]  = useState<Record<string, AttStatus>>(() =>
    Object.fromEntries(students.map(s => [s.student_id, 'present' as AttStatus]))
  )
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  async function handleSave() {
    if (!topic.trim()) { setError('Topic is required'); return }
    if (!datetime)     { setError('Session date is required'); return }
    setSaving(true)
    setError(null)
    try {
      const result = await addGroupSessionAction({
        groupId:         group.group_id,
        branchId:        group.branch_id,
        sessionDatetime: datetime,
        topic:           topic.trim(),
        durationMinutes: Number(duration) || 60,
        delivery,
        students: students.map(s => ({
          student_id: s.student_id,
          status:     statuses[s.student_id] ?? 'present',
        })),
      })
      if (!result.success) { setError(result.error ?? 'Failed to save'); return }
      onSuccess()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unexpected error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#FF8A1F]/30 bg-orange-50/40 p-4 space-y-3">
      <p className="text-[12px] font-semibold text-[#0B1F3A]">Record Session</p>

      {/* Date / time + topic */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-[#94A3B8] mb-1">Date & Time</label>
          <input
            type="datetime-local"
            value={datetime}
            onChange={e => setDatetime(e.target.value)}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[#94A3B8] mb-1">Duration (min)</label>
          <input
            type="number"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            min={15} max={240} step={15}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-medium text-[#94A3B8] mb-1">Topic <span className="text-red-400">*</span></label>
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="e.g. CSS Selectors, Variables…"
          className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-[10px] font-medium text-[#94A3B8] mb-1">Delivery</label>
        <div className="flex gap-2">
          {(['online', 'offline'] as const).map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDelivery(d)}
              className={`rounded-lg px-3 py-1 text-[11px] font-medium border transition ${
                delivery === d
                  ? 'border-[#FF8A1F] bg-[#FF8A1F] text-white'
                  : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#FF8A1F]'
              }`}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Per-student attendance */}
      {students.length > 0 && (
        <div>
          <label className="block text-[10px] font-medium text-[#94A3B8] mb-1.5">
            Attendance ({students.length} student{students.length !== 1 ? 's' : ''})
          </label>
          <div className="space-y-1.5">
            {students.map(s => (
              <div key={s.student_id} className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2">
                <span className="text-[12px] font-medium text-[#0B1F3A] truncate flex-1">{s.student_name}</span>
                <div className="flex gap-1 shrink-0">
                  {ATT_STATUSES.map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatuses(prev => ({ ...prev, [s.student_id]: st }))}
                      className={`rounded px-1.5 py-0.5 text-[9px] font-semibold capitalize transition ${
                        statuses[s.student_id] === st
                          ? attStatusCls(st)
                          : 'bg-[#F1F5F9] text-[#94A3B8] hover:bg-[#E2E8F0]'
                      }`}
                    >
                      {st === 'makeup' ? 'mkp' : st.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-[11px] text-red-700">{error}</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] font-medium text-[#64748B] hover:bg-[#F8FAFC] transition"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-lg bg-[#FF8A1F] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#e87c18] transition disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Session'}
        </button>
      </div>
    </div>
  )
}

// ── Tab: Attendance ────────────────────────────────────────────────────────────

function AttendanceTab({
  sessions, students, loading, group, onSessionDeleted, onRebuilt, onSessionAdded,
}: {
  sessions:         GroupDetailSession[]
  students:         GroupDetailStudent[]
  loading:          boolean
  group:            GroupOperationalRow
  onSessionDeleted: () => void
  onRebuilt:        () => void
  onSessionAdded:   () => void
}) {
  const [deletingId,   setDeletingId]   = useState<string | null>(null)
  const [confirmId,    setConfirmId]    = useState<string | null>(null)
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [rebuilding,   setRebuilding]   = useState(false)
  const [rebuildMsg,   setRebuildMsg]   = useState<string | null>(null)
  const [toast,        setToast]        = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [showRecord,   setShowRecord]   = useState(false)

  if (loading) return <LoadingState />

  const upcoming = sessions.filter(s => new Date(s.scheduled_at) >= new Date())
  const past     = sessions.filter(s => new Date(s.scheduled_at) < new Date())

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleDelete(scheduleId: string) {
    setDeletingId(scheduleId)
    try {
      await deleteGroupSessionAction(scheduleId)
      setConfirmId(null)
      showToast('success', 'Session deleted — package consumption reversed')
      onSessionDeleted()
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleEditSave(
    scheduleId: string,
    patch: Parameters<typeof editGroupSessionAction>[1],
  ) {
    const res = await editGroupSessionAction(scheduleId, patch)
    if (!res.success) throw new Error(res.error ?? 'Save failed')
    setEditingId(null)
    showToast('success', 'Session updated — consumption recalculated')
    onSessionAdded()
  }

  async function handleRebuild() {
    setRebuilding(true)
    setRebuildMsg(null)
    try {
      const res = await rebuildGroupAttendanceAction(group.group_id)
      setRebuildMsg(`Rebuilt — ${res.fixed_enrollments} enrollment(s) corrected`)
      onRebuilt()
    } catch {
      setRebuildMsg('Rebuild failed')
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Toast notifications */}
      {toast && (
        <div className={`rounded-lg border px-3 py-2 text-[11px] font-medium ${
          toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
            : 'bg-red-50 border-red-100 text-red-700'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Top bar: session count + actions */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-[#94A3B8]">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          {past.length > 0 && (
            <span className="ml-1 text-emerald-600">· {past.length} recorded</span>
          )}
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            title="Rebuild consumption for all students in this group"
            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[11px] font-medium text-[#374151] hover:bg-[#F8FAFC] transition disabled:opacity-50"
          >
            {rebuilding ? 'Rebuilding…' : 'Rebuild'}
          </button>
          <button
            onClick={() => { setShowRecord(r => !r); setEditingId(null) }}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
              showRecord
                ? 'bg-[#FF8A1F]/10 border border-[#FF8A1F]/30 text-[#FF8A1F]'
                : 'bg-[#FF8A1F] text-white hover:bg-[#e87c18]'
            }`}
          >
            {showRecord ? '✕ Cancel' : '+ Add Session'}
          </button>
        </div>
      </div>

      {rebuildMsg && (
        <p className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-[11px] text-emerald-700">
          {rebuildMsg}
        </p>
      )}

      {/* Inline record session form */}
      {showRecord && (
        <RecordSessionPanel
          group={group}
          students={students}
          onSuccess={() => { setShowRecord(false); onSessionAdded() }}
          onCancel={() => setShowRecord(false)}
        />
      )}

      {upcoming.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Upcoming</p>
          <div className="divide-y divide-[#F1F5F9] rounded-xl border border-[#E2E8F0] bg-white">
            {upcoming.slice(0, 5).map(s => (
              <SessionRow
                key={s.id}
                session={s}
                students={students}
                confirmId={confirmId}
                deletingId={deletingId}
                editingId={editingId}
                onConfirmOpen={id => { setConfirmId(id) }}
                onConfirmClose={() => setConfirmId(null)}
                onDelete={handleDelete}
                onEditOpen={id => { setEditingId(id); setShowRecord(false) }}
                onEditClose={() => setEditingId(null)}
                onEditSave={handleEditSave}
              />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Recorded Sessions</p>
          <div className="divide-y divide-[#F1F5F9] rounded-xl border border-[#E2E8F0] bg-white">
            {past.map(s => (
              <SessionRow
                key={s.id}
                session={s}
                students={students}
                confirmId={confirmId}
                deletingId={deletingId}
                editingId={editingId}
                onConfirmOpen={id => { setConfirmId(id) }}
                onConfirmClose={() => setConfirmId(null)}
                onDelete={handleDelete}
                onEditOpen={id => { setEditingId(id); setShowRecord(false) }}
                onEditClose={() => setEditingId(null)}
                onEditSave={handleEditSave}
              />
            ))}
          </div>
        </div>
      )}

      {!upcoming.length && !past.length && !showRecord && (
        <p className="py-8 text-center text-sm text-[#94A3B8]">
          No sessions yet. Use &quot;+ Add Session&quot; to record one.
        </p>
      )}
    </div>
  )
}

// ── Full inline edit form for a completed session ─────────────────────────────

function SessionEditForm({
  session,
  students,
  onSave,
  onCancel,
}: {
  session:  GroupDetailSession
  students: GroupDetailStudent[]
  onSave:   (patch: {
    topic?:            string
    duration_minutes?: number
    scheduled_at?:     string
    delivery?:         'online' | 'offline'
    student_statuses?: { student_id: string; status: string }[]
  }) => Promise<void>
  onCancel: () => void
}) {
  const localISO = (iso: string) => {
    const d = new Date(iso)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  const [datetime,  setDatetime]  = useState(localISO(session.scheduled_at))
  const [topic,     setTopic]     = useState(session.topic ?? '')
  const [duration,  setDuration]  = useState(String(session.duration_minutes || 60))
  const [delivery,  setDelivery]  = useState<'online' | 'offline'>(
    (session.delivery === 'offline' ? 'offline' : 'online') as 'online' | 'offline'
  )
  const [statuses,  setStatuses]  = useState<Record<string, AttStatus>>(() => {
    const map: Record<string, AttStatus> = {}
    for (const s of students) {
      const rec = session.student_attendance.find(r => r.student_id === s.student_id)
      map[s.student_id] = (rec?.status ?? 'present') as AttStatus
    }
    return map
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const originalDatetime = localISO(session.scheduled_at)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const patch: Parameters<typeof onSave>[0] = {}

      if (topic.trim() !== (session.topic ?? '').trim()) patch.topic = topic.trim()
      const dur = Number(duration) || 60
      if (dur !== session.duration_minutes) patch.duration_minutes = dur
      if (delivery !== (session.delivery === 'offline' ? 'offline' : 'online')) patch.delivery = delivery
      if (datetime !== originalDatetime) patch.scheduled_at = new Date(datetime).toISOString()

      // Always send student statuses so the RPC can re-evaluate consumption
      patch.student_statuses = students.map(s => ({
        student_id: s.student_id,
        status:     statuses[s.student_id] ?? 'present',
      }))

      await onSave(patch)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-[#FF8A1F]/30 bg-orange-50/30 p-3 space-y-3">
      <p className="text-[11px] font-semibold text-[#0B1F3A]">Edit Session</p>

      {/* Date/time + duration */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-[#94A3B8] mb-1">Date & Time</label>
          <input
            type="datetime-local"
            value={datetime}
            onChange={e => setDatetime(e.target.value)}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-[11px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
          />
          {datetime !== originalDatetime && (
            <p className="mt-0.5 text-[9px] text-amber-600">
              ⚠ Date change will re-evaluate package eligibility
            </p>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[#94A3B8] mb-1">Duration (min)</label>
          <input
            type="number"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            min={15} max={240} step={15}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-[11px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
          />
        </div>
      </div>

      {/* Topic */}
      <div>
        <label className="block text-[10px] font-medium text-[#94A3B8] mb-1">Topic</label>
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="e.g. CSS Selectors, Variables…"
          className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-[11px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
        />
      </div>

      {/* Delivery */}
      <div>
        <label className="block text-[10px] font-medium text-[#94A3B8] mb-1">Delivery</label>
        <div className="flex gap-2">
          {(['online', 'offline'] as const).map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDelivery(d)}
              className={`rounded-lg px-3 py-1 text-[10px] font-medium border transition ${
                delivery === d
                  ? 'border-[#FF8A1F] bg-[#FF8A1F] text-white'
                  : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#FF8A1F]'
              }`}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Per-student attendance statuses */}
      {students.length > 0 && (
        <div>
          <label className="block text-[10px] font-medium text-[#94A3B8] mb-1.5">
            Attendance Statuses
          </label>
          <div className="space-y-1">
            {students.map(s => (
              <div key={s.student_id} className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5">
                <span className="text-[11px] font-medium text-[#0B1F3A] truncate flex-1 min-w-0">
                  {s.student_name}
                </span>
                <div className="flex gap-1 shrink-0">
                  {ATT_STATUSES.map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatuses(prev => ({ ...prev, [s.student_id]: st }))}
                      className={`rounded px-1.5 py-0.5 text-[9px] font-semibold capitalize transition ${
                        statuses[s.student_id] === st
                          ? attStatusCls(st)
                          : 'bg-[#F1F5F9] text-[#94A3B8] hover:bg-[#E2E8F0]'
                      }`}
                    >
                      {st === 'makeup' ? 'mkp' : st.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-[10px] text-red-700">{error}</p>
      )}

      <div className="flex gap-2 pt-0.5">
        <button
          onClick={onCancel}
          disabled={saving}
          className="flex-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#64748B] hover:bg-[#F8FAFC] transition disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-lg bg-[#FF8A1F] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#e87c18] transition disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save & Recalculate'}
        </button>
      </div>
    </div>
  )
}

function SessionRow({
  session,
  students,
  confirmId,
  deletingId,
  editingId,
  onConfirmOpen,
  onConfirmClose,
  onDelete,
  onEditOpen,
  onEditClose,
  onEditSave,
}: {
  session:       GroupDetailSession
  students:      GroupDetailStudent[]
  confirmId:     string | null
  deletingId:    string | null
  editingId:     string | null
  onConfirmOpen: (id: string) => void
  onConfirmClose: () => void
  onDelete:      (id: string) => void
  onEditOpen:    (id: string) => void
  onEditClose:   () => void
  onEditSave:    (id: string, patch: Parameters<typeof editGroupSessionAction>[1]) => Promise<void>
}) {
  const isPast    = new Date(session.scheduled_at) < new Date()
  const statusCls = session.status === 'completed' ? 'bg-green-100 text-green-700' :
                    session.status === 'scheduled'  ? 'bg-blue-100 text-blue-700'  :
                                                      'bg-[#F1F5F9] text-[#64748B]'
  const isConfirming = confirmId === session.id
  const isDeleting   = deletingId === session.id
  const isEditing    = editingId === session.id

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Session # + date */}
          <div className="flex items-center gap-2 flex-wrap">
            {session.session_number != null && (
              <span className="text-[10px] font-semibold text-[#94A3B8]">
                #{session.session_number}
              </span>
            )}
            <p className={`text-[13px] font-medium ${isPast ? 'text-[#0B1F3A]' : 'text-[#374151]'}`}>
              {fmtDateTime(session.scheduled_at)}
            </p>
            {session.delivery && (
              <span className={`text-[9px] font-medium rounded px-1.5 py-0.5 ${
                session.delivery === 'online'
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {session.delivery}
              </span>
            )}
          </div>
          {/* Topic + course */}
          <p className="mt-0.5 text-[11px] text-[#64748B] truncate">
            {[session.topic, session.course_name].filter(Boolean).join(' · ') || '—'}
          </p>
          {/* Attendance summary (completed sessions only) */}
          {session.status === 'completed' && (
            <div className="mt-1 flex items-center gap-2">
              {session.present_count > 0 && (
                <span className="text-[10px] font-medium text-emerald-600">
                  ✓ {session.present_count} present
                </span>
              )}
              {session.absent_count > 0 && (
                <span className="text-[10px] font-medium text-red-500">
                  ✗ {session.absent_count} absent
                </span>
              )}
              {session.present_count === 0 && session.absent_count === 0 && (
                <span className="text-[10px] text-[#94A3B8]">No attendance recorded</span>
              )}
            </div>
          )}
        </div>

        {/* Right: status badge + duration + Edit/Delete */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusCls}`}>
            {session.status}
          </span>
          {session.duration_minutes > 0 && (
            <span className="text-[10px] text-[#94A3B8]">{session.duration_minutes}min</span>
          )}
          {session.status === 'completed' && !isConfirming && !isEditing && (
            <div className="flex gap-2">
              <button
                onClick={() => onEditOpen(session.id)}
                className="text-[10px] text-[#64748B] hover:text-[#0B1F3A] transition"
              >
                Edit
              </button>
              <button
                onClick={() => onConfirmOpen(session.id)}
                className="text-[10px] text-red-400 hover:text-red-600 transition"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Full edit form */}
      {isEditing && (
        <SessionEditForm
          session={session}
          students={students}
          onSave={patch => onEditSave(session.id, patch)}
          onCancel={onEditClose}
        />
      )}

      {/* Delete confirmation */}
      {isConfirming && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
          <span className="flex-1 text-[11px] text-red-700">
            Delete session? This reverses all package consumptions.
          </span>
          <button
            onClick={onConfirmClose}
            className="rounded border border-[#E2E8F0] bg-white px-2 py-1 text-[10px] font-medium text-[#64748B] hover:bg-[#F8FAFC] transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onDelete(session.id)}
            disabled={isDeleting}
            className="rounded bg-red-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-red-600 transition disabled:opacity-50"
          >
            {isDeleting ? '…' : 'Confirm'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Tab: Performance ───────────────────────────────────────────────────────────

function PerformanceTab({ group }: { group: GroupOperationalRow }) {
  const metrics = [
    { label: 'Attendance',   value: group.attendance_avg },
    { label: 'Assignments',  value: group.assignment_avg },
    { label: 'Portfolio',    value: group.portfolio_avg  },
    { label: 'Health Score', value: group.health_score  },
  ]

  const flags = [
    group.is_low_attendance  && 'Low attendance (< 60%)',
    group.is_low_capacity    && 'Under capacity (< 50% filled)',
    group.is_overloaded      && 'Overloaded (≥ 90% filled)',
    !group.has_instructor    && 'No instructor assigned',
    !group.has_course        && 'No course assigned',
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3">
        {metrics.map(m => (
          <div key={m.label} className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#374151]">{m.label}</span>
            <PctBar value={m.value} />
          </div>
        ))}
      </div>

      {flags.length > 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="mb-2 text-[12px] font-semibold text-amber-700">Alerts</p>
          <ul className="space-y-1">
            {flags.map(f => (
              <li key={String(f)} className="flex items-center gap-2 text-[12px] text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {flags.length === 0 && group.health_score >= 75 && (
        <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-[13px] text-green-700 font-medium">
          Group is performing well ✓
        </div>
      )}
    </div>
  )
}

// ── Tab: Schedule ──────────────────────────────────────────────────────────────

function ScheduleTab({ group, sessions, loading }: { group: GroupOperationalRow; sessions: GroupDetailSession[]; loading: boolean }) {
  const schedule = [
    group.day_of_week ? DAYS_FULL[group.day_of_week] : null,
    fmt12(group.start_time),
    group.duration_minutes ? `${group.duration_minutes} min` : null,
  ].filter(Boolean).join(' · ')

  const upcoming = sessions.filter(s => new Date(s.scheduled_at) >= new Date()).slice(0, 8)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-2.5">
        <Row label="Recurring" value={schedule || '—'} />
        <Row label="Start Date" value={fmtDate(group.start_date)} />
        {group.end_date && <Row label="End Date" value={fmtDate(group.end_date)} />}
        {group.meeting_link && (
          <Row label="Meeting" value={
            <a href={group.meeting_link} target="_blank" rel="noopener noreferrer"
               className="text-[#FF8A1F] underline hover:text-[#e87c18]">
              Join →
            </a>
          } />
        )}
      </div>

      {loading ? <LoadingState /> : upcoming.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Next Sessions</p>
          <div className="divide-y divide-[#F1F5F9] rounded-xl border border-[#E2E8F0] bg-white">
            {upcoming.map(s => <ScheduleSessionRow key={s.id} session={s} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// Read-only session row used by ScheduleTab (no delete controls)
function ScheduleSessionRow({ session }: { session: GroupDetailSession }) {
  const statusCls = session.status === 'completed' ? 'bg-green-100 text-green-700' :
                    session.status === 'scheduled'  ? 'bg-blue-100 text-blue-700'  :
                                                      'bg-[#F1F5F9] text-[#64748B]'
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[#374151]">{fmtDateTime(session.scheduled_at)}</p>
        {session.topic && <p className="mt-0.5 text-[11px] text-[#64748B] truncate">{session.topic}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusCls}`}>
          {session.status}
        </span>
        {session.duration_minutes > 0 && (
          <span className="text-[11px] text-[#94A3B8]">{session.duration_minutes}min</span>
        )}
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FF8A1F] border-t-transparent" />
    </div>
  )
}

// ── Drawer ─────────────────────────────────────────────────────────────────────

export default function GroupDetailDrawer({ group, isTL, onClose, onEdit, onArchived }: Props) {
  const [tab, setTab]         = useState<Tab>('overview')
  const [detailData, setDetailData] = useState<GroupDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [, startTransition] = useTransition()

  const loadDetail = useCallback((gId: string) => {
    setDetailLoading(true)
    startTransition(() => {
      getGroupDetailDataAction(gId).then(data => {
        setDetailData(data)
        setDetailLoading(false)
      }).catch(() => setDetailLoading(false))
    })
  }, [])

  useEffect(() => {
    if (!group) { setDetailData(null); return }
    setTab('overview')
    setDetailData(null)
    setArchiveConfirm(false)
    loadDetail(group.group_id)
  }, [group?.group_id, loadDetail])

  useEffect(() => {
    if (!group) return
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [group, onClose])

  function handleArchive() {
    if (!group) return
    startTransition(async () => {
      await archiveGroupAction(group.group_id)
      onArchived()
    })
  }

  if (!group) return null

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',     label: 'Overview'     },
    { key: 'students',     label: `Students (${group.student_count})` },
    { key: 'attendance',   label: 'Attendance'   },
    { key: 'performance',  label: 'Performance'  },
    { key: 'schedule',     label: 'Schedule'     },
  ]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:max-w-md">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-[#0B1F3A]">{group.name}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[#64748B]">
              <span>{group.branch_name}</span>
              {group.code && <><span>·</span><span className="font-mono">{group.code}</span></>}
              <span>·</span>
              <span className={`capitalize font-medium ${group.status === 'active' ? 'text-green-600' : group.status === 'forming' ? 'text-blue-600' : 'text-[#94A3B8]'}`}>
                {group.status}
              </span>
            </div>
          </div>
          <div className="ml-3 flex shrink-0 items-center gap-1">
            {isTL && (
              <button onClick={() => onEdit(group)}
                className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#F8FAFC] transition min-h-9 flex items-center">
                Edit
              </button>
            )}
            <button onClick={onClose}
              className="rounded-full p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0B1F3A] transition">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-[#E2E8F0] px-4">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                'shrink-0 border-b-2 px-3 py-3 text-[12px] font-medium transition whitespace-nowrap',
                tab === t.key
                  ? 'border-[#FF8A1F] text-[#FF8A1F]'
                  : 'border-transparent text-[#64748B] hover:text-[#374151]',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'overview'    && <OverviewTab    group={group} />}
          {tab === 'students'    && <StudentsTab    students={detailData?.students ?? []} loading={detailLoading} />}
          {tab === 'attendance'  && (
            <AttendanceTab
              sessions={detailData?.sessions ?? []}
              students={detailData?.students ?? []}
              loading={detailLoading}
              group={group}
              onSessionDeleted={() => loadDetail(group.group_id)}
              onRebuilt={() => loadDetail(group.group_id)}
              onSessionAdded={() => loadDetail(group.group_id)}
            />
          )}
          {tab === 'performance' && <PerformanceTab group={group} />}
          {tab === 'schedule'    && <ScheduleTab    group={group} sessions={detailData?.sessions ?? []} loading={detailLoading} />}
        </div>

        {/* Footer (TL only) */}
        {isTL && (
          <div className="border-t border-[#E2E8F0] px-5 py-3">
            {archiveConfirm ? (
              <div className="flex items-center gap-3">
                <span className="flex-1 text-[12px] text-[#64748B]">Archive this group?</span>
                <button onClick={() => setArchiveConfirm(false)}
                  className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#F8FAFC] transition">
                  Cancel
                </button>
                <button onClick={handleArchive}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-red-600">
                  Confirm
                </button>
              </div>
            ) : (
              <button onClick={() => setArchiveConfirm(true)}
                className="text-[12px] font-medium text-[#94A3B8] hover:text-red-500 transition">
                Archive Group
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
