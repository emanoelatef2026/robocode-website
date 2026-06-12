'use client'

import { useActionState, useState } from 'react'
import { saveAttendance } from '@/modules/instructor-portal/actions'
import type { SessionAttendanceRow } from '@/modules/instructor-portal/types'

interface Props {
  sessionId:    string
  groupId:      string
  rows:         SessionAttendanceRow[]
  currentTopic: string | null
}

type AttStatus = 'present' | 'absent' | 'late' | 'excused' | 'makeup'

const CYCLE: AttStatus[] = ['present', 'absent', 'late', 'excused', 'makeup']

const CHIP: Record<AttStatus, string> = {
  present: 'bg-green-100 text-green-700 ring-green-200',
  absent:  'bg-red-100 text-red-700 ring-red-200',
  late:    'bg-yellow-100 text-yellow-700 ring-yellow-200',
  excused: 'bg-blue-100 text-blue-700 ring-blue-200',
  makeup:  'bg-purple-100 text-purple-700 ring-purple-200',
}

const LABEL: Record<AttStatus, string> = {
  present: 'Present',
  absent:  'Absent',
  late:    'Late',
  excused: 'Excused',
  makeup:  'Makeup',
}

function initStatus(r: SessionAttendanceRow): AttStatus {
  if (r.status && CYCLE.includes(r.status as AttStatus)) return r.status as AttStatus
  return 'present'
}

export default function AttendanceForm({ sessionId, groupId, rows, currentTopic }: Props) {
  const [state, action, pending] = useActionState(saveAttendance, null)

  const [topic, setTopic]     = useState(currentTopic ?? '')
  const [topicTouched, setTopicTouched] = useState(false)

  const [statuses, setStatuses] = useState<Record<string, AttStatus>>(() =>
    Object.fromEntries(rows.map((r) => [r.student_id, initStatus(r)]))
  )
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.student_id, r.notes ?? '']))
  )
  const [expandedNote, setExpandedNote] = useState<string | null>(null)

  const cycleStatus = (studentId: string) => {
    setStatuses((prev) => {
      const cur = prev[studentId] ?? 'present'
      const idx = CYCLE.indexOf(cur)
      return { ...prev, [studentId]: CYCLE[(idx + 1) % CYCLE.length] }
    })
  }

  const setStatus = (studentId: string, st: AttStatus) => {
    setStatuses((prev) => ({ ...prev, [studentId]: st }))
  }

  const markAll = (st: AttStatus) => {
    setStatuses(Object.fromEntries(rows.map((r) => [r.student_id, st])))
  }

  const trimmedTopic = topic.trim()
  const topicValid   = trimmedTopic.length > 0 && trimmedTopic.toLowerCase() !== 'no topic'

  const presentCount = rows.filter((r) => statuses[r.student_id] === 'present').length
  const absentCount  = rows.filter((r) => statuses[r.student_id] === 'absent').length
  const lateCount    = rows.filter((r) => statuses[r.student_id] === 'late').length
  const otherCount   = rows.filter((r) => {
    const s = statuses[r.student_id]
    return s === 'excused' || s === 'makeup'
  }).length

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="group_id"   value={groupId} />
      {rows.map((r) => (
        <input key={r.student_id} type="hidden" name="student_ids[]" value={r.student_id} />
      ))}
      {/* Submit the tracked statuses + notes */}
      {rows.map((r) => (
        <input key={`st_${r.student_id}`} type="hidden" name={`status_${r.student_id}`} value={statuses[r.student_id] ?? 'present'} />
      ))}
      {rows.map((r) => (
        <input key={`nt_${r.student_id}`} type="hidden" name={`notes_${r.student_id}`}  value={notes[r.student_id] ?? ''} />
      ))}

      {/* ── Topic (required) ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3.5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#94A3B8] mb-1.5">
          Session Topic <span className="text-red-500">*</span>
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
              ? 'border-red-300 focus:border-red-400 bg-red-50'
              : 'border-[#E2E8F0] focus:border-[#FF8A1F]'
          }`}
        />
        {topicTouched && !topicValid && (
          <p className="mt-1 text-xs text-red-600">Topic is required before saving attendance.</p>
        )}
      </div>

      {state && !state.success && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {state.error.message}
        </div>
      )}
      {state?.success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          Attendance saved.
        </div>
      )}

      <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-2.5">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold text-[#0B1F3A]">{rows.length} students</span>
            {presentCount > 0 && <span className="text-green-600">{presentCount} present</span>}
            {absentCount  > 0 && <span className="text-red-600">{absentCount} absent</span>}
            {lateCount    > 0 && <span className="text-yellow-600">{lateCount} late</span>}
            {otherCount   > 0 && <span className="text-[#94A3B8]">{otherCount} other</span>}
          </div>
          {rows.length > 0 && (
            <div className="flex items-center gap-1">
              {(['present', 'absent'] as AttStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => markAll(st)}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium ring-1 transition hover:opacity-80 ${CHIP[st]}`}
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
                <div key={r.student_id}>
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    {/* Avatar */}
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[11px] font-bold text-[#3B82F6]">
                      {r.student_name[0]?.toUpperCase() ?? '?'}
                    </div>

                    {/* Name */}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#0B1F3A]">
                      {r.student_name}
                    </span>

                    {/* Note toggle */}
                    <button
                      type="button"
                      title="Add note"
                      onClick={() => setExpandedNote(noteOpen ? null : r.student_id)}
                      className={`shrink-0 rounded p-1 text-[#94A3B8] transition hover:text-[#64748B] ${noteOpen || noteVal ? 'text-[#64748B]' : ''}`}
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M2.5 3A1.5 1.5 0 0 0 1 4.5v.793c.026.009.051.02.076.032L7.674 8.51c.206.1.446.1.652 0l6.598-3.185A.755.755 0 0 1 15 5.293V4.5A1.5 1.5 0 0 0 13.5 3h-11Z" />
                        <path d="M15 6.954 8.978 9.86a2.25 2.25 0 0 1-1.956 0L1 6.954V11.5A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5V6.954Z" />
                      </svg>
                    </button>

                    {/* Status chip — click to cycle, right-click for quick set */}
                    <button
                      type="button"
                      onClick={() => cycleStatus(r.student_id)}
                      title="Click to cycle status"
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 transition active:scale-95 ${CHIP[st]}`}
                    >
                      {LABEL[st]}
                    </button>
                  </div>

                  {/* Quick status buttons row (always visible as small dots under) */}
                  <div className="flex gap-1 px-4 pb-2">
                    {CYCLE.map((s) => (
                      <button
                        key={s}
                        type="button"
                        title={LABEL[s]}
                        onClick={() => setStatus(r.student_id, s)}
                        className={[
                          'h-2 flex-1 rounded-full transition',
                          s === st ? CHIP[s].split(' ')[0] : 'bg-[#F1F5F9] hover:bg-[#E2E8F0]',
                        ].join(' ')}
                      />
                    ))}
                  </div>

                  {/* Note input */}
                  {(noteOpen || noteVal) && (
                    <div className="px-4 pb-3">
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
