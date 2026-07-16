'use client'

import { useActionState, useState } from 'react'
import { createInstructorEvaluation } from '@/modules/instructor-portal/actions'
import { EVALUATION_CRITERIA, EVALUATION_CRITERION_LABELS } from '@/modules/student-evaluations/types'
import type { EvaluationCriterion } from '@/modules/student-evaluations/types'

interface Props {
  studentId: string
  groupId:   string
}

export default function EvaluationForm({ studentId, groupId }: Props) {
  const [state, action, pending] = useActionState(createInstructorEvaluation, null)
  const [criterion, setCriterion] = useState<EvaluationCriterion>('ACADEMIC_SKILLS')

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="group_id"   value={groupId} />
      <input type="hidden" name="criterion"  value={criterion} />

      {state && !state.success && (
        <div className="rounded-lg border border-[#FECACA] bg-[#FEE2E2] px-3 py-2 text-xs text-[#DC2626]">
          {state.error.message}
        </div>
      )}
      {state?.success && (
        <div className="rounded-lg border border-[#A7F3D0] bg-[#E7F8EE] px-3 py-2 text-xs text-[#15803D]">
          Evaluation saved.
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Criterion</p>
        <select
          value={criterion}
          onChange={(e) => setCriterion(e.target.value as EvaluationCriterion)}
          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
        >
          {EVALUATION_CRITERIA.map((c) => (
            <option key={c} value={c}>{EVALUATION_CRITERION_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {criterion === 'CUSTOM' && (
        <input
          type="text"
          name="custom_label"
          required
          placeholder="Custom criterion name"
          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Score (0-100)</p>
          <input
            type="number"
            name="score"
            min={0}
            max={100}
            placeholder="—"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
          />
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Rating (1-5)</p>
          <input
            type="number"
            name="rating"
            min={1}
            max={5}
            placeholder="—"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
          />
        </div>
      </div>

      <textarea
        name="feedback"
        rows={2}
        placeholder="Feedback (optional)…"
        className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-[#64748B]">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" name="visible_to_student" value="true" defaultChecked className="accent-[#FF8A1F]" />
            Student
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" name="visible_to_parent" value="true" defaultChecked className="accent-[#FF8A1F]" />
            Parent
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#FF8A1F] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#e07818] disabled:opacity-60 transition"
        >
          {pending ? 'Saving…' : 'Add Evaluation'}
        </button>
      </div>
    </form>
  )
}
