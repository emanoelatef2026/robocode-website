'use client'

import { useActionState, useState } from 'react'
import { createStudentNote } from '@/modules/instructor-portal/actions'

const CATEGORIES = [
  { value: 'GENERAL',         label: 'General' },
  { value: 'ACADEMIC',        label: 'Academic' },
  { value: 'BEHAVIOR',        label: 'Behavior' },
  { value: 'PARENT_FOLLOWUP', label: 'Parent Follow-up' },
]

const SEVERITIES = [
  { value: 'LOW',    label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH',   label: 'High' },
]

interface Props {
  studentId: string
  groupId:   string
}

export default function NoteForm({ studentId, groupId }: Props) {
  const [state, action, pending] = useActionState(createStudentNote, null)
  const [category, setCategory] = useState('GENERAL')
  const [severity, setSeverity] = useState('LOW')

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="group_id"   value={groupId} />
      <input type="hidden" name="category"   value={category} />
      <input type="hidden" name="severity"   value={severity} />

      {state && !state.success && (
        <div className="rounded-lg border border-[#FECACA] bg-[#FEE2E2] px-3 py-2 text-xs text-[#DC2626]">
          {state.error.message}
        </div>
      )}
      {state?.success && (
        <div className="rounded-lg border border-[#A7F3D0] bg-[#E7F8EE] px-3 py-2 text-xs text-[#15803D]">
          Note saved.
        </div>
      )}

      {/* Category selector */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Category</p>
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

      {/* Severity selector */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Severity</p>
        <div className="flex gap-1.5">
          {SEVERITIES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSeverity(s.value)}
              className={`flex-1 rounded-md border px-2 py-1 text-xs font-medium transition ${
                severity === s.value
                  ? s.value === 'LOW'
                    ? 'border-[#A7F3D0] bg-[#E7F8EE] text-[#15803D]'
                    : s.value === 'MEDIUM'
                      ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]'
                      : 'border-[#FECACA] bg-[#FEE2E2] text-[#DC2626]'
                  : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#94A3B8]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <textarea
        name="content"
        required
        rows={3}
        placeholder="Write a note about this student…"
        className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
      />

      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-[#64748B] cursor-pointer">
          <input
            type="checkbox"
            name="is_private"
            value="true"
            defaultChecked
            className="accent-[#FF8A1F]"
          />
          Private (only visible to you)
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#FF8A1F] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#e07818] disabled:opacity-60 transition"
        >
          {pending ? 'Saving…' : 'Add Note'}
        </button>
      </div>
    </form>
  )
}
