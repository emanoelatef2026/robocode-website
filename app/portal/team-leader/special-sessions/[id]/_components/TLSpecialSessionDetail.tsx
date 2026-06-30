'use client'

import { useState, useTransition, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import {
  addTrialStudentFromLead,
  addTrialStudentNew,
  addMakeupStudent,
  startSpecialSession,
  endTrialSession,
  endMakeupSession,
  postponeSpecialSession,
} from '@/modules/special-sessions/actions'
import type { TrialSession, MakeupSession } from '@/modules/special-sessions/types'
import StatusBadge from '@/components/admin/StatusBadge'
import type { ActionResult } from '@/types/app'

type Props =
  | { type: 'trial';  trialSession: TrialSession;  makeupSession?: undefined; leads: { id: string; child_name: string; parent_name: string | null; phone: string | null; status: string }[] }
  | { type: 'makeup'; makeupSession: MakeupSession; trialSession?: undefined; leads: [] }

const INITIAL: ActionResult<{ studentId: string }> = { success: false, error: { code: '', message: '' } }

export default function TLSpecialSessionDetail(props: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const isTrial  = props.type === 'trial'
  const session  = isTrial ? props.trialSession! : props.makeupSession!
  const isActive = session.status === 'ongoing' || session.status === 'scheduled'

  const badgeColor = isTrial ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
  const badgeLabel = isTrial ? '🟣 Trial Session' : '🟠 Makeup Session'

  function handleStart() {
    startTransition(async () => { await startSpecialSession(session.id); router.refresh() })
  }
  function handleEnd() {
    startTransition(async () => {
      if (isTrial) await endTrialSession(session.id)
      else await endMakeupSession(session.id)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeColor}`}>{badgeLabel}</span>
            <StatusBadge status={session.status} dot />
          </div>
          <h1 className="text-[18px] font-bold text-[#0B1F3A]">
            {new Date(session.scheduled_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h1>
          <p className="text-[13px] text-[#64748B]">
            {new Date(session.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            {' · '}{session.duration_minutes} min · {session.branch_name}
          </p>
          {session.instructor_name && (
            <p className="text-[13px] text-[#64748B]">Instructor: {session.instructor_name}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {session.status === 'scheduled' && (
            <button onClick={handleStart} disabled={pending}
              className="rounded-lg bg-[#3B82F6] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60 hover:bg-[#2563EB]">
              Start
            </button>
          )}
          {session.status === 'ongoing' && (
            <button onClick={handleEnd} disabled={pending}
              className="rounded-lg bg-[#10B981] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60 hover:bg-[#059669]">
              End Session
            </button>
          )}
        </div>
      </div>

      {session.notes && (
        <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <p className="text-[11px] font-semibold text-[#64748B] mb-1">Notes</p>
          <p className="text-[13px] text-[#0B1F3A]">{session.notes}</p>
        </div>
      )}

      {/* Student panels */}
      {isTrial ? (
        <TrialStudentsPanel session={props.trialSession!} leads={props.leads} isActive={isActive} />
      ) : (
        <MakeupStudentsPanel session={props.makeupSession!} isActive={isActive} />
      )}
    </div>
  )
}

// ── Trial Students Panel ──────────────────────────────────────────────────────

function TrialStudentsPanel({
  session, leads, isActive,
}: {
  session: TrialSession
  leads: { id: string; child_name: string; parent_name: string | null; phone: string | null; status: string }[]
  isActive: boolean
}) {
  const router = useRouter()
  const [addMode, setAddMode] = useState<'none' | 'lead' | 'new'>('none')

  const [fromLeadState, fromLeadAction, fromLeadPending] = useActionState(
    async (_prev: ActionResult<{ studentId: string }>, formData: FormData) => {
      const result = await addTrialStudentFromLead(_prev, formData)
      if (result.success) { setAddMode('none'); router.refresh() }
      return result
    },
    INITIAL
  )

  const [newStudentState, newStudentAction, newStudentPending] = useActionState(
    async (_prev: ActionResult<{ studentId: string }>, formData: FormData) => {
      const result = await addTrialStudentNew(_prev, formData)
      if (result.success) { setAddMode('none'); router.refresh() }
      return result
    },
    INITIAL
  )

  return (
    <div className="ds-card overflow-hidden">
      <div className="border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-[#0B1F3A]">Trial Students ({session.students.length})</h2>
        {isActive && addMode === 'none' && (
          <div className="flex gap-2">
            <button onClick={() => setAddMode('lead')}
              className="rounded-lg bg-[#F1F5F9] px-3 py-1.5 text-[12px] font-semibold text-[#0B1F3A] hover:bg-[#E2E8F0]">
              From Lead
            </button>
            <button onClick={() => setAddMode('new')}
              className="rounded-lg bg-[#A855F7] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#9333EA]">
              New Student
            </button>
          </div>
        )}
        {addMode !== 'none' && (
          <button onClick={() => setAddMode('none')} className="text-[12px] text-[#64748B] hover:underline">Cancel</button>
        )}
      </div>

      {/* Add from lead */}
      {addMode === 'lead' && (
        <form action={fromLeadAction} className="border-b border-[#E2E8F0] p-4 space-y-3 bg-purple-50">
          {!fromLeadState.success && fromLeadState.error?.message && <p className="text-[12px] text-red-600">{fromLeadState.error.message}</p>}
          <input type="hidden" name="schedule_id" value={session.id} />
          <div>
            <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Select Lead</label>
            <select name="lead_id" required className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px]">
              <option value="">-- Select a lead --</option>
              {leads.map(l => (
                <option key={l.id} value={l.id}>
                  {l.child_name} {l.phone ? `· ${l.phone}` : ''} ({l.status})
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={fromLeadPending}
            className="rounded-lg bg-[#A855F7] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
            {fromLeadPending ? 'Adding…' : 'Add Lead'}
          </button>
        </form>
      )}

      {/* Add new student */}
      {addMode === 'new' && (
        <form action={newStudentAction} className="border-b border-[#E2E8F0] p-4 space-y-3 bg-purple-50">
          {!newStudentState.success && newStudentState.error?.message && <p className="text-[12px] text-red-600">{newStudentState.error.message}</p>}
          <input type="hidden" name="schedule_id" value={session.id} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Student Name *</label>
              <input type="text" name="student_name" required placeholder="Full name"
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px]" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Parent Phone *</label>
              <input type="text" name="parent_phone" required placeholder="+20..."
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
          <button type="submit" disabled={newStudentPending}
            className="rounded-lg bg-[#A855F7] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
            {newStudentPending ? 'Adding…' : 'Add Student'}
          </button>
        </form>
      )}

      {session.students.length === 0 ? (
        <div className="px-4 py-8 text-center text-[13px] text-[#94A3B8]">No students registered yet.</div>
      ) : (
        <div className="divide-y divide-[#F1F5F9]">
          {session.students.map(s => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-[13px] font-semibold text-[#0B1F3A]">{s.student_name}</p>
                <p className="text-[11px] text-[#64748B]">
                  {s.parent_phone ? `Parent: ${s.parent_phone}` : ''}
                  {s.lead_id ? ' · Linked to lead' : ' · Ad-hoc'}
                </p>
              </div>
              {s.attendance_status && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  s.attendance_status === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {s.attendance_status === 'present' ? 'Present' : 'Absent'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Makeup Students Panel ─────────────────────────────────────────────────────

function MakeupStudentsPanel({ session, isActive }: { session: MakeupSession; isActive: boolean }) {
  const router = useRouter()
  const [addMode, setAddMode] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')

  const [addState, addAction, addPending] = useActionState(
    async (_prev: ActionResult<{ studentId: string }>, formData: FormData) => {
      const result = await addMakeupStudent(_prev, formData)
      if (result.success) { setAddMode(false); router.refresh() }
      return result
    },
    INITIAL
  )

  return (
    <div className="ds-card overflow-hidden">
      <div className="border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-[#0B1F3A]">Makeup Students ({session.students.length})</h2>
        {isActive && !addMode && (
          <button onClick={() => setAddMode(true)}
            className="rounded-lg bg-[#F59E0B] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#D97706]">
            + Add Student
          </button>
        )}
        {addMode && (
          <button onClick={() => setAddMode(false)} className="text-[12px] text-[#64748B] hover:underline">Cancel</button>
        )}
      </div>

      {addMode && (
        <form action={addAction} className="border-b border-[#E2E8F0] p-4 space-y-3 bg-orange-50">
          {!addState.success && addState.error?.message && <p className="text-[12px] text-red-600">{addState.error.message}</p>}
          <input type="hidden" name="schedule_id" value={session.id} />
          <div>
            <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Student ID</label>
            <input type="text" name="student_id" required placeholder="Student UUID"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] font-mono" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Mode</label>
            <select name="mode" required className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px]">
              <option value="EXTRA">Extra (+1 session consumed)</option>
              <option value="REPLACE_MISSED">Replace Missed (no consumption)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Missed Session ID (for REPLACE_MISSED)</label>
            <input type="text" name="replaced_session_id" placeholder="Optional – schedule UUID"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] font-mono" />
          </div>
          <button type="submit" disabled={addPending}
            className="rounded-lg bg-[#F59E0B] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
            {addPending ? 'Adding…' : 'Add Student'}
          </button>
        </form>
      )}

      {session.students.length === 0 ? (
        <div className="px-4 py-8 text-center text-[13px] text-[#94A3B8]">No students added yet.</div>
      ) : (
        <div className="divide-y divide-[#F1F5F9]">
          {session.students.map(s => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-[13px] font-semibold text-[#0B1F3A]">{s.student_name}</p>
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
              {s.attendance_status && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  s.attendance_status === 'present' ? 'bg-green-100 text-green-700' :
                  s.attendance_status === 'late'    ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {s.attendance_status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
