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
import { CONTRACT_ATTENDANCE_OPTIONS } from '@/modules/attendance/status-options'
import type { ContractAttendanceStatus } from '@/modules/attendance/status-options'
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
  const [statuses, setStatuses] = useState<Record<string, ContractAttendanceStatus>>({})
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
    setStatuses({})

    previewHistoricalReconciliationAction({ studentId, groupId, courseId, enrollmentId }).then(res => {
      if (cancelled) return
      if (!res.success) {
        setError(res.error.message)
        setLoading(false)
        return
      }
      if (res.data.sessions.length === 0) {
        // No completed session is eligible for this new contract yet.
        // Keep this step visible. Staff must explicitly acknowledge that the
        // new contract starts from the next session.
        setPreview(res.data)
        setSelectedIds(new Set())
        setChoiceMode('NEXT_ONLY')
        setLoading(false)
        return
      }
      setPreview(res.data)
      setStatuses(Object.fromEntries(res.data.sessions.map(session => [session.schedule_id, session.attendance_status ?? 'present'])))
      setSelectedIds(new Set(res.data.sessions.map(s => s.schedule_id)))
      setLoading(false)
    }).catch(() => {
      if (!cancelled) { setError('Could not load session history. Please close and try again.'); setLoading(false) }
    })

    return () => { cancelled = true }
  }, [open, studentId, groupId, courseId, enrollmentId])

  if (!open) return null

  function buildChoice(): ReconciliationChoice {
    if (choiceMode === 'NEXT_ONLY') return { mode: 'NEXT_ONLY' }
    if (choiceMode === 'ALL')       return { mode: 'ALL', statuses }
    return { mode: 'MANUAL', scheduleIds: [...selectedIds], statuses }
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
    try {
      const res = await applyHistoricalReconciliationAction({
        studentId, groupId, courseId, enrollmentId, choice,
        shortfallResolution: shortfall > 0 ? shortfallResolution : undefined,
      })
      if (!res.success) {
        setError(res.error.message)
        return
      }
      if (res.data.cancelled) {
        onClose()
        return
      }
      onResolved({ applied: true, result: res.data })
    } catch {
      setError('Could not save attendance. Your selections are still here; please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog" aria-modal="true" aria-label="Historical Session Reconciliation"
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={event => event.stopPropagation()}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
          <h2 className="text-base font-bold text-[#0B1F3A]">Historical Session Reconciliation</h2>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0B1F3A]" aria-label="Close">✕</button>
        </div>

        <WizardStepper steps={['Choose', 'Confirm']} currentStep={step} />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {loading && <p className="py-8 text-center text-sm text-[#64748B]">Loading session history…</p>}

          {error && (
            <div className="mb-4 rounded-lg border border-[#FECACA] bg-[#FEE2E2] px-3 py-2 text-sm text-[#EF4444]">
              {error}
            </div>
          )}

          {!loading && preview && step === 1 && (
            <>
              {preview.sessions.length > 0 ? (
                <p className="mb-3 text-sm text-[#475569]">
                  This group has <strong>{preview.sessions.length}</strong> completed session(s) not linked to another contract. Choose exactly which ones belong to this contract.
                </p>
              ) : (
                <p className="mb-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-sm text-[#1D4ED8]">
                  There are no completed sessions available to load onto this contract. It will start from the next session.
                </p>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className={`${CARD_BASE} ${choiceMode === 'ALL' ? CARD_ACTIVE : CARD_INACTIVE}`}
                  onClick={() => setChoiceMode('ALL')}
                >
                  <div className="text-sm font-bold text-[#0B1F3A]">Apply All</div>
                  <div className="text-xs text-[#64748B]">Record missing attendance where needed and consume these contract sessions.</div>
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

              {choiceMode !== 'NEXT_ONLY' && preview.sessions.length > 0 && (
                <div className="mt-4 space-y-2 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-3">
                  <p className="text-xs font-semibold leading-5 text-[#475569]">Set attendance for each selected session. Present, absent, late, excused, and makeup each consume one contract session.</p>
                  {preview.sessions.map(s => (
                    <div key={s.schedule_id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E2E8F0] bg-white p-3">
                      <label className="flex min-w-0 flex-1 items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={choiceMode === 'ALL' || selectedIds.has(s.schedule_id)}
                        disabled={choiceMode === 'ALL'}
                        onChange={e => {
                          setSelectedIds(prev => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(s.schedule_id)
                            else next.delete(s.schedule_id)
                            return next
                          })
                        }}
                      />
                      <span className="min-w-0">
                      <span className="block font-semibold text-[#0B1F3A]">
                        {s.session_number ? `Lesson ${s.session_number}` : 'Session'}
                      </span>
                      <span className="mt-1 block break-words text-xs font-medium leading-5 text-[#475569]">
                        {new Date(s.scheduled_at).toLocaleDateString('en-GB')}{s.topic ? ` — ${s.topic}` : ''}
                      </span>
                      </span>
                      </label>
                      <select aria-label={`Attendance for ${s.session_number ? `lesson ${s.session_number}` : s.schedule_id}`}
                        value={statuses[s.schedule_id] ?? s.attendance_status ?? 'present'}
                        disabled={choiceMode === 'MANUAL' && !selectedIds.has(s.schedule_id)}
                        onChange={event => setStatuses(previous => ({ ...previous, [s.schedule_id]: event.target.value as ContractAttendanceStatus }))}
                        className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-semibold text-[#0B1F3A] outline-none focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/20 disabled:opacity-40">
                        {CONTRACT_ATTENDANCE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </div>
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
              {selectedCount > 0 && <div className="mt-4 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-3">
                <p className="mb-2 text-xs font-bold text-[#0B1F3A]">Selected attendance</p>
                {preview.sessions.filter(session => choiceMode === 'ALL' || (choiceMode === 'MANUAL' && selectedIds.has(session.schedule_id))).map(session => <p key={session.schedule_id} className="flex justify-between gap-3 py-1 text-xs font-medium text-[#475569]">
                  <span>{new Date(session.scheduled_at).toLocaleDateString('en-GB')}{session.session_number ? ` · Lesson ${session.session_number}` : ''}</span>
                  <span className="font-semibold capitalize text-[#0B1F3A]">{statuses[session.schedule_id] ?? session.attendance_status ?? 'present'}</span>
                </p>)}
              </div>}

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
