'use client'

import { useState, useActionState, useEffect, useRef } from 'react'
import { createStudentNote } from '@/modules/instructor-portal/actions'

const CATEGORIES = [
  { value: 'GENERAL',         label: 'General' },
  { value: 'ACADEMIC',        label: 'Academic' },
  { value: 'BEHAVIOR',        label: 'Behavior' },
  { value: 'PARENT_FOLLOWUP', label: 'Parent Follow-up' },
]

const SEVERITIES = [
  { value: 'LOW',    label: 'Low',    color: 'bg-[#E7F8EE] text-[#15803D] border-[#A7F3D0]' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]' },
  { value: 'HIGH',   label: 'High',   color: 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]' },
]

interface Props {
  studentId:   string
  studentName: string
  groupId:     string
  scheduleId?: string
}

function NoteForm({ studentId, studentName, groupId, scheduleId, onClose }: Props & { onClose: () => void }) {
  const [state, action, pending] = useActionState(createStudentNote, null)
  const [category, setCategory] = useState('GENERAL')
  const [severity, setSeverity] = useState('LOW')

  useEffect(() => {
    if (state?.success) onClose()
  }, [state?.success, onClose])

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="student_id"  value={studentId} />
      <input type="hidden" name="group_id"    value={groupId} />
      <input type="hidden" name="category"    value={category} />
      <input type="hidden" name="severity"    value={severity} />
      {scheduleId && <input type="hidden" name="schedule_id" value={scheduleId} />}

      {state && !state.success && (
        <p className="rounded-lg border border-[#FECACA] bg-[#FEE2E2] px-3 py-2 text-xs text-[#DC2626]">
          {state.error.message}
        </p>
      )}

      {/* Category */}
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
          Category
        </label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                category === c.value
                  ? 'border-[#FF8A1F] bg-[#FFF1E2] text-[#FF8A1F]'
                  : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#94A3B8]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Severity */}
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
          Severity
        </label>
        <div className="flex gap-1.5">
          {SEVERITIES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSeverity(s.value)}
              className={`flex-1 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                severity === s.value ? s.color : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#94A3B8]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <textarea
        name="content"
        required
        rows={3}
        placeholder={`Note about ${studentName}…`}
        className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
      />

      {/* Private + submit */}
      <div className="flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[#64748B]">
          <input type="checkbox" name="is_private" value="true" defaultChecked className="accent-[#FF8A1F]" />
          Private (only you)
        </label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs text-[#64748B] hover:bg-[#F8FAFC] transition">
            Cancel
          </button>
          <button type="submit" disabled={pending}
            className="rounded-lg bg-[#FF8A1F] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#e07818] disabled:opacity-60 transition">
            {pending ? 'Saving…' : 'Add Note'}
          </button>
        </div>
      </div>
    </form>
  )
}

export default function StudentNoteModal({ studentId, studentName, groupId, scheduleId }: Props) {
  const [open, setOpen] = useState(false)
  const backdropRef = useRef<HTMLDivElement>(null)

  const close = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        title="Add student note"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded p-1 text-[#94A3B8] transition hover:text-[#FF8A1F]"
      >
        <span className="text-[15px]">📝</span>
      </button>

      {open && (
        <div
          ref={backdropRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => { if (e.target === backdropRef.current) close() }}
        >
          <div className="w-full max-w-sm rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#0B1F3A]">Add Note</h3>
                <p className="text-xs text-[#64748B]">{studentName}</p>
              </div>
              <button onClick={close} className="text-[#94A3B8] hover:text-[#64748B] transition">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <NoteForm
              studentId={studentId}
              studentName={studentName}
              groupId={groupId}
              scheduleId={scheduleId}
              onClose={close}
            />
          </div>
        </div>
      )}
    </>
  )
}
