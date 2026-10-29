'use client'

import { useState, useActionState, useEffect, startTransition } from 'react'
import StudentSessionDialog from './StudentSessionDialog'
import { createStudentNote } from '@/modules/instructor-portal/actions'
import WorkflowNotice from './WorkflowNotice'
import { recoverInstructorAction } from '@/modules/instructor-portal/ux'

const saveNote = recoverInstructorAction(createStudentNote)

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
  const [state, action, pending] = useActionState(saveNote, null)
  const [category, setCategory] = useState('GENERAL')
  const [severity, setSeverity] = useState('LOW')

  useEffect(() => {
    if (state?.success) onClose()
  }, [state?.success, onClose])

  return (
    <form onSubmit={event => { event.preventDefault(); if (pending) return; const data = new FormData(event.currentTarget); startTransition(() => action(data)) }} className="space-y-3">
      <input type="hidden" name="student_id"  value={studentId} />
      <input type="hidden" name="group_id"    value={groupId} />
      <input type="hidden" name="category"    value={category} />
      <input type="hidden" name="severity"    value={severity} />
      {scheduleId && <input type="hidden" name="schedule_id" value={scheduleId} />}

      {state && !state.success && (
        <WorkflowNotice tone="error">
          {state.error.message}
        </WorkflowNotice>
      )}

      {/* Category */}
      <div>
        <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#94A3B8]">
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
                  ? 'border-[#C2410C] bg-[#FFF7ED] text-[#C2410C]'
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
        <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-[#94A3B8]">
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
        className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#C2410C] focus:outline-none"
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
            className="rounded-lg bg-[#C2410C] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#9A3412] disabled:opacity-60 transition">
            {pending ? 'Saving…' : 'Add Note'}
          </button>
        </div>
      </div>
    </form>
  )
}

export default function StudentNoteModal({ studentId, studentName, groupId, scheduleId }: Props) {
  const [open, setOpen] = useState(false)

  const close = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        aria-label={`Add note for ${studentName}`}
        title="Add student note"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#475569] transition hover:bg-[#FFF7ED] hover:text-[#9A3412] focus-visible:outline-2 focus-visible:outline-[#0E7490]"
      >
        <span className="text-[15px]">📝</span>
      </button>

      {open && (
        <StudentSessionDialog title="Add Note" studentName={studentName} onClose={close}>
            <NoteForm
              studentId={studentId}
              studentName={studentName}
              groupId={groupId}
              scheduleId={scheduleId}
              onClose={close}
            />
        </StudentSessionDialog>
      )}
    </>
  )
}
