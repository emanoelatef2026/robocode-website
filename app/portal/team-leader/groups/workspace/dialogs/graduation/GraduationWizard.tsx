'use client'

import { useState, useEffect, useMemo } from 'react'
import { WizardStepper } from '@/components/ui/WizardStepper'
import type { GroupOperationalRow } from '@/modules/groups/operational'
import {
  getGraduationCohortSummary, validateCohortGraduation, listGraduationStudents,
  listTransferTargetGroups, getNextCohortDefaults, previewCohortGraduation,
  getGraduationDraft, saveGraduationDraft, discardGraduationDraft, commitCohortGraduation,
  decisionCountsSummary,
} from '@/modules/groups/actions/graduation'
import type {
  GraduationCohortSummary, GraduationValidation, StudentDecisionRow, GraduationPreview,
  OtherDraftNotice, StaleDraftNotice,
} from '@/modules/groups/actions/graduation'
import type { NextCohortDraft, WizardDecision, GraduationDecision, GraduationStudentDecision } from '@/modules/groups/actions/graduation-helpers'
import { allDecided } from '@/modules/groups/actions/graduation-helpers'

interface Props {
  isOpen:    boolean
  group:     GroupOperationalRow
  onClose:   () => void
  onSuccess: (newGroupId: string) => void
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7

const STEP_LABELS = ['Summary', 'Validation', 'Decisions', 'Next Cohort', 'Preview', 'Confirm', 'Commit']

const DECISION_LABELS: Record<GraduationDecision, string> = {
  continue: 'Continue', graduate: 'Graduate', hold: 'Hold', drop: 'Drop', transfer: 'Transfer', repeat: 'Repeat',
}
const DECISION_COLORS: Record<GraduationDecision, string> = {
  continue: 'bg-[#E7F8EE] text-[#15803D]', graduate: 'bg-[#EFF6FF] text-[#1D4ED8]',
  hold: 'bg-[#FFFBEB] text-[#B45309]', drop: 'bg-[#FEE2E2] text-[#DC2626]',
  transfer: 'bg-[#F5F3FF] text-[#6D28D9]', repeat: 'bg-[#F1F5F9] text-[#475569]',
}

function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin text-[#FF8A1F]`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
    </svg>
  )
}

export function GraduationWizard({ isOpen, group, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>(1)

  // Resume / conflict state
  const [checkingDraft, setCheckingDraft] = useState(false)
  const [resumed, setResumed]             = useState(false)
  const [otherDrafts, setOtherDrafts]     = useState<OtherDraftNotice[]>([])
  const [staleNotice, setStaleNotice]     = useState<StaleDraftNotice | null>(null)
  const [draftId, setDraftId]             = useState<string | null>(null)

  // Step 1
  const [summary, setSummary]               = useState<GraduationCohortSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  // Step 2
  const [validation, setValidation]               = useState<GraduationValidation | null>(null)
  const [validationLoading, setValidationLoading] = useState(false)

  // Step 3
  const [students, setStudents]               = useState<StudentDecisionRow[]>([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [decisions, setDecisions]             = useState<Record<string, WizardDecision>>({})
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>({})
  const [transferOptions, setTransferOptions] = useState<Array<{ id: string; name: string }>>([])
  const [search, setSearch]                   = useState('')
  const [filterDecision, setFilterDecision]   = useState<WizardDecision | 'all'>('all')
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set())

  // Step 4
  const [draft, setDraft]                   = useState<NextCohortDraft | null>(null)
  const [semesterOptions, setSemesterOptions] = useState<Array<{ id: string; name: string }>>([])
  const [draftLoading, setDraftLoading]     = useState(false)

  // Step 5
  const [preview, setPreview]               = useState<GraduationPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Step 6
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [requestId, setRequestId]           = useState<string | null>(null)

  // Step 7
  const [submitting, setSubmitting] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)
  const [result, setResult] = useState<{ new_group_id: string; decision_counts: Partial<Record<GraduationDecision, number>>; replayed: boolean } | null>(null)

  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Lock scroll + escape ──────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // ── Reset + resume on open ────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    setStep(1); setResumed(false); setOtherDrafts([]); setStaleNotice(null); setDraftId(null)
    setSummary(null); setValidation(null); setStudents([]); setDecisions({}); setTransferTargets({})
    setSelectedIds(new Set()); setSearch(''); setFilterDecision('all')
    setDraft(null); setSemesterOptions([]); setPreview(null)
    setConfirmChecked(false); setRequestId(null); setSubmitting(false); setCommitError(null); setResult(null)
    setSaveError(null)

    setCheckingDraft(true)
    getGraduationDraft(group.group_id).then(res => {
      if (!res.success) { setCheckingDraft(false); return }
      setOtherDrafts(res.data.others)
      if (res.data.stale) { setStaleNotice(res.data.stale); setCheckingDraft(false); return }
      if (res.data.own) {
        const own = res.data.own
        setDraftId(own.id)
        setStep((own.step as Step) || 1)
        const d = own.new_group_draft as NextCohortDraft
        if (d && d.branch_id) setDraft(d)
        const decMap: Record<string, WizardDecision> = {}
        for (const entry of own.decisions) decMap[entry.student_id] = entry.decision
        setDecisions(decMap)
        const transferMap: Record<string, string> = {}
        for (const entry of own.decisions) if (entry.transfer_group_id) transferMap[entry.student_id] = entry.transfer_group_id
        setTransferTargets(transferMap)
        setRequestId(own.request_id)
        setResumed(true)
      }
      setCheckingDraft(false)
    })
  }, [isOpen, group.group_id])

  // ── Per-step data loading ────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || checkingDraft || staleNotice) return
    if (step === 1 && !summary) {
      setSummaryLoading(true)
      getGraduationCohortSummary(group.group_id).then(res => {
        if (res.success) setSummary(res.data)
        setSummaryLoading(false)
      })
    }
    if (step === 2) {
      setValidationLoading(true)
      validateCohortGraduation(group.group_id).then(res => {
        if (res.success) setValidation(res.data)
        setValidationLoading(false)
      })
    }
    if (step === 3 && !students.length) {
      setStudentsLoading(true)
      Promise.all([
        listGraduationStudents(group.group_id),
        listTransferTargetGroups(group.branch_id, group.group_id),
      ]).then(([sRes, tRes]) => {
        if (sRes.success) {
          setStudents(sRes.data)
          setDecisions(prev => {
            const next = { ...prev }
            for (const s of sRes.data) if (!(s.student_id in next)) next[s.student_id] = 'undecided'
            return next
          })
        }
        if (tRes.success) setTransferOptions(tRes.data)
        setStudentsLoading(false)
      })
    }
    if (step === 4 && !draft) {
      setDraftLoading(true)
      getNextCohortDefaults(group.group_id).then(res => {
        if (res.success) { setDraft(res.data.draft); setSemesterOptions(res.data.semesterOptions) }
        setDraftLoading(false)
      })
    }
    if (step === 5 && draft) {
      setPreviewLoading(true)
      previewCohortGraduation(group.group_id, draft, decisions).then(res => {
        if (res.success) setPreview(res.data)
        setPreviewLoading(false)
      })
    }
    if (step === 6 && !requestId) {
      setRequestId(crypto.randomUUID())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isOpen, checkingDraft, staleNotice])

  // ── Autosave on step transitions (from step 3 onward) ────────────────────
  function persistDraft(nextStep: Step, extraRequestId?: string) {
    if (nextStep < 3 || !draft) return
    const payload = students.map(s => ({
      student_id: s.student_id,
      decision:   decisions[s.student_id] ?? 'undecided',
      ...(transferTargets[s.student_id] ? { transfer_group_id: transferTargets[s.student_id] } : {}),
    }))
    saveGraduationDraft(group.group_id, nextStep, draft, payload, extraRequestId ?? requestId ?? undefined)
      .then(res => {
        if (res.success) setDraftId(res.data.id)
        else setSaveError(res.error?.message ?? 'Failed to save draft.')
      })
  }

  function goTo(next: Step) {
    persistDraft(next)
    setStep(next)
  }

  async function handleDiscardDraft() {
    await discardGraduationDraft(group.group_id)
    onClose()
  }

  // ── Derived ────────────────────────────────────────────────────────────
  const activeStudentIds = useMemo(() => students.map(s => s.student_id), [students])
  const everyoneDecided  = useMemo(() => allDecided(decisions, activeStudentIds), [decisions, activeStudentIds])

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (filterDecision !== 'all' && (decisions[s.student_id] ?? 'undecided') !== filterDecision) return false
      if (search && !s.student_name.toLowerCase().includes(search.toLowerCase()) && !(s.student_code ?? '').toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [students, decisions, filterDecision, search])

  function setDecisionFor(studentId: string, decision: WizardDecision) {
    setDecisions(prev => ({ ...prev, [studentId]: decision }))
  }

  function bulkApply(decision: WizardDecision | 'recommended') {
    setDecisions(prev => {
      const next = { ...prev }
      for (const id of selectedIds) {
        if (decision === 'recommended') {
          const s = students.find(st => st.student_id === id)
          if (s) next[id] = s.recommended_decision
        } else {
          next[id] = decision
        }
      }
      return next
    })
  }

  function toggleSelectAll() {
    if (filteredStudents.every(s => selectedIds.has(s.student_id))) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredStudents.map(s => s.student_id)))
  }

  async function handleCommit() {
    if (!draft || !requestId) return
    setSubmitting(true)
    setCommitError(null)

    const payloadDecisions: GraduationStudentDecision[] = students.map(s => {
      const decision = decisions[s.student_id] as GraduationDecision
      return {
        student_id:           s.student_id,
        old_enrollment_id:    s.old_enrollment_id,
        old_group_student_id: s.group_student_id,
        decision,
        ...(decision === 'transfer' && transferTargets[s.student_id] ? { transfer_group_id: transferTargets[s.student_id] } : {}),
      }
    })

    const res = await commitCohortGraduation({
      old_group_id: group.group_id,
      request_id:   requestId,
      draft_id:     draftId ?? undefined,
      new_group:    draft,
      decisions:    payloadDecisions,
    })

    setSubmitting(false)
    if (!res.success) { setCommitError(res.error?.message ?? 'Failed to commit graduation.'); return }
    setResult(res.data)
    setStep(7)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8"
      onClick={e => { if (e.target === e.currentTarget && !submitting) onClose() }}
    >
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-[#0B1F3A]">Graduate Cohort</h2>
            <p className="mt-0.5 text-xs text-[#94A3B8]">
              {group.name}{!staleNotice && !checkingDraft ? ` · Step ${step} of 7` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#0B1F3A] disabled:opacity-40"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {!checkingDraft && !staleNotice && <WizardStepper steps={STEP_LABELS} currentStep={step} />}

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* Loading draft check */}
          {checkingDraft && (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-sm text-[#94A3B8]">
              <Spinner className="h-6 w-6" />
              Checking for a saved draft…
            </div>
          )}

          {/* Stale draft — cohort already graduated by someone else */}
          {!checkingDraft && staleNotice && (
            <div className="space-y-4 py-4 text-center">
              <div className="flex items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFFBEB]">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-[#B45309]">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.72-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-.25-6.25a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-base font-bold text-[#0B1F3A]">This cohort was already graduated</p>
                <p className="mt-1 text-sm text-[#64748B]">
                  Someone else completed graduation for this cohort on{' '}
                  {new Date(staleNotice.graduated_at).toLocaleString()} while your draft was still open.
                  Your saved decisions have been archived — nothing was lost, but this draft can no longer be committed.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button onClick={onClose} className="rounded-lg border border-[#E2E8F0] px-5 py-2 text-sm font-medium text-[#374151] hover:bg-[#F8FAFC] transition">
                  Close
                </button>
                {staleNotice.graduated_to_group_id && (
                  <button
                    onClick={() => { onSuccess(staleNotice.graduated_to_group_id as string); onClose() }}
                    className="rounded-lg bg-[#FF8A1F] px-5 py-2 text-sm font-semibold text-white hover:bg-[#e87c18] transition"
                  >
                    View New Cohort →
                  </button>
                )}
              </div>
            </div>
          )}

          {!checkingDraft && !staleNotice && (
            <>
              {resumed && (
                <div className="flex items-center gap-2 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-2.5 text-[12px] text-[#1D4ED8]">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Resuming your saved draft.
                  <button onClick={handleDiscardDraft} className="ml-auto shrink-0 font-semibold text-[#DC2626] hover:underline">
                    Discard &amp; start over
                  </button>
                </div>
              )}
              {otherDrafts.length > 0 && (
                <div className="rounded-xl border border-[#FED7AA] bg-[#FFFBEB] px-4 py-2.5 text-[12px] text-[#B45309]">
                  {otherDrafts.map((o, i) => (
                    <div key={i}>⚠ {o.updated_by_name} also has a graduation draft in progress for this cohort (last edited {new Date(o.updated_at).toLocaleString()}).</div>
                  ))}
                </div>
              )}
              {saveError && (
                <div className="rounded-xl bg-[#FEE2E2] px-4 py-2 text-[12px] text-[#DC2626]">Draft save failed: {saveError}</div>
              )}

              {/* ═══ STEP 1 — Cohort Summary ═══ */}
              {step === 1 && (
                <>
                  {summaryLoading && <div className="flex justify-center py-10"><Spinner /></div>}
                  {summary && (
                    <>
                      {summary.already_graduated ? (
                        <div className="rounded-xl bg-[#FEF2F2] border border-[#FECACA] px-4 py-3 text-sm text-[#B91C1C]">
                          This cohort has already been graduated.
                          {summary.graduated_to_group_id && (
                            <button onClick={() => { onSuccess(summary.graduated_to_group_id as string); onClose() }} className="ml-2 font-semibold underline">
                              View New Cohort →
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] divide-y divide-[#F1F5F9]">
                          {[
                            ['Course', summary.course_name ?? '—'],
                            ['Branch', summary.branch_name ?? '—'],
                            ['Series', summary.series_name ?? '— (not linked)'],
                            ['Instructor(s)', [summary.lead_instructor_name, summary.asst_instructor_name].filter(Boolean).join(', ') || '—'],
                            ['Schedule', [summary.day_of_week, summary.time].filter(Boolean).join(' · ') || '—'],
                            ['Students', String(summary.student_count)],
                            ['Sessions completed', `${summary.sessions_completed}${summary.target_sessions ? ` / ${summary.target_sessions}` : ''}`],
                            ['Attendance %', `${summary.attendance_pct}%`],
                            ['Certificates', `${summary.certificates_issued} issued · ${summary.certificates_missing} missing`],
                            ['Outstanding balance', `${summary.outstanding_balance_total.toFixed(2)} (${summary.outstanding_balance_students} student(s))`],
                            ['Completion date', summary.completion_date ?? '—'],
                          ].map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between px-4 py-2.5">
                              <span className="text-[13px] text-[#64748B]">{label}</span>
                              <span className="text-[13px] font-semibold text-[#0B1F3A]">{value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => goTo(2)}
                      disabled={summaryLoading || !summary || summary.already_graduated}
                      className="rounded-lg bg-[#FF8A1F] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#e87c18] disabled:opacity-40"
                    >Next →</button>
                  </div>
                </>
              )}

              {/* ═══ STEP 2 — Validation ═══ */}
              {step === 2 && (
                <>
                  {validationLoading && <div className="flex justify-center py-10"><Spinner /></div>}
                  {validation && (
                    <>
                      {validation.blockers.length > 0 && (
                        <div className="space-y-1.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3">
                          {validation.blockers.map((b, i) => <p key={i} className="text-[12px] font-medium text-[#B91C1C]">✕ {b}</p>)}
                        </div>
                      )}
                      {validation.warnings.length === 0 && validation.blockers.length === 0 && (
                        <div className="rounded-xl border border-[#A7F3D0] bg-[#E7F8EE] px-4 py-3 text-sm text-[#15803D]">
                          No issues found — this cohort is ready to graduate.
                        </div>
                      )}
                      {validation.warnings.map((w, i) => (
                        <div key={i} className="rounded-xl border border-[#FED7AA] bg-[#FFFBEB] p-3">
                          <p className="text-[12px] font-semibold text-[#B45309]">⚠ {w.message}</p>
                          <p className="mt-0.5 text-[11px] text-[#92400E]">{w.recommendation}</p>
                        </div>
                      ))}
                    </>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setStep(1)} className="text-sm text-[#64748B] hover:text-[#0B1F3A]">← Back</button>
                    <button
                      onClick={() => goTo(3)}
                      disabled={validationLoading || !validation || validation.blockers.length > 0}
                      className="rounded-lg bg-[#FF8A1F] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#e87c18] disabled:opacity-40"
                    >Next →</button>
                  </div>
                </>
              )}

              {/* ═══ STEP 3 — Student Decisions ═══ */}
              {step === 3 && (
                <>
                  {studentsLoading && <div className="flex justify-center py-10"><Spinner /></div>}
                  {!studentsLoading && students.length > 0 && (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          placeholder="Search students…"
                          className="flex-1 min-w-[160px] rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] outline-none focus:border-[#FF8A1F]"
                        />
                        <select
                          value={filterDecision}
                          onChange={e => setFilterDecision(e.target.value as WizardDecision | 'all')}
                          className="rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-[12px] outline-none"
                        >
                          <option value="all">All decisions</option>
                          <option value="undecided">No Decision</option>
                          {(Object.keys(DECISION_LABELS) as GraduationDecision[]).map(d => (
                            <option key={d} value={d}>{DECISION_LABELS[d]}</option>
                          ))}
                        </select>
                        <button onClick={toggleSelectAll} className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#F8FAFC]">
                          {filteredStudents.every(s => selectedIds.has(s.student_id)) && filteredStudents.length ? 'Select None' : 'Select All'}
                        </button>
                      </div>

                      {selectedIds.size > 0 && (
                        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2">
                          <span className="text-[12px] text-[#64748B]">{selectedIds.size} selected</span>
                          <button onClick={() => bulkApply('recommended')} className="rounded-lg bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE]">Apply Recommended to Selected</button>
                          {(Object.keys(DECISION_LABELS) as GraduationDecision[]).map(d => (
                            <button key={d} onClick={() => bulkApply(d)} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${DECISION_COLORS[d]}`}>
                              Set: {DECISION_LABELS[d]}
                            </button>
                          ))}
                          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-[11px] text-[#94A3B8] hover:text-[#374151]">Clear</button>
                        </div>
                      )}

                      <div className="max-h-[42vh] overflow-y-auto rounded-xl border border-[#E2E8F0]">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-[#F8FAFC]">
                            <tr className="border-b border-[#E2E8F0]">
                              <th className="w-8 px-3 py-2" />
                              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Student</th>
                              <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Att. %</th>
                              <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Cert.</th>
                              <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Balance</th>
                              <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Recommended</th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Decision</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F1F5F9]">
                            {filteredStudents.map(s => {
                              const dec = decisions[s.student_id] ?? 'undecided'
                              return (
                                <tr key={s.student_id}>
                                  <td className="px-3 py-2">
                                    <input type="checkbox" checked={selectedIds.has(s.student_id)} onChange={() => setSelectedIds(prev => {
                                      const next = new Set(prev)
                                      if (next.has(s.student_id)) next.delete(s.student_id); else next.add(s.student_id)
                                      return next
                                    })} />
                                  </td>
                                  <td className="px-3 py-2 font-medium text-[#0B1F3A]">{s.student_name}</td>
                                  <td className="px-3 py-2 text-center text-[#64748B]">{s.attendance_pct}%</td>
                                  <td className="px-3 py-2 text-center">{s.has_certificate ? '✓' : '—'}</td>
                                  <td className="px-3 py-2 text-center text-[#64748B]">{s.outstanding_balance > 0 ? s.outstanding_balance.toFixed(0) : '—'}</td>
                                  <td className="px-3 py-2 text-center">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${DECISION_COLORS[s.recommended_decision]}`}>{DECISION_LABELS[s.recommended_decision]}</span>
                                  </td>
                                  <td className="px-3 py-2">
                                    <select
                                      value={dec}
                                      onChange={e => setDecisionFor(s.student_id, e.target.value as WizardDecision)}
                                      className={`rounded-lg border px-2 py-1 text-[11px] font-semibold outline-none ${dec === 'undecided' ? 'border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]' : 'border-[#E2E8F0]'}`}
                                    >
                                      <option value="undecided">No Decision</option>
                                      {(Object.keys(DECISION_LABELS) as GraduationDecision[]).map(d => (
                                        <option key={d} value={d}>{DECISION_LABELS[d]}</option>
                                      ))}
                                    </select>
                                    {dec === 'transfer' && (
                                      <select
                                        value={transferTargets[s.student_id] ?? ''}
                                        onChange={e => setTransferTargets(prev => ({ ...prev, [s.student_id]: e.target.value }))}
                                        className="mt-1 block rounded-lg border border-[#E2E8F0] px-2 py-1 text-[11px] outline-none"
                                      >
                                        <option value="">— choose target group —</option>
                                        {transferOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                      </select>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      {!everyoneDecided && (
                        <p className="text-[11px] text-[#B91C1C]">Every student must have an explicit decision before continuing.</p>
                      )}
                    </>
                  )}
                  {!studentsLoading && students.length === 0 && (
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-6 text-center text-sm text-[#64748B]">
                      No active students in this cohort — you can still create the next cohort.
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setStep(2)} className="text-sm text-[#64748B] hover:text-[#0B1F3A]">← Back</button>
                    <button
                      onClick={() => goTo(4)}
                      disabled={studentsLoading || !everyoneDecided}
                      className="rounded-lg bg-[#FF8A1F] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#e87c18] disabled:opacity-40"
                    >Next →</button>
                  </div>
                </>
              )}

              {/* ═══ STEP 4 — Next Cohort ═══ */}
              {step === 4 && (
                <>
                  {draftLoading && <div className="flex justify-center py-10"><Spinner /></div>}
                  {draft && (
                    <div className="space-y-3">
                      <div className="rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] px-4 py-2.5 text-[12px] text-[#1D4ED8]">
                        This cohort will be created as <strong>Draft</strong> — course, instructor, and schedule are configured in a guided step right after you commit.
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="mb-1 block text-[12px] font-medium text-[#0B1F3A]">Name</span>
                          <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F]" />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[12px] font-medium text-[#0B1F3A]">Semester</span>
                          <select value={draft.semester_id ?? ''} onChange={e => setDraft({ ...draft, semester_id: e.target.value || null })} className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none">
                            <option value="">— none —</option>
                            {semesterOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[12px] font-medium text-[#0B1F3A]">Day of week</span>
                          <input value={draft.day_of_week ?? ''} onChange={e => setDraft({ ...draft, day_of_week: e.target.value || null })} className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F]" />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[12px] font-medium text-[#0B1F3A]">Time</span>
                          <input value={draft.time ?? ''} onChange={e => setDraft({ ...draft, time: e.target.value || null })} className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F]" />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[12px] font-medium text-[#0B1F3A]">Start date</span>
                          <input type="date" value={draft.start_date ?? ''} onChange={e => setDraft({ ...draft, start_date: e.target.value || null })} className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F]" />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[12px] font-medium text-[#0B1F3A]">Capacity</span>
                          <input type="number" value={draft.capacity ?? ''} onChange={e => setDraft({ ...draft, capacity: e.target.value ? Number(e.target.value) : null })} className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F]" />
                        </label>
                        <label className="block col-span-2">
                          <span className="mb-1 block text-[12px] font-medium text-[#0B1F3A]">Room (reference only — set per-session when scheduling)</span>
                          <input value={draft.room ?? ''} onChange={e => setDraft({ ...draft, room: e.target.value || null })} className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F]" />
                        </label>
                      </div>
                      <p className="text-[11px] text-[#94A3B8]">
                        Series, course, and instructor selections shown here are carried forward to the guided setup step after graduation is committed.
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setStep(3)} className="text-sm text-[#64748B] hover:text-[#0B1F3A]">← Back</button>
                    <button
                      onClick={() => goTo(5)}
                      disabled={draftLoading || !draft || !draft.name.trim()}
                      className="rounded-lg bg-[#FF8A1F] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#e87c18] disabled:opacity-40"
                    >Next →</button>
                  </div>
                </>
              )}

              {/* ═══ STEP 5 — Enrollment Preview ═══ */}
              {step === 5 && (
                <>
                  {previewLoading && <div className="flex justify-center py-10"><Spinner /></div>}
                  {preview && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {[
                          ['Continuing', preview.continuing.length], ['Graduating', preview.graduating.length],
                          ['Held', preview.held.length], ['Dropped', preview.dropped.length],
                          ['Transferred', preview.transferred.length], ['Repeating', preview.repeating.length],
                        ].map(([label, n]) => (
                          <div key={label as string} className="rounded-xl border border-[#E2E8F0] px-3 py-2.5">
                            <p className="text-lg font-bold text-[#0B1F3A]">{n as number}</p>
                            <p className="text-[10px] uppercase tracking-wide text-[#94A3B8]">{label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-xl border border-[#E2E8F0] divide-y divide-[#F1F5F9]">
                        <div className="px-4 py-2 text-[12px] font-semibold text-[#0B1F3A] bg-[#F8FAFC]">New Cohort</div>
                        <div className="flex justify-between px-4 py-2 text-[12px]"><span className="text-[#64748B]">Name</span><span className="font-medium text-[#0B1F3A]">{preview.new_cohort.name}</span></div>
                        <div className="flex justify-between px-4 py-2 text-[12px]"><span className="text-[#64748B]">Branch</span><span className="font-medium text-[#0B1F3A]">{preview.new_cohort.branch_name ?? '—'}</span></div>
                        <div className="flex justify-between px-4 py-2 text-[12px]"><span className="text-[#64748B]">Schedule</span><span className="font-medium text-[#0B1F3A]">{[preview.new_cohort.day_of_week, preview.new_cohort.time].filter(Boolean).join(' · ') || '—'}</span></div>
                      </div>
                      <div className="rounded-xl border border-[#E2E8F0] divide-y divide-[#F1F5F9]">
                        <div className="px-4 py-2 text-[12px] font-semibold text-[#0B1F3A] bg-[#F8FAFC]">Historical Cohort (unchanged)</div>
                        <div className="flex justify-between px-4 py-2 text-[12px]"><span className="text-[#64748B]">Name</span><span className="font-medium text-[#0B1F3A]">{preview.historical_cohort.name}</span></div>
                        <div className="flex justify-between px-4 py-2 text-[12px]"><span className="text-[#64748B]">Students</span><span className="font-medium text-[#0B1F3A]">{preview.historical_cohort.student_count}</span></div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setStep(4)} className="text-sm text-[#64748B] hover:text-[#0B1F3A]">← Back</button>
                    <button
                      onClick={() => goTo(6)}
                      disabled={previewLoading || !preview}
                      className="rounded-lg bg-[#FF8A1F] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#e87c18] disabled:opacity-40"
                    >Next →</button>
                  </div>
                </>
              )}

              {/* ═══ STEP 6 — Review & Confirm ═══ */}
              {step === 6 && preview && (
                <>
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                    <p className="text-[12px] font-semibold text-[#0B1F3A]">Decision counts</p>
                    <p className="mt-1 text-[13px] text-[#374151]">
                      {decisionCountsSummary({
                        continue: preview.continuing.length, graduate: preview.graduating.length, hold: preview.held.length,
                        drop: preview.dropped.length, transfer: preview.transferred.length, repeat: preview.repeating.length,
                      })}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] px-4 py-3">
                    <p className="text-[12px] font-semibold text-[#0B1F3A]">New cohort</p>
                    <p className="mt-1 text-[13px] text-[#374151]">{preview.new_cohort.name} — {preview.new_cohort.branch_name} — will be created as Draft</p>
                  </div>

                  <div className="max-h-[30vh] overflow-y-auto rounded-xl border border-[#E2E8F0]">
                    <table className="w-full text-[12px]">
                      <thead className="sticky top-0 bg-[#F8FAFC]">
                        <tr><th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-[#94A3B8]">Student</th><th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-[#94A3B8]">Decision</th></tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {students.map(s => {
                          const d = (decisions[s.student_id] ?? 'undecided') as GraduationDecision
                          return (
                            <tr key={s.student_id}>
                              <td className="px-3 py-1.5 font-medium text-[#0B1F3A]">{s.student_name}</td>
                              <td className="px-3 py-1.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${DECISION_COLORS[d]}`}>{DECISION_LABELS[d]}</span></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
                    <p className="text-[12px] font-bold text-[#B91C1C]">This action cannot be undone.</p>
                    <p className="mt-1 text-[11px] text-[#B91C1C]">
                      The current cohort&apos;s history is preserved permanently, but a cohort can only be graduated once.
                      Double-check the decisions above before confirming.
                    </p>
                  </div>

                  <label className="flex items-start gap-2.5 rounded-xl border border-[#E2E8F0] p-3">
                    <input type="checkbox" checked={confirmChecked} onChange={e => setConfirmChecked(e.target.checked)} className="mt-0.5 accent-[#FF8A1F]" />
                    <span className="text-[12px] text-[#374151]">I have reviewed the above and confirm this graduation.</span>
                  </label>

                  {commitError && <div className="rounded-xl bg-[#FEE2E2] px-4 py-2.5 text-[12px] text-[#DC2626]">{commitError}</div>}

                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setStep(5)} disabled={submitting} className="text-sm text-[#64748B] hover:text-[#0B1F3A] disabled:opacity-40">← Back</button>
                    <button
                      onClick={handleCommit}
                      disabled={!confirmChecked || submitting}
                      className="flex items-center gap-2 rounded-lg bg-[#EF4444] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#DC2626] disabled:opacity-40"
                    >
                      {submitting && <Spinner className="h-4 w-4 text-white" />}
                      {submitting ? 'Committing…' : 'Commit Graduation'}
                    </button>
                  </div>
                </>
              )}

              {/* ═══ STEP 7 — Result ═══ */}
              {step === 7 && result && (
                <div className="space-y-5 text-center py-2">
                  <div className="flex items-center justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E7F8EE]">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-[#15803D]">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-bold text-[#0B1F3A]">
                      {result.replayed ? 'Graduation already committed' : 'Graduation committed'}
                    </p>
                    <p className="mt-1 text-[13px] text-[#64748B]">
                      {decisionCountsSummary(result.decision_counts)}
                    </p>
                  </div>

                  <div className="mx-auto max-w-sm rounded-xl border border-[#FED7AA] bg-[#FFFBEB] p-4 text-left">
                    <p className="text-[12px] font-bold text-[#B45309]">⚠ Draft – Setup Required</p>
                    <p className="mt-1 text-[11px] text-[#92400E]">
                      Course, instructor, and schedule were not configured automatically. Open the new cohort and
                      use Edit Group to apply the settings you chose in Step 4{draft?.course_id || draft?.instructor_id ? ':' : '.'}
                    </p>
                    {draft && (draft.course_id || draft.instructor_id || draft.room) && (
                      <ul className="mt-2 space-y-0.5 text-[11px] text-[#92400E]">
                        {draft.instructor_id && <li>• Instructor selected in Step 4</li>}
                        {draft.course_id && <li>• Course selected in Step 4</li>}
                        {draft.room && <li>• Room: {draft.room}</li>}
                        {draft.planned_sessions && <li>• Planned sessions: {draft.planned_sessions}</li>}
                      </ul>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <button onClick={() => { onSuccess(result.new_group_id); onClose() }} className="rounded-lg bg-[#FF8A1F] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#e87c18]">
                      Open New Cohort →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
