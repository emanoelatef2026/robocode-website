'use client'

import { useActionState } from 'react'
import { createStudentNote } from '@/modules/instructor-portal/actions'

interface Props {
  studentId: string
  groupId:   string
}

export default function NoteForm({ studentId, groupId }: Props) {
  const [state, action, pending] = useActionState(createStudentNote, null)

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="group_id"   value={groupId} />

      {state && !state.success && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error.message}
        </div>
      )}
      {state?.success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          Note saved.
        </div>
      )}

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
