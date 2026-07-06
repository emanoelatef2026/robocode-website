'use client'

import { useState, useEffect, useRef } from 'react'
import type { GroupOperationalRow } from '@/modules/groups/operational'
import type { GroupDetailStudent } from '@/modules/groups/actions/types'
import {
  loadBulkCertificateWizardOptions,
  loadBulkPreviewData,
  issueBulkGroupCertificates,
  type BulkWizardOptions,
  type BulkPreviewStudent,
  type BulkIssueResult,
} from '@/modules/certificates/bulk-actions'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  isOpen:    boolean
  group:     GroupOperationalRow
  students:  GroupDetailStudent[]
  onClose:   () => void
  onSuccess: () => void
}

type Step = 1 | 2 | 3 | 4

const MAX_PROJECTS = 20

const CERT_TYPES = [
  { value: 'semester_completion', label: 'Semester Completion' },
  { value: 'course_completion',   label: 'Course Completion' },
  { value: 'competition_award',   label: 'Competition Award' },
  { value: 'achievement',         label: 'Achievement' },
  { value: 'custom',              label: 'Custom' },
]

const inputCls =
  'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

// ─── Modal ────────────────────────────────────────────────────────────────────

export function BulkCertificatesModal({ isOpen, group, students, onClose, onSuccess }: Props) {
  // ── Wizard step ─────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1)

  // ── Wizard options (loaded once on open) ────────────────────────────────────
  const [options, setOptions]             = useState<BulkWizardOptions | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(false)

  // ── Step 1 ───────────────────────────────────────────────────────────────────
  const [certType,    setCertType]    = useState('semester_completion')
  const [courseId,    setCourseId]    = useState<string | null>(null)
  const [courseTitle, setCourseTitle] = useState('')
  const [semesterId,  setSemesterId]  = useState<string | null>(null)
  const [templateId,  setTemplateId]  = useState<string | null>(null)

  // ── Step 2 ───────────────────────────────────────────────────────────────────
  const [projectMode,   setProjectMode]   = useState<'same' | 'portfolio'>('same')
  const [sharedProjects, setSharedProjects] = useState<{ title: string; sort_order: number }[]>([])
  const [newTitle,      setNewTitle]      = useState('')
  const [projectError,  setProjectError]  = useState<string | null>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  // ── Step 3 preview ───────────────────────────────────────────────────────────
  const [preview,        setPreview]        = useState<BulkPreviewStudent[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError,   setPreviewError]   = useState<string | null>(null)

  // ── Step 4 generation ────────────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false)
  const [result,     setResult]     = useState<BulkIssueResult | null>(null)
  const [genError,   setGenError]   = useState<string | null>(null)

  // ── Lock scroll ──────────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // ── Escape key ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // ── Reset + load options when modal opens ────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return

    setStep(1)
    setCertType('semester_completion')
    setCourseId(group.course_id ?? null)
    setCourseTitle(group.course_name ?? '')
    setSemesterId(null)
    setTemplateId(null)
    setProjectMode('same')
    setSharedProjects([])
    setNewTitle('')
    setProjectError(null)
    setPreview([])
    setPreviewLoading(false)
    setPreviewError(null)
    setGenerating(false)
    setResult(null)
    setGenError(null)

    setOptionsLoading(true)
    loadBulkCertificateWizardOptions()
      .then(res => { if (res.success) setOptions(res.data) })
      .finally(() => setOptionsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  // ── Project helpers ──────────────────────────────────────────────────────────

  function addProject() {
    const t = newTitle.trim()
    if (!t) return
    if (sharedProjects.length >= MAX_PROJECTS) {
      setProjectError(`Maximum ${MAX_PROJECTS} projects allowed.`)
      return
    }
    if (sharedProjects.some(p => p.title.toLowerCase() === t.toLowerCase())) {
      setProjectError('Duplicate project name.')
      return
    }
    setProjectError(null)
    setSharedProjects(prev => [...prev, { title: t, sort_order: prev.length }])
    setNewTitle('')
    setTimeout(() => addInputRef.current?.focus(), 0)
  }

  function removeProject(idx: number) {
    setProjectError(null)
    setSharedProjects(prev => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, sort_order: i })))
  }

  // ── Step transitions ─────────────────────────────────────────────────────────

  function handleGoToStep1() { setStep(1) }
  function handleGoToStep2() { setStep(2) }

  function handleGoToStep3() {
    setStep(3)
    setPreview([])
    setPreviewLoading(true)
    setPreviewError(null)

    loadBulkPreviewData({
      student_ids:    students.map(s => s.student_id),
      course_id:      courseId,
      semester_id:    semesterId,
      project_mode:   projectMode,
      shared_projects: sharedProjects,
      students_meta:  students.map(s => ({ student_id: s.student_id, student_name: s.student_name })),
    })
      .then(res => {
        if (res.success) setPreview(res.data)
        else setPreviewError(res.error?.message ?? 'Failed to load preview.')
      })
      .catch(() => setPreviewError('Failed to load preview.'))
      .finally(() => setPreviewLoading(false))
  }

  function handleGoToStep4() { setStep(4) }

  function handleGenerate() {
    const toIssue = preview.filter(s => s.status === 'ready')
    if (!toIssue.length) { setGenError('No eligible students to issue certificates to.'); return }

    setGenerating(true)
    setGenError(null)

    issueBulkGroupCertificates({
      group_id:        group.group_id,
      branch_id:       group.branch_id,
      student_ids:     toIssue.map(s => s.student_id),
      course_id:       courseId,
      semester_id:     semesterId,
      certificate_type: certType,
      title:           courseTitle,
      template_id:     templateId,
      project_mode:    projectMode,
      shared_projects: sharedProjects,
    })
      .then(res => {
        if (res.success) { setResult(res.data) }
        else setGenError(res.error?.message ?? 'Generation failed.')
      })
      .catch(() => setGenError('An unexpected error occurred.'))
      .finally(() => setGenerating(false))
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const readyCount   = preview.filter(s => s.status === 'ready').length
  const skippedCount = preview.filter(s => s.status === 'already_issued').length

  // ── Step 1 validation ────────────────────────────────────────────────────────
  const step1Valid = courseTitle.trim().length > 0

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-[#0B1F3A]">Issue Group Certificates</h2>
            <p className="mt-0.5 text-xs text-[#94A3B8]">
              {group.name}
              {step < 4 || !result ? ` · Step ${step} of 4` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#0B1F3A]"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* ── Step indicator ── */}
        {(!result) && (
          <div className="flex border-b border-[#E2E8F0] bg-[#F8FAFC]">
            {(['Configure', 'Projects', 'Preview', 'Confirm'] as const).map((label, i) => {
              const n = (i + 1) as Step
              const active  = step === n
              const done    = step > n
              return (
                <div
                  key={label}
                  className={[
                    'flex-1 py-2.5 text-center text-[11px] font-semibold transition border-b-2',
                    active ? 'border-[#FF8A1F] text-[#FF8A1F]' : done ? 'border-transparent text-[#15803D]' : 'border-transparent text-[#94A3B8]',
                  ].join(' ')}
                >
                  <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full mr-1 text-[9px] font-bold ${active ? 'bg-[#FF8A1F] text-white' : done ? 'bg-[#15803D] text-white' : 'bg-[#E2E8F0] text-[#94A3B8]'}`}>
                    {done ? '✓' : n}
                  </span>
                  {label}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Body ── */}
        <div className="p-6 space-y-4">

          {/* ════════════════ STEP 1 — Configure ════════════════ */}
          {step === 1 && (
            <>
              {optionsLoading && (
                <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                  </svg>
                  Loading options…
                </div>
              )}

              {/* Group info chip */}
              <div className="flex items-center gap-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-3">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-[#94A3B8]">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/>
                </svg>
                <span className="text-sm font-medium text-[#0B1F3A]">{group.name}</span>
                <span className="text-xs text-[#94A3B8]">{students.length} student{students.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Certificate type */}
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
                  Certificate Type <span className="text-[#EF4444]">*</span>
                </label>
                <select
                  value={certType}
                  onChange={e => setCertType(e.target.value)}
                  className={inputCls}
                >
                  {CERT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Course name */}
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
                  Course Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  value={courseTitle}
                  onChange={e => setCourseTitle(e.target.value)}
                  placeholder="e.g. Scratch Coding, Python Programming, Arduino & Robotics…"
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-[#94A3B8]">
                  Printed prominently on every certificate. Auto-filled from group course.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Course link (optional) */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Course (optional)</label>
                  <select
                    value={courseId ?? ''}
                    onChange={e => {
                      const id = e.target.value || null
                      setCourseId(id)
                      if (id) {
                        const c = options?.courses.find(c => c.id === id)
                        if (c) setCourseTitle(c.title)
                      }
                    }}
                    className={inputCls}
                    disabled={optionsLoading}
                  >
                    <option value="">— none —</option>
                    {options?.courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                {/* Semester */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Semester (optional)</label>
                  <select
                    value={semesterId ?? ''}
                    onChange={e => setSemesterId(e.target.value || null)}
                    className={inputCls}
                    disabled={optionsLoading}
                  >
                    <option value="">— none —</option>
                    {options?.semesters.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Template */}
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Template (optional)</label>
                <select
                  value={templateId ?? ''}
                  onChange={e => setTemplateId(e.target.value || null)}
                  className={inputCls}
                  disabled={optionsLoading}
                >
                  <option value="">— no template —</option>
                  {options?.templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleGoToStep2}
                  disabled={!step1Valid || optionsLoading}
                  className="rounded-lg bg-[#FF8A1F] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#e87c18] disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </>
          )}

          {/* ════════════════ STEP 2 — Project Source ════════════════ */}
          {step === 2 && (
            <>
              {/* Mode selector */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#0B1F3A]">Choose project source</p>

                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${projectMode === 'same' ? 'border-[#FF8A1F] bg-[#FFF7ED]' : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'}`}>
                  <input
                    type="radio"
                    name="project_mode"
                    value="same"
                    checked={projectMode === 'same'}
                    onChange={() => setProjectMode('same')}
                    className="mt-0.5 accent-[#FF8A1F]"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[#0B1F3A]">Same projects for all students</p>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Define one list of projects — copied to every certificate.
                    </p>
                  </div>
                </label>

                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${projectMode === 'portfolio' ? 'border-[#FF8A1F] bg-[#FFF7ED]' : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'}`}>
                  <input
                    type="radio"
                    name="project_mode"
                    value="portfolio"
                    checked={projectMode === 'portfolio'}
                    onChange={() => setProjectMode('portfolio')}
                    className="mt-0.5 accent-[#FF8A1F]"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[#0B1F3A]">Each student&apos;s portfolio projects</p>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Projects are loaded from each student&apos;s portfolio individually — certificates will differ.
                    </p>
                  </div>
                </label>
              </div>

              {/* Project list — shown in "same" mode */}
              {projectMode === 'same' && (
                <div className="rounded-xl border border-[#E2E8F0] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#0B1F3A]">Projects Applied To All Certificates</p>
                      <p className="text-xs text-[#94A3B8]">1–{MAX_PROJECTS} projects, no duplicates</p>
                    </div>
                    {sharedProjects.length > 0 && (
                      <span className="rounded-full bg-[#FF8A1F]/10 px-2.5 py-0.5 text-xs font-semibold text-[#FF8A1F]">
                        {sharedProjects.length}
                      </span>
                    )}
                  </div>

                  {projectError && (
                    <p className="text-xs text-[#EF4444]">{projectError}</p>
                  )}

                  {sharedProjects.length > 0 && (
                    <ul className="max-h-52 overflow-y-auto space-y-1.5">
                      {sharedProjects.map((p, i) => (
                        <li key={i} className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                          <span className="w-5 shrink-0 text-center text-[10px] font-mono text-[#CBD5E1]">{i + 1}</span>
                          <span className="flex-1 text-sm text-[#0B1F3A]">{p.title}</span>
                          <button
                            type="button"
                            onClick={() => removeProject(i)}
                            className="shrink-0 text-xs text-[#F87171] hover:text-[#EF4444]"
                            aria-label="Remove"
                          >✕</button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {sharedProjects.length < MAX_PROJECTS && (
                    <div className="flex gap-2">
                      <input
                        ref={addInputRef}
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addProject() } }}
                        placeholder="Add project name…"
                        className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
                      />
                      <button
                        type="button"
                        onClick={addProject}
                        disabled={!newTitle.trim()}
                        className="shrink-0 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e87c18] disabled:opacity-40 transition"
                      >+ Add</button>
                    </div>
                  )}
                </div>
              )}

              {/* Portfolio mode info */}
              {projectMode === 'portfolio' && (
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                  <p className="text-sm text-[#64748B]">
                    Projects will be loaded from each student&apos;s portfolio automatically.
                    Students with no portfolio will still receive a certificate (with no projects listed).
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleGoToStep1}
                  className="text-sm text-[#64748B] hover:text-[#0B1F3A]"
                >← Back</button>
                <button
                  type="button"
                  onClick={handleGoToStep3}
                  className="rounded-lg bg-[#FF8A1F] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#e87c18]"
                >
                  Next →
                </button>
              </div>
            </>
          )}

          {/* ════════════════ STEP 3 — Preview ════════════════ */}
          {step === 3 && (
            <>
              {previewLoading && (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-[#94A3B8]">
                  <svg className="h-6 w-6 animate-spin text-[#FF8A1F]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                  </svg>
                  Loading preview…
                </div>
              )}

              {previewError && (
                <div className="rounded-xl bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">
                  {previewError}
                </div>
              )}

              {!previewLoading && !previewError && preview.length > 0 && (
                <>
                  {/* Summary badges */}
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F8EE] px-3 py-1 text-xs font-semibold text-[#15803D]">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                      </svg>
                      {readyCount} will be issued
                    </span>
                    {skippedCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-3 py-1 text-xs font-semibold text-[#64748B]">
                        {skippedCount} already issued — will skip
                      </span>
                    )}
                    {preview.some(s => s.status === 'ready' && !s.has_portfolio && projectMode === 'portfolio') && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFBEB] px-3 py-1 text-xs font-semibold text-[#92400E]">
                        ⚠ Some students have no portfolio
                      </span>
                    )}
                  </div>

                  {/* Preview table */}
                  <div className="overflow-hidden rounded-xl border border-[#E2E8F0]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Student</th>
                          <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Projects</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {preview.map(s => (
                          <tr key={s.student_id} className={s.status === 'already_issued' ? 'opacity-50' : ''}>
                            <td className="px-4 py-2.5 text-sm font-medium text-[#0B1F3A]">
                              {s.student_name}
                            </td>
                            <td className="px-4 py-2.5 text-center text-sm text-[#64748B]">
                              {s.status === 'already_issued'
                                ? '—'
                                : projectMode === 'portfolio'
                                  ? s.project_count > 0 ? s.project_count : <span className="text-[#F59E0B]">0</span>
                                  : s.project_count}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {s.status === 'already_issued' ? (
                                <span className="inline-block rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-semibold text-[#64748B]">
                                  Already Issued
                                </span>
                              ) : projectMode === 'portfolio' && !s.has_portfolio ? (
                                <span className="inline-block rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[11px] font-semibold text-[#92400E]">
                                  Ready · No Portfolio
                                </span>
                              ) : (
                                <span className="inline-block rounded-full bg-[#E7F8EE] px-2 py-0.5 text-[11px] font-semibold text-[#15803D]">
                                  Ready
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleGoToStep2}
                  className="text-sm text-[#64748B] hover:text-[#0B1F3A]"
                >← Back</button>
                <button
                  type="button"
                  onClick={handleGoToStep4}
                  disabled={previewLoading || readyCount === 0}
                  className="rounded-lg bg-[#FF8A1F] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#e87c18] disabled:opacity-40"
                >
                  Continue →
                </button>
              </div>
            </>
          )}

          {/* ════════════════ STEP 4 — Confirm + Generate ════════════════ */}
          {step === 4 && !result && (
            <>
              {/* Confirmation summary */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] divide-y divide-[#E2E8F0]">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium text-[#0B1F3A]">Course</span>
                  <span className="text-sm font-semibold text-[#0B1F3A]">{courseTitle}</span>
                </div>
                {semesterId && options?.semesters.find(s => s.id === semesterId) && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-medium text-[#0B1F3A]">Semester</span>
                    <span className="text-sm font-semibold text-[#0B1F3A]">
                      {options.semesters.find(s => s.id === semesterId)!.name}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium text-[#0B1F3A]">Project source</span>
                  <span className="text-sm font-semibold text-[#0B1F3A]">
                    {projectMode === 'same'
                      ? `Same projects (${sharedProjects.length})`
                      : "Each student's portfolio"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-semibold text-[#15803D]">Certificates to generate</span>
                  <span className="text-lg font-bold text-[#15803D]">{readyCount}</span>
                </div>
                {skippedCount > 0 && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-[#64748B]">Already issued — will skip</span>
                    <span className="text-sm font-semibold text-[#64748B]">{skippedCount}</span>
                  </div>
                )}
              </div>

              {genError && (
                <div className="rounded-xl bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">
                  {genError}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleGoToStep3}
                  disabled={generating}
                  className="text-sm text-[#64748B] hover:text-[#0B1F3A] disabled:opacity-40"
                >← Back</button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#e87c18] disabled:opacity-60"
                >
                  {generating && (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                    </svg>
                  )}
                  {generating ? `Generating ${readyCount} certificates…` : `Generate ${readyCount} Certificates`}
                </button>
              </div>
            </>
          )}

          {/* ════════════════ RESULT ════════════════ */}
          {step === 4 && result && (
            <div className="space-y-5 text-center py-4">
              <div className="flex items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E7F8EE]">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-[#15803D]">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                </div>
              </div>

              <div>
                <p className="text-base font-bold text-[#0B1F3A]">Certificates Issued</p>
                <p className="mt-0.5 font-mono text-xs text-[#94A3B8]">{result.batch_id}</p>
              </div>

              <div className="mx-auto max-w-xs rounded-xl border border-[#E2E8F0] divide-y divide-[#E2E8F0] text-left">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-semibold text-[#15803D]">Created</span>
                  <span className="text-lg font-bold text-[#15803D]">{result.created}</span>
                </div>
                {result.skipped > 0 && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-[#64748B]">Skipped (already issued)</span>
                    <span className="text-sm font-semibold text-[#64748B]">{result.skipped}</span>
                  </div>
                )}
                {result.failed > 0 && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-[#EF4444]">Failed</span>
                    <span className="text-sm font-semibold text-[#EF4444]">{result.failed}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => { onSuccess(); onClose() }}
                  className="rounded-lg bg-[#FF8A1F] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#e87c18]"
                >
                  Done
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
