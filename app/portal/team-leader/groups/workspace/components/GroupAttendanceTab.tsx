'use client'

import { useState } from 'react'
import type { GroupDetailSession, GroupDetailStudent } from '@/modules/groups/modal-actions'
import type { GroupOperationalRow } from '@/modules/groups/operational'
import {
  editGroupSessionAction,
  deleteGroupSessionAction,
  rebuildGroupAttendanceAction,
} from '@/modules/groups/modal-actions'
import { LoadingSpinner } from './LoadingSpinner'

// ── Attendance status helpers ─────────────────────────────────────────

const WS_ATT_STATUSES = ['present', 'absent', 'late', 'excused', 'makeup'] as const
type WsAttStatus = typeof WS_ATT_STATUSES[number]

function wsAttCls(s: string): string {
  if (s === 'present') return 'bg-[#E7F8EE] text-[#15803D]'
  if (s === 'late')    return 'bg-[#FFFBEB] text-[#B45309]'
  if (s === 'absent')  return 'bg-[#FEE2E2] text-[#DC2626]'
  if (s === 'excused') return 'bg-[#EFF6FF] text-[#1D4ED8]'
  if (s === 'makeup')  return 'bg-[#F3E8FF] text-[#7C3AED]'
  return 'bg-[#F1F5F9] text-[#475569]'
}

// ── WsSessionEditForm ─────────────────────────────────────────────────

function WsSessionEditForm({
  session, students, onSave, onCancel,
}: {
  session:  GroupDetailSession
  students: GroupDetailStudent[]
  onSave:   (patch: Parameters<typeof editGroupSessionAction>[1]) => Promise<void>
  onCancel: () => void
}) {
  const toLocalISO = (iso: string) => {
    const d = new Date(iso)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  const [datetime, setDatetime] = useState(toLocalISO(session.scheduled_at))
  const [topic,    setTopic]    = useState(session.topic ?? '')
  const [duration, setDuration] = useState(String(session.duration_minutes || 60))
  const [delivery, setDelivery] = useState<'online' | 'offline'>(
    session.delivery === 'offline' ? 'offline' : 'online',
  )
  const [statuses, setStatuses] = useState<Record<string, WsAttStatus>>(() => {
    const m: Record<string, WsAttStatus> = {}
    for (const s of students) {
      const rec = session.student_attendance.find(r => r.student_id === s.student_id)
      m[s.student_id] = (rec?.status ?? 'present') as WsAttStatus
    }
    return m
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const originalISO = toLocalISO(session.scheduled_at)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const patch: Parameters<typeof editGroupSessionAction>[1] = {
        student_statuses: students.map(s => ({
          student_id: s.student_id,
          status:     statuses[s.student_id] ?? 'present',
        })),
      }
      if (topic.trim() !== (session.topic ?? '').trim())                         patch.topic            = topic.trim()
      const dur = Number(duration) || 60
      if (dur !== session.duration_minutes)                                       patch.duration_minutes = dur
      if (delivery !== (session.delivery === 'offline' ? 'offline' : 'online'))  patch.delivery         = delivery
      if (datetime !== originalISO)                                               patch.scheduled_at     = new Date(datetime).toISOString()
      await onSave(patch)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-[#FF8A1F]/30 bg-orange-50/30 p-3 space-y-3">
      <p className="text-[11px] font-semibold text-[#0B1F3A]">Edit Session</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-[#94A3B8] mb-1">Date &amp; Time</label>
          <input type="datetime-local" value={datetime} onChange={e => setDatetime(e.target.value)}
            className="w-full ds-card px-2 py-1.5 text-[11px] focus:border-[#FF8A1F] focus:outline-none" />
          {datetime !== originalISO && (
            <p className="mt-0.5 text-[9px] text-[#F59E0B]">⚠ Date change re-evaluates package eligibility</p>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[#94A3B8] mb-1">Duration (min)</label>
          <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
            min={15} max={240} step={15}
            className="w-full ds-card px-2 py-1.5 text-[11px] focus:border-[#FF8A1F] focus:outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-[#94A3B8] mb-1">Topic</label>
          <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. CSS Selectors…"
            className="w-full ds-card px-2 py-1.5 text-[11px] focus:border-[#FF8A1F] focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[#94A3B8] mb-1">Delivery</label>
          <div className="flex gap-2 mt-0.5">
            {(['online', 'offline'] as const).map(d => (
              <button key={d} type="button" onClick={() => setDelivery(d)}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-medium border transition ${
                  delivery === d
                    ? 'border-[#FF8A1F] bg-[#FF8A1F] text-white'
                    : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#FF8A1F]'
                }`}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {students.length > 0 && (
        <div>
          <label className="block text-[10px] font-medium text-[#94A3B8] mb-1.5">Attendance Statuses</label>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {students.map(s => (
              <div key={s.student_id} className="flex items-center justify-between gap-2 ds-card px-2.5 py-1.5">
                <span className="text-[11px] font-medium text-[#0B1F3A] truncate flex-1 min-w-0">{s.student_name}</span>
                <div className="flex gap-1 shrink-0">
                  {WS_ATT_STATUSES.map(st => (
                    <button key={st} type="button"
                      onClick={() => setStatuses(prev => ({ ...prev, [s.student_id]: st }))}
                      className={`rounded px-1.5 py-0.5 text-[9px] font-semibold transition ${
                        statuses[s.student_id] === st
                          ? wsAttCls(st)
                          : 'bg-[#F1F5F9] text-[#94A3B8] hover:bg-[#E2E8F0]'
                      }`}>
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
        <p className="rounded-lg bg-[#FEE2E2] border border-[#FEE2E2] px-3 py-2 text-[10px] text-[#DC2626]">{error}</p>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel} disabled={saving}
          className="flex-1 ds-card px-3 py-1.5 text-[11px] font-medium text-[#64748B] hover:bg-[#F8FAFC] transition disabled:opacity-50">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#e87c18] transition disabled:opacity-50">
          {saving ? 'Saving…' : 'Save & Recalculate'}
        </button>
      </div>
    </div>
  )
}

// ── WsSessionRow ──────────────────────────────────────────────────────

function WsSessionRow({
  session, students, confirmId, deletingId, editingId,
  onConfirmOpen, onConfirmClose, onDelete, onEditOpen, onEditClose, onEditSave,
}: {
  session:        GroupDetailSession
  students:       GroupDetailStudent[]
  confirmId:      string | null
  deletingId:     string | null
  editingId:      string | null
  onConfirmOpen:  (id: string) => void
  onConfirmClose: () => void
  onDelete:       (id: string) => void
  onEditOpen:     (id: string) => void
  onEditClose:    () => void
  onEditSave:     (id: string, patch: Parameters<typeof editGroupSessionAction>[1]) => Promise<void>
}) {
  const isPast    = new Date(session.scheduled_at) < new Date()
  const fmt       = new Date(session.scheduled_at).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  const statusCls = session.status === 'completed' ? 'bg-[#E7F8EE] text-[#15803D]'
                  : session.status === 'scheduled'  ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                                                    : 'bg-[#F1F5F9] text-[#64748B]'
  const isConfirming = confirmId  === session.id
  const isDeleting   = deletingId === session.id
  const isEditing    = editingId  === session.id

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {session.session_number != null && (
              <span className="text-[10px] font-semibold text-[#94A3B8]">#{session.session_number}</span>
            )}
            <p className={`text-[13px] font-medium ${isPast ? 'text-[#0B1F3A]' : 'text-[#374151]'}`}>{fmt}</p>
            {session.delivery && (
              <span className={`text-[9px] font-medium rounded px-1.5 py-0.5 ${
                session.delivery === 'online' ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'bg-[#F1F5F9] text-[#475569]'
              }`}>{session.delivery}</span>
            )}
          </div>
          {session.topic && (
            <p className="mt-0.5 text-[11px] text-[#64748B] truncate">{session.topic}</p>
          )}
          {session.status === 'completed' && (
            <div className="mt-1 flex items-center gap-2">
              {session.present_count > 0 && (
                <span className="text-[10px] font-medium text-[#10B981]">✓ {session.present_count} present</span>
              )}
              {session.absent_count > 0 && (
                <span className="text-[10px] font-medium text-[#EF4444]">✗ {session.absent_count} absent</span>
              )}
              {session.present_count === 0 && session.absent_count === 0 && (
                <span className="text-[10px] text-[#94A3B8]">No attendance recorded</span>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusCls}`}>
            {session.status}
          </span>
          {session.duration_minutes > 0 && (
            <span className="text-[10px] text-[#94A3B8]">{session.duration_minutes}min</span>
          )}
          {session.status === 'completed' && !isConfirming && !isEditing && (
            <div className="flex gap-2">
              <button onClick={() => onEditOpen(session.id)}
                className="text-[10px] text-[#64748B] hover:text-[#0B1F3A] transition">Edit</button>
              <button onClick={() => onConfirmOpen(session.id)}
                className="text-[10px] text-[#F87171] hover:text-[#EF4444] transition">Delete</button>
            </div>
          )}
        </div>
      </div>

      {isEditing && (
        <WsSessionEditForm
          session={session}
          students={students}
          onSave={patch => onEditSave(session.id, patch)}
          onCancel={onEditClose}
        />
      )}

      {isConfirming && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#FEE2E2] bg-[#FEE2E2] px-3 py-2">
          <span className="flex-1 text-[11px] text-[#DC2626]">Delete session? This reverses all package consumptions.</span>
          <button onClick={onConfirmClose}
            className="rounded border border-[#E2E8F0] bg-white px-2 py-1 text-[10px] font-medium text-[#64748B] hover:bg-[#F8FAFC] transition">
            Cancel
          </button>
          <button onClick={() => onDelete(session.id)} disabled={isDeleting}
            className="rounded bg-[#EF4444] px-2 py-1 text-[10px] font-medium text-white hover:bg-[#DC2626] transition disabled:opacity-50">
            {isDeleting ? '…' : 'Confirm'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── GroupAttendanceTab ────────────────────────────────────────────────

export function GroupAttendanceTab({
  sessions, students, group, loading, isTL, onOpenAddSession, onSessionsChanged,
}: {
  sessions:          GroupDetailSession[]
  students:          GroupDetailStudent[]
  group:             GroupOperationalRow
  loading:           boolean
  isTL:              boolean
  onOpenAddSession:  () => void
  onSessionsChanged: () => void
}) {
  const [confirmId,  setConfirmId]  = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [rebuilding, setRebuilding] = useState(false)
  const [toast,      setToast]      = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  if (loading && !sessions.length) return <LoadingSpinner />

  const now      = new Date()
  const past     = sessions.filter(s => new Date(s.scheduled_at) < now)
  const upcoming = sessions.filter(s => new Date(s.scheduled_at) >= now)

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleDelete(scheduleId: string) {
    setDeletingId(scheduleId)
    try {
      await deleteGroupSessionAction(scheduleId)
      setConfirmId(null)
      onSessionsChanged()
      showToast('success', 'Session deleted — package consumption reversed')
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
    onSessionsChanged()
    showToast('success', 'Session updated — consumption recalculated')
  }

  async function handleRebuild() {
    setRebuilding(true)
    try {
      const res = await rebuildGroupAttendanceAction(group.group_id)
      onSessionsChanged()
      showToast('success', `Rebuilt — ${res.fixed_enrollments} enrollment(s) corrected`)
    } catch {
      showToast('error', 'Rebuild failed')
    } finally {
      setRebuilding(false)
    }
  }

  const sessionRowProps = {
    students,
    confirmId,
    deletingId,
    editingId,
    onConfirmOpen:  (id: string) => setConfirmId(id),
    onConfirmClose: () => setConfirmId(null),
    onDelete:       handleDelete,
    onEditOpen:     (id: string) => setEditingId(id),
    onEditClose:    () => setEditingId(null),
    onEditSave:     handleEditSave,
  }

  return (
    <div className="p-4 space-y-4">
      {toast && (
        <div className={`rounded-lg border px-3 py-2 text-[11px] font-medium ${
          toast.type === 'success'
            ? 'bg-[#E7F8EE] border-[#A7F3D0] text-[#15803D]'
            : 'bg-[#FEE2E2] border-[#FECACA] text-[#DC2626]'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Avg Attendance',
            value: group.attendance_avg > 0 ? `${group.attendance_avg}%` : '—',
            color: group.attendance_avg >= 75 ? 'text-[#10B981]'
                 : group.attendance_avg >= 60 ? 'text-[#F59E0B]'
                 : group.attendance_avg  >  0 ? 'text-[#EF4444]'
                                              : 'text-[#0B1F3A]',
          },
          { label: 'Students',      value: String(group.student_count), color: 'text-[#0B1F3A]' },
          { label: 'Sessions Done', value: String(past.length),         color: 'text-[#0B1F3A]' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide">{card.label}</p>
            <p className={`mt-1 text-xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {isTL && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-[#94A3B8]">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            {past.length > 0 && <span className="ml-1 text-[#10B981]">· {past.length} recorded</span>}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleRebuild}
              disabled={rebuilding}
              title="Recalculate package consumption for all students"
              className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[11px] font-medium text-[#374151] hover:bg-[#F8FAFC] transition disabled:opacity-50"
            >
              {rebuilding ? 'Rebuilding…' : 'Rebuild'}
            </button>
            <button
              onClick={() => { setEditingId(null); onOpenAddSession() }}
              className="rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#e87c18] transition"
            >
              + Add Session
            </button>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Upcoming</p>
          <div className="divide-y divide-[#F1F5F9] ds-card">
            {upcoming.slice(0, 5).map(s => (
              <WsSessionRow key={s.id} session={s} {...sessionRowProps} />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">Recorded Sessions</p>
          <div className="divide-y divide-[#F1F5F9] ds-card">
            {past.map(s => (
              <WsSessionRow key={s.id} session={s} {...sessionRowProps} />
            ))}
          </div>
        </div>
      )}

      {!past.length && !upcoming.length && !isTL && (
        <p className="py-10 text-center text-sm text-[#94A3B8]">No sessions recorded yet.</p>
      )}
      {!past.length && !upcoming.length && isTL && (
        <div className="py-10 text-center">
          <p className="text-sm text-[#94A3B8] mb-3">No sessions recorded yet.</p>
          <button onClick={onOpenAddSession}
            className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#e87c18] transition">
            + Add First Session
          </button>
        </div>
      )}
    </div>
  )
}
