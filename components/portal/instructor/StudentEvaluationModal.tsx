'use client'

import { useActionState, useState, useEffect, useRef } from 'react'
import { createInstructorEvaluation } from '@/modules/instructor-portal/actions'
import { EVALUATION_CRITERIA, EVALUATION_CRITERION_LABELS } from '@/modules/student-evaluations/types'
import type { EvaluationCriterion } from '@/modules/student-evaluations/types'

interface FieldsProps {
  studentId: string
  groupId:   string
  onSaved?:  () => void
}

// Shared form body — used inline on the Student Workspace and inside the
// Quick Evaluation modal from the session attendance roster. One source of
// truth for the evaluation form so the two surfaces never drift apart.
function EvaluationFields({ studentId, groupId, onSaved }: FieldsProps) {
  const [state, action, pending] = useActionState(createInstructorEvaluation, null)
  const [criterion, setCriterion] = useState<EvaluationCriterion>('ACADEMIC_SKILLS')

  useEffect(() => {
    if (state?.success) onSaved?.()
  }, [state?.success, onSaved])

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
      {state?.success && !onSaved && (
        <div className="rounded-lg border border-[#A7F3D0] bg-[#E7F8EE] px-3 py-2 text-xs text-[#15803D]">
          Evaluation saved.
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Criterion</p>
        <select
          value={criterion}
          onChange={(e) => setCriterion(e.target.value as EvaluationCriterion)}
          aria-label="Evaluation criterion"
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
          aria-label="Custom criterion name"
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
            aria-label="Score out of 100"
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
            aria-label="Rating out of 5"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
          />
        </div>
      </div>

      <textarea
        name="feedback"
        rows={2}
        placeholder="Feedback (optional)…"
        aria-label="Feedback"
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

// ── Inline usage — Student Workspace ────────────────────────────────────────
export function EvaluationForm({ studentId, groupId }: { studentId: string; groupId: string }) {
  return <EvaluationFields studentId={studentId} groupId={groupId} />
}

// ── Modal usage — quick evaluation from the session attendance roster ──────
interface ModalProps {
  studentId:   string
  studentName: string
  groupId:     string
}

export default function StudentEvaluationModal({ studentId, studentName, groupId }: ModalProps) {
  const [open, setOpen] = useState(false)
  const backdropRef = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        aria-label={`Quick-evaluate ${studentName}`}
        title="Quick evaluation"
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded p-1 text-[#94A3B8] transition hover:text-[#FF8A1F]"
      >
        <span className="text-[15px]">⭐</span>
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
                <h3 className="text-sm font-semibold text-[#0B1F3A]">Quick Evaluation</h3>
                <p className="text-xs text-[#64748B]">{studentName}</p>
              </div>
              <button onClick={close} aria-label="Close" className="text-[#94A3B8] hover:text-[#64748B] transition">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <EvaluationFields studentId={studentId} groupId={groupId} onSaved={close} />
          </div>
        </div>
      )}
    </>
  )
}
