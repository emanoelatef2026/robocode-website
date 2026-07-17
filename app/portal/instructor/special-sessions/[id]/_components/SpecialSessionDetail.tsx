'use client'

import { useState, useTransition, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import {
  startSpecialSession,
  endTrialSessionWithAttendance,
  endMakeupSession,
  saveTrialAttendance,
  saveMakeupAttendance,
  addTrialStudentFromLead,
  addTrialStudentNew,
  updateTrialStudent,
} from '@/modules/special-sessions/actions'
import type { TrialSession, MakeupSession, TrialSessionStudent } from '@/modules/special-sessions/types'
import StatusBadge from '@/components/admin/StatusBadge'
import type { ActionResult } from '@/types/app'

type Lead = { id: string; child_name: string; parent_name: string | null; phone: string | null; status: string }

type Props =
  | { type: 'trial';  trialSession: TrialSession;  makeupSession?: undefined; instructorId: string; leads: Lead[] }
  | { type: 'makeup'; makeupSession: MakeupSession; trialSession?: undefined;  instructorId: string; leads: Lead[] }

const INIT_STUDENT: ActionResult<{ studentId: string }> = { success: false, error: { code: '', message: '' } }
const INIT_VOID:    ActionResult<void>                   = { success: false, error: { code: '', message: '' } }

export default function SpecialSessionDetail(props: Props) {
  const router  = useRouter()
  const [pending, startTransition] = useTransition()
  const [endError, setEndError] = useState<string | null>(null)

  const session   = props.type === 'trial' ? props.trialSession! : props.makeupSession!
  const isTrial   = props.type === 'trial'
  const isOngoing   = session.status === 'ongoing'
  const isScheduled = session.status === 'scheduled'
  const isEditable  = isOngoing || isScheduled

  // Attendance map lives here so handleEnd can read it before ending
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>(() => {
    if (props.type !== 'trial') return {}
    return Object.fromEntries(
      props.trialSession!.students.map(s => [s.id, s.attendance_status ?? 'absent'])
    )
  })

  const badgeColor = isTrial ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
  const badgeLabel = isTrial ? 'Trial Session' : 'Standalone Makeup'

  function handleStart() {
    startTransition(async () => { await startSpecialSession(session.id); router.refresh() })
  }

  function handleEnd() {
    setEndError(null)
    startTransition(async () => {
      let result: ActionResult<void>
      if (isTrial) {
        result = await endTrialSessionWithAttendance(session.id, attendanceMap)
      } else {
        result = await endMakeupSession(session.id)
      }

      if (!result.success) {
        setEndError(result.error?.message ?? 'Failed to end session. Please try again.')
        return
      }

      // Same landing spot as ending a regular group session — "My Sessions"
      // now includes trial/makeup sessions too (they're credited via
      // session_instructors, same as payroll uses).
      router.push('/portal/instructor/history')
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badgeColor}`}>
              {badgeLabel}
            </span>
            <StatusBadge status={session.status} dot />
          </div>
          <h1 className="text-[18px] font-bold text-[#0B1F3A]">
            {new Date(session.scheduled_at).toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </h1>
          <p className="text-[13px] text-[#64748B]">
            {new Date(session.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            {' · '}{session.duration_minutes} min · {session.branch_name}
          </p>
        </div>

        <div className="flex gap-2">
          {isScheduled && (
            <button onClick={handleStart} disabled={pending}
              className="rounded-lg bg-[#3B82F6] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60 hover:bg-[#2563EB]">
              {pending ? 'Starting…' : 'Start Session'}
            </button>
          )}
          {isOngoing && (
            <button onClick={handleEnd} disabled={pending}
              className="rounded-lg bg-[#10B981] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60 hover:bg-[#059669]">
              {pending ? 'Ending…' : 'End Session'}
            </button>
          )}
        </div>
      </div>

      {/* End session error feedback */}
      {endError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-[13px] font-semibold text-red-700">Failed to end session</p>
          <p className="text-[12px] text-red-600 mt-0.5">{endError}</p>
        </div>
      )}

      {session.notes && (
        <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <p className="text-[12px] font-semibold text-[#64748B] mb-1">Notes</p>
          <p className="text-[13px] text-[#0B1F3A]">{session.notes}</p>
        </div>
      )}

      {/* Students panel */}
      {isTrial ? (
        <TrialStudentsPanel
          session={props.trialSession!}
          leads={props.leads}
          isEditable={isEditable}
          isOngoing={isOngoing}
          attendanceMap={attendanceMap}
          onAttendanceChange={setAttendanceMap}
        />
      ) : (
        <MakeupStudentsPanel
          session={props.makeupSession!}
          isOngoing={isOngoing}
        />
      )}
    </div>
  )
}

// ── Trial Students Panel ──────────────────────────────────────────────────────

function TrialStudentsPanel({
  session, leads, isEditable, isOngoing, attendanceMap, onAttendanceChange,
}: {
  session:            TrialSession
  leads:              Lead[]
  isEditable:         boolean
  isOngoing:          boolean
  attendanceMap:      Record<string, string>
  onAttendanceChange: React.Dispatch<React.SetStateAction<Record<string, string>>>
}) {
  const router = useRouter()
  const [addMode, setAddMode]     = useState<'none' | 'lead' | 'new'>('none')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savePending, startSaveTransition] = useTransition()

  // Add from lead
  const [fromLeadState, fromLeadAction, fromLeadPending] = useActionState(
    async (_prev: ActionResult<{ studentId: string }>, fd: FormData) => {
      const r = await addTrialStudentFromLead(_prev, fd)
      if (r.success) { setAddMode('none'); router.refresh() }
      return r
    },
    INIT_STUDENT
  )

  // Add new ad-hoc
  const [newState, newAction, newPending] = useActionState(
    async (_prev: ActionResult<{ studentId: string }>, fd: FormData) => {
      const r = await addTrialStudentNew(_prev, fd)
      if (r.success) { setAddMode('none'); router.refresh() }
      return r
    },
    INIT_STUDENT
  )

  function handleSaveAttendance() {
    const fd = new FormData()
    fd.set('schedule_id', session.id)
    for (const [sid, status] of Object.entries(attendanceMap)) {
      fd.set(`status_${sid}`, status)
    }
    startSaveTransition(async () => {
      await saveTrialAttendance(null, fd)
      router.refresh()
    })
  }

  return (
    <div className="ds-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-[#0B1F3A]">
          Trial Students ({session.students.length})
        </h2>
        {isEditable && addMode === 'none' && (
          <div className="flex gap-2">
            <button onClick={() => setAddMode('lead')}
              className="rounded-lg bg-[#F1F5F9] px-3 py-1.5 text-[12px] font-semibold text-[#0B1F3A] hover:bg-[#E2E8F0]">
              From Lead
            </button>
            <button onClick={() => setAddMode('new')}
              className="rounded-lg bg-[#A855F7] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#9333EA]">
              + New Student
            </button>
          </div>
        )}
        {addMode !== 'none' && (
          <button onClick={() => setAddMode('none')} className="text-[12px] text-[#64748B] hover:underline">
            Cancel
          </button>
        )}
      </div>

      {/* Add from lead */}
      {addMode === 'lead' && (
        <form action={fromLeadAction} className="border-b border-[#E2E8F0] p-4 space-y-3 bg-purple-50">
          {!fromLeadState.success && fromLeadState.error?.message && (
            <p className="text-[12px] text-red-600">{fromLeadState.error.message}</p>
          )}
          <input type="hidden" name="schedule_id" value={session.id} />
          <div>
            <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Select Lead</label>
            {leads.length === 0 ? (
              <p className="text-[12px] text-[#94A3B8]">No available leads for this branch.</p>
            ) : (
              <select name="lead_id" required
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px]">
                <option value="">-- Select a lead --</option>
                {leads.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.child_name}{l.phone ? ` · ${l.phone}` : ''} ({l.status})
                  </option>
                ))}
              </select>
            )}
          </div>
          <button type="submit" disabled={fromLeadPending || leads.length === 0}
            className="rounded-lg bg-[#A855F7] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
            {fromLeadPending ? 'Adding…' : 'Add Lead'}
          </button>
        </form>
      )}

      {/* Add new ad-hoc student */}
      {addMode === 'new' && (
        <form action={newAction} className="border-b border-[#E2E8F0] p-4 space-y-3 bg-purple-50">
          {!newState.success && newState.error?.message && (
            <p className="text-[12px] text-red-600">{newState.error.message}</p>
          )}
          <input type="hidden" name="schedule_id" value={session.id} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Student Name *</label>
              <input type="text" name="student_name" required placeholder="Full name"
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px]" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Parent Phone *</label>
              <input type="text" name="parent_phone" required placeholder="01XXXXXXXXX"
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px]" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Student Phone</label>
              <input type="text" name="student_phone" placeholder="Optional"
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px]" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Notes</label>
              <input type="text" name="notes" placeholder="Optional"
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px]" />
            </div>
          </div>
          <button type="submit" disabled={newPending}
            className="rounded-lg bg-[#A855F7] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
            {newPending ? 'Adding…' : 'Add Student'}
          </button>
        </form>
      )}

      {/* Student list */}
      {session.students.length === 0 ? (
        <div className="px-4 py-8 text-center text-[13px] text-[#94A3B8]">
          No students registered yet. Add from lead or manually.
        </div>
      ) : (
        <div className="divide-y divide-[#F1F5F9]">
          {session.students.map(s => (
            <div key={s.id}>
              {/* Row */}
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#0B1F3A] truncate">{s.student_name}</p>
                  <p className="text-[11px] text-[#64748B]">
                    {s.parent_phone ? `Parent: ${s.parent_phone}` : ''}
                    {s.student_phone ? ` · Student: ${s.student_phone}` : ''}
                    {!s.parent_phone && !s.student_phone ? 'No contact info' : ''}
                    {s.lead_id ? ' · Lead' : ' · Ad-hoc'}
                  </p>
                  {s.notes && (
                    <p className="text-[11px] text-[#94A3B8] mt-0.5 italic truncate">{s.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Attendance toggle */}
                  <select
                    value={attendanceMap[s.id] ?? 'absent'}
                    onChange={e => onAttendanceChange(prev => ({ ...prev, [s.id]: e.target.value }))}
                    disabled={!isOngoing}
                    className="rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#A855F7] disabled:opacity-60 disabled:bg-[#F8FAFC]"
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                  </select>
                  {/* Edit toggle */}
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => setEditingId(editingId === s.id ? null : s.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                        editingId === s.id
                          ? 'border-[#A855F7] bg-purple-50 text-purple-700'
                          : 'border-[#E2E8F0] text-[#64748B] hover:border-[#A855F7] hover:text-[#A855F7]'
                      }`}
                    >
                      {editingId === s.id ? 'Done' : 'Edit'}
                    </button>
                  )}
                </div>
              </div>

              {/* Inline edit form — rendered as a sibling, never nested inside attendance form */}
              {editingId === s.id && (
                <StudentEditForm
                  student={s}
                  onSaved={() => { setEditingId(null); router.refresh() }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Save attendance (intermediate save while session is live) */}
      {isOngoing && session.students.length > 0 && (
        <div className="border-t border-[#E2E8F0] px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveAttendance}
            disabled={savePending}
            className="rounded-lg bg-[#A855F7] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60 hover:bg-[#9333EA]"
          >
            {savePending ? 'Saving…' : 'Save Attendance'}
          </button>
          <p className="text-[11px] text-[#64748B]">Attendance is also saved automatically when you end the session.</p>
        </div>
      )}
    </div>
  )
}

// ── Inline student edit form ──────────────────────────────────────────────────

function StudentEditForm({
  student, onSaved,
}: {
  student: TrialSessionStudent
  onSaved: () => void
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult<void>, fd: FormData) => {
      const r = await updateTrialStudent(_prev, fd)
      if (r.success) onSaved()
      return r
    },
    INIT_VOID
  )

  return (
    <form action={formAction} className="border-t border-dashed border-[#E2E8F0] bg-[#FAFBFF] px-4 py-3 space-y-3">
      {!state.success && state.error?.message && (
        <p className="text-[12px] text-red-600">{state.error.message}</p>
      )}
      <input type="hidden" name="student_id" value={student.id} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Student Name *</label>
          <input
            type="text"
            name="student_name"
            defaultValue={student.student_name}
            required
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Parent Phone</label>
          <input
            type="text"
            name="parent_phone"
            defaultValue={student.parent_phone ?? ''}
            placeholder="01XXXXXXXXX"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Student Phone</label>
          <input
            type="text"
            name="student_phone"
            defaultValue={student.student_phone ?? ''}
            placeholder="Optional"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Notes</label>
          <input
            type="text"
            name="notes"
            defaultValue={student.notes ?? ''}
            placeholder="Optional"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#A855F7]"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#0B1F3A] px-4 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60 hover:bg-[#1E3A5F]"
      >
        {pending ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  )
}

// ── Makeup Students Panel ─────────────────────────────────────────────────────

function MakeupStudentsPanel({ session, isOngoing }: { session: MakeupSession; isOngoing: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleSaveAttendance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await saveMakeupAttendance(null, fd)
      router.refresh()
    })
  }

  return (
    <div className="ds-card overflow-hidden">
      <div className="border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-[#0B1F3A]">Makeup Students</h2>
        <span className="text-[12px] text-[#64748B]">{session.students.length} registered</span>
      </div>

      {session.students.length === 0 ? (
        <div className="px-4 py-8 text-center text-[13px] text-[#94A3B8]">
          No students added yet.
        </div>
      ) : (
        <form onSubmit={handleSaveAttendance}>
          <input type="hidden" name="schedule_id" value={session.id} />
          <div className="divide-y divide-[#F1F5F9]">
            {session.students.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#0B1F3A] truncate">{s.student_name}</p>
                  <p className="text-[11px] text-[#64748B]">
                    {s.mode === 'EXTRA' ? (
                      <span className="text-orange-600 font-medium">Extra (+1 session)</span>
                    ) : (
                      <span className="text-blue-600 font-medium">
                        Replacing {s.replaced_session_num != null ? `Session #${s.replaced_session_num}` : 'absence'}
                      </span>
                    )}
                  </p>
                </div>
                <select
                  name={`status_${s.id}`}
                  defaultValue={s.attendance_status ?? 'absent'}
                  disabled={!isOngoing}
                  className="rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B] disabled:opacity-60"
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                </select>
              </div>
            ))}
          </div>
          {isOngoing && (
            <div className="border-t border-[#E2E8F0] px-4 py-3">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-[#F59E0B] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60 hover:bg-[#D97706]"
              >
                {pending ? 'Saving…' : 'Save Attendance'}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  )
}
