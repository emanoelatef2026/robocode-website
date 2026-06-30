'use client'

import { useTransition } from 'react'
import {
  startSpecialSession,
  endTrialSession,
  endMakeupSession,
  saveTrialAttendance,
  saveMakeupAttendance,
} from '@/modules/special-sessions/actions'
import type { TrialSession, MakeupSession } from '@/modules/special-sessions/types'
import StatusBadge from '@/components/admin/StatusBadge'
import { useRouter } from 'next/navigation'

type Props =
  | { type: 'trial';  trialSession:  TrialSession;  makeupSession?: undefined; instructorId: string }
  | { type: 'makeup'; makeupSession: MakeupSession; trialSession?:  undefined; instructorId: string }

export default function SpecialSessionDetail(props: Props) {
  const router    = useRouter()
  const [pending, startTransition] = useTransition()

  const session  = props.type === 'trial' ? props.trialSession! : props.makeupSession!
  const isTrial  = props.type === 'trial'
  const isOngoing = session.status === 'ongoing'
  const isScheduled = session.status === 'scheduled'

  const badgeColor = isTrial
    ? 'bg-purple-100 text-purple-700'
    : 'bg-orange-100 text-orange-700'
  const badgeLabel = isTrial ? 'Trial Session' : 'Standalone Makeup'

  function handleStart() {
    startTransition(async () => {
      await startSpecialSession(session.id)
      router.refresh()
    })
  }

  function handleEnd() {
    startTransition(async () => {
      if (isTrial) {
        await endTrialSession(session.id)
      } else {
        await endMakeupSession(session.id)
      }
      router.refresh()
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
            {new Date(session.scheduled_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h1>
          <p className="text-[13px] text-[#64748B]">
            {new Date(session.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            {' · '}{session.duration_minutes} min
            {' · '}{session.branch_name}
          </p>
        </div>

        <div className="flex gap-2">
          {isScheduled && (
            <button
              onClick={handleStart}
              disabled={pending}
              className="rounded-lg bg-[#3B82F6] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60 hover:bg-[#2563EB]"
            >
              Start Session
            </button>
          )}
          {isOngoing && (
            <button
              onClick={handleEnd}
              disabled={pending}
              className="rounded-lg bg-[#10B981] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60 hover:bg-[#059669]"
            >
              End Session
            </button>
          )}
        </div>
      </div>

      {session.notes && (
        <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <p className="text-[12px] font-semibold text-[#64748B] mb-1">Notes</p>
          <p className="text-[13px] text-[#0B1F3A]">{session.notes}</p>
        </div>
      )}

      {/* Students */}
      {isTrial ? (
        <TrialStudentsPanel session={props.trialSession!} isOngoing={isOngoing} />
      ) : (
        <MakeupStudentsPanel session={props.makeupSession!} isOngoing={isOngoing} />
      )}
    </div>
  )
}

// ── Trial Students Panel ──────────────────────────────────────────────────────

function TrialStudentsPanel({ session, isOngoing }: { session: TrialSession; isOngoing: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleSaveAttendance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await saveTrialAttendance(null, formData)
      router.refresh()
    })
  }

  return (
    <div className="ds-card overflow-hidden">
      <div className="border-b border-[#E2E8F0] px-4 py-3 flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-[#0B1F3A]">Trial Students</h2>
        <span className="text-[12px] text-[#64748B]">{session.students.length} registered</span>
      </div>

      {session.students.length === 0 ? (
        <div className="px-4 py-8 text-center text-[13px] text-[#94A3B8]">
          No students registered yet. Add them via the team leader portal.
        </div>
      ) : (
        <form onSubmit={handleSaveAttendance}>
          <input type="hidden" name="schedule_id" value={session.id} />
          <div className="divide-y divide-[#F1F5F9]">
            {session.students.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#0B1F3A] truncate">{s.student_name}</p>
                  {s.parent_phone && <p className="text-[11px] text-[#64748B]">Parent: {s.parent_phone}</p>}
                </div>
                <select
                  name={`status_${s.id}`}
                  defaultValue={s.attendance_status ?? 'absent'}
                  disabled={!isOngoing}
                  className="rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-[#A855F7] disabled:opacity-60"
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
            ))}
          </div>
          {isOngoing && (
            <div className="border-t border-[#E2E8F0] px-4 py-3">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-[#A855F7] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60 hover:bg-[#9333EA]"
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

// ── Makeup Students Panel ─────────────────────────────────────────────────────

function MakeupStudentsPanel({ session, isOngoing }: { session: MakeupSession; isOngoing: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleSaveAttendance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await saveMakeupAttendance(null, formData)
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
