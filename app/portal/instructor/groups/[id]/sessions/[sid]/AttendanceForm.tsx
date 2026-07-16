'use client'

import { useActionState, useState } from 'react'
import { saveAttendance } from '@/modules/instructor-portal/actions'
import type { SessionAttendanceRow } from '@/modules/instructor-portal/types'
import Link from 'next/link'
import StudentNoteModal from '@/components/portal/instructor/StudentNoteModal'
import StudentEvaluationModal from '@/components/portal/instructor/StudentEvaluationModal'

interface Props {
  sessionId:    string
  groupId:      string
  rows:         SessionAttendanceRow[]
  currentTopic: string | null
}

type AttStatus = 'present' | 'absent' | 'late' | 'excused' | 'makeup'

const STATUSES: AttStatus[] = ['present', 'absent', 'late', 'excused', 'makeup']

const CHIP_ACTIVE: Record<AttStatus, string> = {
  present: 'bg-[#10B981] text-white',
  absent:  'bg-[#EF4444] text-white',
  late:    'bg-yellow-500 text-white',
  excused: 'bg-[#3B82F6] text-white',
  makeup:  'bg-purple-500 text-white',
}

const CHIP_INACTIVE = 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'

const LABEL: Record<AttStatus, string> = {
  present: 'Present',
  absent:  'Absent',
  late:    'Late',
  excused: 'Excused',
  makeup:  'Makeup',
}

const SUMMARY_CHIP: Record<AttStatus, string> = {
  present: 'bg-[#E7F8EE] text-[#15803D]',
  absent:  'bg-[#FEE2E2] text-[#DC2626]',
  late:    'bg-yellow-100 text-yellow-700',
  excused: 'bg-[#EFF6FF] text-[#1D4ED8]',
  makeup:  'bg-purple-100 text-purple-700',
}

function initStatus(r: SessionAttendanceRow): AttStatus {
  if (r.status && STATUSES.includes(r.status as AttStatus)) return r.status as AttStatus
  return 'present'
}

export default function AttendanceForm({ sessionId, groupId, rows, currentTopic }: Props) {
  const [state, action, pending] = useActionState(saveAttendance, null)

  const [topic, setTopic]             = useState(currentTopic ?? '')
  const [topicTouched, setTopicTouched] = useState(false)

  const [statuses, setStatuses] = useState<Record<string, AttStatus>>(() =>
    Object.fromEntries(rows.map((r) => [r.student_id, initStatus(r)]))
  )
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.student_id, r.notes ?? '']))
  )
  const [expandedNote, setExpandedNote] = useState<string | null>(null)

  const setStatus = (studentId: string, st: AttStatus) => {
    setStatuses((prev) => ({ ...prev, [studentId]: st }))
  }

  const markAll = (st: AttStatus) => {
    setStatuses(Object.fromEntries(rows.map((r) => [r.student_id, st])))
  }

  const trimmedTopic = topic.trim()
  const topicValid   = trimmedTopic.length > 0 && trimmedTopic.toLowerCase() !== 'no topic'

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = rows.filter((r) => statuses[r.student_id] === s).length
    return acc
  }, {} as Record<AttStatus, number>)

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="group_id"   value={groupId} />
      {rows.map((r) => (
        <input key={r.student_id} type="hidden" name="student_ids[]" value={r.student_id} />
      ))}
      {rows.map((r) => (
        <input key={`st_${r.student_id}`} type="hidden" name={`status_${r.student_id}`} value={statuses[r.student_id] ?? 'present'} />
      ))}
      {rows.map((r) => (
        <input key={`nt_${r.student_id}`} type="hidden" name={`notes_${r.student_id}`}  value={notes[r.student_id] ?? ''} />
      ))}

      {/* ── Topic (required) ─────────────────────────────────────────────────── */}
      <div className="ds-card px-4 py-3.5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#94A3B8] mb-1.5">
          Session Topic <span className="text-[#EF4444]">*</span>
        </label>
        <input
          type="text"
          name="topic"
          value={topic}
          onChange={e => { setTopic(e.target.value); setTopicTouched(false) }}
          onBlur={() => setTopicTouched(true)}
          placeholder="Variables &amp; Loops"
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
            topicTouched && !topicValid
              ? 'border-[#FCA5A5] focus:border-[#F87171] bg-[#FEE2E2]'
              : 'border-[#E2E8F0] focus:border-[#FF8A1F]'
          }`}
        />
        {topicTouched && !topicValid && (
          <p className="mt-1 text-xs text-[#EF4444]">Topic is required before saving attendance.</p>
        )}
      </div>

      {state && !state.success && (
        <div className="rounded-lg border border-[#FECACA] bg-[#FEE2E2] px-4 py-2 text-sm text-[#DC2626]">
          {state.error.message}
        </div>
      )}
      {state?.success && (
        <div className="rounded-lg border border-[#A7F3D0] bg-[#E7F8EE] px-4 py-2 text-sm text-[#15803D]">
          Attendance saved.
        </div>
      )}

      <div className="ds-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-[#0B1F3A]">{rows.length} students</span>
            {STATUSES.filter(s => counts[s] > 0).map(s => (
              <span key={s} className={`rounded-full px-2 py-0.5 font-medium ${SUMMARY_CHIP[s]}`}>
                {counts[s]} {LABEL[s].toLowerCase()}
              </span>
            ))}
          </div>
          {rows.length > 0 && (
            <div className="flex items-center gap-1">
              {(['present', 'absent'] as AttStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  aria-label={`Mark all students ${LABEL[st].toLowerCase()}`}
                  onClick={() => markAll(st)}
                  className={`rounded px-2.5 py-1.5 text-[11px] font-medium transition hover:opacity-80 ${CHIP_ACTIVE[st]}`}
                >
                  All {LABEL[st]}
                </button>
              ))}
            </div>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-[#64748B]">
            No students enrolled in this group.
          </div>
        ) : (
          <div className="divide-y divide-[#F8FAFC]">
            {rows.map((r) => {
              const st      = statuses[r.student_id] ?? 'present'
              const noteVal = notes[r.student_id] ?? ''
              const noteOpen = expandedNote === r.student_id

              return (
                <div key={r.student_id} className="px-4 py-3">
                  {/* Row: avatar + name (links to full profile) + quick actions */}
                  <div className="flex items-center gap-3 mb-2">
                    <Link
                      href={`/portal/instructor/groups/${groupId}/students/${r.student_id}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[11px] font-bold text-[#3B82F6]">
                        {r.student_name[0]?.toUpperCase() ?? '?'}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#0B1F3A] hover:underline">
                        {r.student_name}
                      </span>
                    </Link>
                    {/* Attendance note toggle */}
                    <button
                      type="button"
                      aria-label={`Toggle attendance note for ${r.student_name}`}
                      title="Attendance note"
                      onClick={() => setExpandedNote(noteOpen ? null : r.student_id)}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded transition ${noteOpen || noteVal ? 'text-[#64748B]' : 'text-[#94A3B8] hover:text-[#64748B]'}`}
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M2.5 3A1.5 1.5 0 0 0 1 4.5v.793c.026.009.051.02.076.032L7.674 8.51c.206.1.446.1.652 0l6.598-3.185A.755.755 0 0 1 15 5.293V4.5A1.5 1.5 0 0 0 13.5 3h-11Z" />
                        <path d="M15 6.954 8.978 9.86a2.25 2.25 0 0 1-1.956 0L1 6.954V11.5A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5V6.954Z" />
                      </svg>
                    </button>
                    {/* Student note modal */}
                    <StudentNoteModal
                      studentId={r.student_id}
                      studentName={r.student_name}
                      groupId={groupId}
                      scheduleId={sessionId}
                    />
                    {/* Quick evaluation modal */}
                    <StudentEvaluationModal
                      studentId={r.student_id}
                      studentName={r.student_name}
                      groupId={groupId}
                    />
                  </div>

                  {/* Segmented status chips */}
                  <div className="flex gap-1">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(r.student_id, s)}
                        className={[
                          'flex-1 rounded-md py-1 text-[11px] font-semibold transition active:scale-95',
                          s === st ? CHIP_ACTIVE[s] : CHIP_INACTIVE,
                        ].join(' ')}
                      >
                        {LABEL[s]}
                      </button>
                    ))}
                  </div>

                  {/* Note input */}
                  {(noteOpen || noteVal) && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={noteVal}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [r.student_id]: e.target.value }))}
                        placeholder="Attendance note…"
                        className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs placeholder-[#94A3B8] focus:border-[#FF8A1F] focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <button
          type="submit"
          disabled={pending || !topicValid}
          className="w-full rounded-lg bg-[#FF8A1F] py-2.5 text-sm font-semibold text-white transition hover:bg-[#e07818] disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save Attendance'}
        </button>
      )}
    </form>
  )
}
