'use client'

// Historical Enrollment Reconciliation — the ONE dialog every enrollment path
// shows when a student joins a group that already has completed sessions.
// Two usage modes:
//   - mode="apply" (default): the enrollment already exists (e.g. after
//     enrollStudentFull) — the dialog calls applyHistoricalReconciliationAction
//     itself and reports the result.
//   - mode="resolve": the enrollment/group_students row hasn't been written
//     yet (e.g. StudentFormModal, before its form submits) — the dialog only
//     returns the staff's choice; the caller's server action applies it via
//     reconcileGroupJoin after it creates the membership.
//
// All counts/eligibility/impact come from the server (previewHistoricalReconciliation)
// — this component never computes them client-side.

import { useEffect, useState } from 'react'
import { WizardStepper } from '@/components/ui/WizardStepper'
import {
  previewHistoricalReconciliationAction,
  applyHistoricalReconciliationAction,
  type PreviewHistoricalReconciliationResult,
  type ReconciliationChoice,
  type ShortfallResolution,
  type ApplyHistoricalReconciliationResult,
} from '@/modules/enrollments/historical-reconciliation'

export type HistoricalReconciliationResolution =
  | { applied: true;  result: ApplyHistoricalReconciliationResult }
  | { applied: false; choice: ReconciliationChoice; shortfallResolution?: ShortfallResolution }

interface HistoricalReconciliationDialogProps {
  open:          boolean
  studentId:     string
  groupId:       string
  courseId?:     string | null
  enrollmentId?: string | null
  mode?:         'apply' | 'resolve'
  onResolved:    (resolution: HistoricalReconciliationResolution) => void
  onClose:       () => void
}

type ChoiceMode = 'ALL' | 'MANUAL' | 'NEXT_ONLY'

const CARD_BASE =
  'flex-1 rounded-xl border-2 px-4 py-3 text-left transition cursor-pointer'
const CARD_ACTIVE = 'border-[#FF8A1F] bg-[#FFF7ED]'
const CARD_INACTIVE = 'border-[#E2E8F0] bg-white hover:border-[#FDBA74]'

export function HistoricalReconciliationDialog({
  open, studentId, groupId, courseId, enrollmentId, mode = 'apply', onResolved, onClose,
}: HistoricalReconciliationDialogProps) {
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [preview, setPreview]   = useState<PreviewHistoricalReconciliationResult | null>(null)
  const [step, setStep]         = useState<1 | 2>(1)
  const [choiceMode, setChoiceMode] = useState<ChoiceMode>('ALL')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [shortfallResolution, setShortfallResolution] = useState<ShortfallResolution>('CONSUME_WHAT_FITS')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setStep(1)
    setChoiceMode('ALL')
    setShortfallResolution('CONSUME_WHAT_FITS')

    previewHistoricalReconciliationAction({ studentId, groupId, courseId, enrollmentId }).then(res => {
      if (cancelled) return
      if (!res.success) {
        setError(res.error.message)
        setLoading(false)
        return
      }
      if (res.data.sessions.length === 0) {
        // Nothing historical to reconcile — skip silently, no dialog shown.
        onResolved({ applied: false, choice: { mode: 'NEXT_ONLY' } })
        return
      }
      setPreview(res.data)
      setSelectedIds(new Set(res.data.sessions.map(s => s.schedule_id)))
      setLoading(false)
    })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, studentId, groupId, courseId, enrollmentId])

  if (!open) return null

  function buildChoice(): ReconciliationChoice {
    if (choiceMode === 'NEXT_ONLY') return { mode: 'NEXT_ONLY' }
    if (choiceMode === 'ALL')       return { mode: 'ALL' }
    return { mode: 'MANUAL', scheduleIds: [...selectedIds] }
  }

  const selectedCount = choiceMode === 'NEXT_ONLY' ? 0 : choiceMode === 'ALL' ? (preview?.sessions.length ?? 0) : selectedIds.size
  const remaining     = preview?.enrollment?.remaining_sessions ?? 0
  const unlimited     = preview?.enrollment ? (preview.enrollment.allow_overdraft_sessions || preview.enrollment.enrolled_sessions === 0) : false
  const shortfall      = unlimited ? 0 : Math.max(0, selectedCount - remaining)
  const noContract      = !preview?.enrollment

  async function handleConfirm() {
    const choice = buildChoice()

    if (mode === 'resolve') {
      onResolved({ applied: false, choice, shortfallResolution: shortfall > 0 ? shortfallResolution : undefined })
      return
    }

    if (choice.mode !== 'NEXT_ONLY' && !preview?.enrollment) {
      setError('No active contract for this course — cannot consume sessions. Choose "Start from next session" instead.')
      return
    }

    setSubmitting(true)
    setError(null)
    const res = await applyHistoricalReconciliationAction({
      studentId, groupId, courseId, enrollmentId, choice,
      shortfallResolution: shortfall > 0 ? shortfallResolution : undefined,
    })
    setSubmitting(false)
    if (!res.success) {
      setError(res.error.message)
      return
    }
    if (res.data.cancelled) {
      onClose()
      return
    }
    onResolved({ applied: true, result: res.data })
  }

  return (
    <div className="fixed inset-0 z-90 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <h2 className="text-base font-bold text-[#0B1F3A]">Historical Session Reconciliation</h2>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0B1F3A]" aria-label="Close">✕</button>
        </div>

        <WizardStepper steps={['Choose', 'Confirm']} currentStep={step} />

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {loading && <p className="py-8 text-center text-sm text-[#64748B]">Loading session history…</p>}

          {error && (
            <div className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEE2E2] px-3 py-2 text-sm text-[#EF4444]">
              {error}
            </div>
          )}

          {!loading && preview && step === 1 && (
            <>
              <p className="mb-3 text-sm text-[#475569]">
                This group already has <strong>{preview.sessions.length}</strong> completed session(s) this student wasn&apos;t marked attendance for. Choose how to handle them.
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className={`${CARD_BASE} ${choiceMode === 'ALL' ? CARD_ACTIVE : CARD_INACTIVE}`}
                  onClick={() => setChoiceMode('ALL')}
                >
                  <div className="text-sm font-bold text-[#0B1F3A]">Apply All</div>
                  <div className="text-xs text-[#64748B]">Mark every past session present and consume the matching contract sessions.</div>
                </button>
                <button
                  type="button"
                  className={`${CARD_BASE} ${choiceMode === 'MANUAL' ? CARD_ACTIVE : CARD_INACTIVE}`}
                  onClick={() => setChoiceMode('MANUAL')}
                >
                  <div className="text-sm font-bold text-[#0B1F3A]">Select Manually</div>
                  <div className="text-xs text-[#64748B]">Pick exactly which past sessions to apply.</div>
                </button>
                <button
                  type="button"
                  className={`${CARD_BASE} ${choiceMode === 'NEXT_ONLY' ? CARD_ACTIVE : CARD_INACTIVE}`}
                  onClick={() => setChoiceMode('NEXT_ONLY')}
                >
                  <div className="text-sm font-bold text-[#0B1F3A]">Start From Next Session</div>
                  <div className="text-xs text-[#64748B]">No historical attendance or consumption.</div>
                </button>
              </div>

              {choiceMode === 'MANUAL' && (
                <div className="mt-4 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-[#E2E8F0] p-2">
                  {preview.sessions.map(s => (
                    <label key={s.schedule_id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[#F8FAFC]">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.schedule_id)}
                        onChange={e => {
                          setSelectedIds(prev => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(s.schedule_id)
                            else next.delete(s.schedule_id)
                            return next
                          })
                        }}
                      />
                      <span className="font-medium text-[#0B1F3A]">
                        {s.session_number ? `Lesson ${s.session_number}` : 'Session'}
                      </span>
                      <span className="text-[#94A3B8]">
                        {new Date(s.scheduled_at).toLocaleDateString()}{s.topic ? ` — ${s.topic}` : ''}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-full bg-[#FF8A1F] px-5 py-2 text-sm font-bold text-white hover:brightness-105"
                >
                  Next
                </button>
              </div>
            </>
          )}

          {!loading && preview && step === 2 && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <StatTile label="Completed" value={preview.sessions.length} />
                <StatTile label="Selected" value={selectedCount} />
                <StatTile label="Contract Remaining" value={noContract ? '—' : remaining} />
                <StatTile label="Will Consume" value={unlimited ? selectedCount : Math.min(selectedCount, remaining)} />
                <StatTile label="Remaining After" value={noContract ? '—' : Math.max(0, remaining - (unlimited ? selectedCount : Math.min(selectedCount, remaining)))} />
                <StatTile label="Shortfall" value={shortfall} highlight={shortfall > 0} />
              </div>

              {noContract && selectedCount > 0 && (
                <div className="mt-4 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-sm text-[#B45309]">
                  No active contract for this course — historical sessions cannot be consumed until one exists. Choose &quot;Start From Next Session&quot; or add a contract first.
                </div>
              )}

              {!noContract && shortfall > 0 && (
                <div className="mt-4 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3">
                  <p className="text-sm font-semibold text-[#B45309]">
                    {shortfall} session(s) exceed the remaining contract balance ({remaining} remaining).
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {([
                      ['CONSUME_WHAT_FITS', `Consume only ${remaining} — leave the rest unrecorded`],
                      ['UNPAID_PENDING',    'Continue anyway — mark the rest as unpaid, pending reconciliation'],
                      ['CANCEL',            'Cancel — don’t apply anything'],
                    ] as const).map(([val, label]) => (
                      <label key={val} className="flex items-center gap-2 text-sm text-[#0B1F3A]">
                        <input
                          type="radio"
                          name="shortfall"
                          checked={shortfallResolution === val}
                          onChange={() => setShortfallResolution(val)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 flex justify-between">
                <button type="button" onClick={() => setStep(1)} className="rounded-full border-2 border-[#E2E8F0] px-5 py-2 text-sm font-bold text-[#0B1F3A]">
                  Back
                </button>
                <button
                  type="button"
                  disabled={submitting || (noContract && selectedCount > 0 && shortfallResolution !== 'CANCEL')}
                  onClick={handleConfirm}
                  className="rounded-full bg-[#FF8A1F] px-5 py-2 text-sm font-bold text-white hover:brightness-105 disabled:opacity-50"
                >
                  {submitting ? 'Applying…' : 'Confirm'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function StatTile({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-2 py-2.5 ${highlight ? 'border-[#FDE68A] bg-[#FFFBEB]' : 'border-[#E2E8F0] bg-[#F8FAFC]'}`}>
      <div className={`text-lg font-extrabold ${highlight ? 'text-[#B45309]' : 'text-[#0B1F3A]'}`}>{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</div>
    </div>
  )
}
