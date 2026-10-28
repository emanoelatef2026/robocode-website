'use client'

import { useState } from 'react'
import StudentSessionDialog from './StudentSessionDialog'
import QuickEvaluationFields, { StarIcon } from './QuickEvaluationFields'

export function EvaluationForm({ studentId, groupId }: { studentId: string; groupId: string }) {
  return <QuickEvaluationFields studentId={studentId} groupId={groupId} />
}

export default function StudentEvaluationModal({ studentId, studentName, groupId, scheduleId, reviewMode = false }: { studentId: string; studentName: string; groupId: string; scheduleId?: string; reviewMode?: boolean }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" aria-label={`Quick-evaluate ${studentName}`} title="Quick evaluation" onClick={() => setOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-(--border) text-(--amber-dark) transition hover:bg-(--amber-soft) focus-visible:outline-2 focus-visible:outline-(--cyan-strong)">
      <StarIcon filled />
    </button>
    {open && <StudentSessionDialog title="Quick Evaluation" studentName={studentName} onClose={() => setOpen(false)} wide>
      <QuickEvaluationFields studentId={studentId} groupId={groupId} scheduleId={scheduleId} reviewMode={reviewMode} onSaved={() => setOpen(false)} />
    </StudentSessionDialog>}
  </>
}
