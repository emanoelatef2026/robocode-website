'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { enrollStudentFull } from '@/modules/enrollments/actions'
import { addPayment } from '@/modules/finance/actions'
import type { PaymentMethod } from '@/modules/finance/types'
import { PAYMENT_METHOD_LABELS } from '@/modules/finance/types'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StudentResult {
  id:                       string
  name:                     string
  code:                     string | null
  email:                    string | null
  phone:                    string | null
  age:                      number | null
  branch_id:                string
  branch_name:              string
  parent_name:              string | null
  parent_phone:             string | null
  active_enrollments_count: number
  active_course_ids:        string[]
  active_group_name:        string | null
  financial_status:         string | null
  enrolled_sessions:        number | null
  remaining_sessions:       number | null
  active_summaries:         Array<{
    course_name:        string | null
    group_name:         string | null
    remaining_sessions: number
    financial_status:   string | null
  }>
}

export interface PreselectedPackage {
  enrollment_id:      string
  account_id:         string | null
  course_name:        string | null
  group_name:         string | null
  enrolled_sessions:  number
  remaining_sessions: number
  financial_status:   string | null
}

interface CourseResult   { id: string; title: string; level: string | null }
interface InstructorResult { id: string; name: string }
interface GroupResult {
  id: string; name: string
  course_id: string | null; course_title: string | null
  instructor_id: string | null; instructor_name: string | null
}

interface WizardState {
  step:             1 | 2 | 3
  student:          StudentResult | null
  course:           CourseResult | null
  instructor:       InstructorResult | null
  group:            GroupResult | null
  startDate:        string
  enrollmentType:   'primary' | 'secondary'
  enrolledSessions: string
  totalAmount:      string
  discountAmount:   string
  installmentCount: string
  firstDueDate:     string
  initPayAmount:    string
  initPayMethod:    PaymentMethod
  initPayDate:      string
  initPayRef:       string
  initPayNotes:     string
}

// ── Egyptian phone normalisation ───────────────────────────────────────────────
// Accepts 010/011/012/015 formats. Strips leading 0 for comparison.

function normaliseEgPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('20')) return digits.slice(2)
  if (digits.startsWith('0'))  return digits.slice(1)
  return digits
}

// ── Relevance ranking ─────────────────────────────────────────────────────────

function scoreResult(s: StudentResult, q: string): number {
  const ql = q.toLowerCase().trim()
  let score = 0

  const code = (s.code ?? '').toLowerCase()
  if (code) {
    if (code === ql)             score += 100
    else if (code.startsWith(ql)) score += 80
    else if (code.includes(ql))  score += 60
  }

  const phoneD = normaliseEgPhone(s.phone ?? '')
  const qD     = normaliseEgPhone(ql)
  if (phoneD && qD) {
    if (phoneD === qD)               score += 90
    else if (phoneD.startsWith(qD))  score += 70
    else if (phoneD.includes(qD))    score += 50
  }

  const ppD = normaliseEgPhone(s.parent_phone ?? '')
  if (ppD && qD) {
    if (ppD === qD)              score += 85
    else if (ppD.startsWith(qD)) score += 65
    else if (ppD.includes(qD))   score += 40
  }

  const name = s.name.toLowerCase()
  if (name === ql)              score += 95
  else if (name.startsWith(ql)) score += 75
  else {
    for (const w of ql.split(/\s+/)) {
      if (name.startsWith(w))    score += 20
      else if (name.includes(w)) score += 10
    }
  }

  const groupName = (s.active_group_name ?? '').toLowerCase()
  if (groupName && groupName.includes(ql)) score += 30

  return score
}

// ── Highlight matching substring ───────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>
  const word = query.split(/\s+/)[0]
  const idx  = text.toLowerCase().indexOf(word.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-orange-100 px-px font-semibold not-italic text-orange-700">
        {text.slice(idx, idx + word.length)}
      </mark>
      {text.slice(idx + word.length)}
    </>
  )
}

// ── Operational warnings ───────────────────────────────────────────────────────

function computeWarnings(s: StudentResult): string[] {
  const w: string[] = []
  if (s.financial_status === 'BLOCKED')
    w.push('Account is BLOCKED — collection action required before adding a payment.')
  else if (s.financial_status === 'OVERDUE')
    w.push('Overdue balance — confirm with collection team before proceeding.')
  if (s.enrolled_sessions != null && s.enrolled_sessions > 0) {
    const left = s.remaining_sessions ?? 0
    if (left <= 1)
      w.push(left === 0
        ? 'Session package exhausted — student needs a renewal, not a new contract.'
        : '1 session remaining — consider renewing the existing contract instead.')
  }
  if (s.active_enrollments_count > 2)
    w.push(`${s.active_enrollments_count} active enrollments already — verify this is intentional.`)
  return w
}

// ── Status badge helpers ───────────────────────────────────────────────────────

const FIN_BADGE: Record<string, string> = {
  CURRENT:   'bg-emerald-100 text-emerald-700',
  DUE_SOON:  'bg-amber-100 text-amber-700',
  OVERDUE:   'bg-red-100 text-red-600',
  BLOCKED:   'bg-red-100 text-red-700',
  COMPLETED: 'bg-slate-100 text-slate-600',
}
const FIN_LABEL: Record<string, string> = {
  CURRENT: 'Current', DUE_SOON: 'Due Soon', OVERDUE: 'Overdue', BLOCKED: 'Blocked', COMPLETED: 'Completed',
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  branchIds:            string[]
  onClose:              () => void
  onSuccess:            () => void
  preselectedStudent?:  StudentResult
  preselectedPackages?: PreselectedPackage[]
}

export default function EnrollmentWizard({ branchIds, onClose, onSuccess, preselectedStudent, preselectedPackages }: Props) {
  const [state, setState] = useState<WizardState>({
    step: preselectedStudent ? 2 : 1, student: preselectedStudent ?? null, course: null, instructor: null, group: null,
    startDate: new Date().toISOString().slice(0, 10),
    enrollmentType: 'primary',
    enrolledSessions: '',
    totalAmount: '', discountAmount: '0',
    installmentCount: '1',
    firstDueDate: (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10) })(),
    initPayAmount: '', initPayMethod: 'cash',
    initPayDate: new Date().toISOString().slice(0, 10),
    initPayRef: '', initPayNotes: '',
  })

  const [search,              setSearch]              = useState('')
  const [results,             setResults]             = useState<StudentResult[]>([])
  const [courses,             setCourses]             = useState<CourseResult[]>([])
  const [instructors,         setInstructors]         = useState<InstructorResult[]>([])
  const [groups,              setGroups]              = useState<GroupResult[]>([])
  const [searching,           setSearching]           = useState(false)
  const [submitting,          setSubmitting]          = useState(false)
  const [error,               setError]               = useState<string | null>(null)
  const [selectedIndex,       setSelectedIndex]       = useState(-1)
  const [warnings,            setWarnings]            = useState<string[]>([])
  const [courseConflict,      setCourseConflict]      = useState<string | null>(null)

  // Existing package quick-pay mode (used when opened from drawer with packages)
  const [payMode,        setPayMode]        = useState<'new' | 'existing'>(() => (preselectedPackages?.length ?? 0) > 0 ? 'existing' : 'new')
  const [selectedPkg,    setSelectedPkg]    = useState<PreselectedPackage | null>(() => preselectedPackages?.[0] ?? null)
  const [quickPayAmt,    setQuickPayAmt]    = useState('')
  const [quickPayMethod, setQuickPayMethod] = useState<PaymentMethod>('cash')
  const [quickPayDate,   setQuickPayDate]   = useState(new Date().toISOString().slice(0, 10))
  const [quickPayRef,    setQuickPayRef]    = useState('')

  // Modal filters (client-side filter on search results)
  const [mFilterFinStatus,   setMFilterFinStatus]   = useState('')
  const [mFilterExhausted,   setMFilterExhausted]   = useState(false)
  const [mFilterNoPackage,   setMFilterNoPackage]   = useState(false)

  const debounceRef      = useRef<NodeJS.Timeout | null>(null)
  const resultRefs       = useRef<(HTMLButtonElement | null)[]>([])
  const searchVersionRef = useRef(0)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // Student search with debounce + anti-stale versioning
  useEffect(() => {
    if (search.length < 2) { setResults([]); setSelectedIndex(-1); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const version = ++searchVersionRef.current
      setSearching(true)
      try {
        const qs  = new URLSearchParams({ q: search, branchIds: branchIds.join(',') })
        const res = await fetch(`/api/students/search?${qs}`)
        if (!res.ok || searchVersionRef.current !== version) return
        const data: StudentResult[] = await res.json()
        // Client-side ranking: exact code → exact phone → startsWith name → group match → partial
        const ranked = [...data].sort((a, b) => scoreResult(b, search) - scoreResult(a, search))
        setResults(ranked)
      } finally {
        if (searchVersionRef.current === version) setSearching(false)
      }
    }, 300)
  }, [search, branchIds])

  // Scroll keyboard-selected result into view
  useEffect(() => {
    if (selectedIndex >= 0) resultRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedIndex])

  const loadEnrollmentData = useCallback(async (branchId: string) => {
    const [cRes, iRes, gRes] = await Promise.all([
      fetch('/api/courses'),
      fetch(`/api/instructors?branchIds=${branchId}`),
      fetch(`/api/groups/by-branch?branchId=${branchId}`),
    ])
    if (cRes.ok) setCourses(await cRes.json())
    if (iRes.ok) setInstructors(await iRes.json())
    if (gRes.ok) setGroups(await gRes.json())
  }, [])

  // When opened with a pre-selected student, skip straight to step 2
  useEffect(() => {
    if (preselectedStudent) {
      setWarnings(computeWarnings(preselectedStudent))
      loadEnrollmentData(preselectedStudent.branch_id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectStudent(s: StudentResult) {
    setState(prev => ({ ...prev, student: s, step: 2, course: null, instructor: null, group: null }))
    setSearch(''); setResults([]); setSelectedIndex(-1)
    setWarnings(computeWarnings(s)); setCourseConflict(null)
    loadEnrollmentData(s.branch_id)
  }

  function handleCourseChange(courseId: string) {
    const c = courses.find(c => c.id === courseId) ?? null
    setState(prev => ({ ...prev, course: c }))
    if (courseId && state.student?.active_course_ids.includes(courseId)) {
      const title = c?.title ?? 'this course'
      setCourseConflict(`Already enrolled in ${title}. Verify before creating a second contract.`)
    } else {
      setCourseConflict(null)
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!displayResults.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => Math.min(prev + 1, displayResults.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => Math.max(prev - 1, 0)) }
    else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < displayResults.length) { e.preventDefault(); selectStudent(displayResults[selectedIndex]) }
  }

  function selectGroup(g: GroupResult | null) {
    setState(prev => {
      const next = { ...prev, group: g }
      if (g && !prev.course && g.course_id) {
        const c = courses.find(c => c.id === g.course_id)
        if (c) next.course = c
      }
      if (g && !prev.instructor && g.instructor_id) {
        const i = instructors.find(i => i.id === g.instructor_id)
        if (i) next.instructor = i
      }
      return next
    })
  }

  // Apply modal filters to search results
  const displayResults = useMemo(() => {
    let out = results
    if (mFilterFinStatus) out = out.filter(r => r.financial_status === mFilterFinStatus)
    if (mFilterExhausted) out = out.filter(r =>
      r.enrolled_sessions != null && r.enrolled_sessions > 0 &&
      r.remaining_sessions != null && r.remaining_sessions <= 0
    )
    if (mFilterNoPackage) out = out.filter(r => r.active_enrollments_count === 0)
    return out
  }, [results, mFilterFinStatus, mFilterExhausted, mFilterNoPackage])

  const net      = Math.max(0, (parseFloat(state.totalAmount) || 0) - (parseFloat(state.discountAmount) || 0))
  const initPay  = parseFloat(state.initPayAmount) || 0
  const remaining = Math.max(0, net - initPay)

  async function handleSubmit() {
    if (!state.student || !state.course) { setError('Please select a student and course'); return }
    if (!state.totalAmount || net <= 0)  { setError('Please enter a valid total amount'); return }
    setSubmitting(true); setError(null)

    const result = await enrollStudentFull({
      student_id:               state.student.id,
      branch_id:                state.student.branch_id,
      group_id:                 state.group?.id ?? null,
      course_id:                state.course.id,
      instructor_id:            state.instructor?.id ?? null,
      start_date:               state.startDate,
      enrollment_type:          state.enrollmentType,
      enrolled_sessions:        parseInt(state.enrolledSessions) || 0,
      total_amount:             parseFloat(state.totalAmount) || 0,
      discount_amount:          parseFloat(state.discountAmount) || 0,
      installment_count:        parseInt(state.installmentCount) || 0,
      first_due_date:           state.firstDueDate,
      initial_payment_amount:   initPay,
      initial_payment_method:   state.initPayMethod,
      initial_payment_date:     state.initPayDate,
      initial_payment_reference: state.initPayRef || undefined,
      initial_payment_notes:    state.initPayNotes || undefined,
    })

    setSubmitting(false)
    if ('error' in result) { setError(result.error) }
    else { onSuccess(); onClose() }
  }

  async function handleExistingPaySubmit() {
    if (!selectedPkg?.account_id) { setError('Selected package has no financial account'); return }
    if (!state.student)           { setError('No student selected'); return }
    const amount = parseFloat(quickPayAmt)
    if (!amount || amount <= 0)   { setError('Enter a valid amount'); return }
    setSubmitting(true); setError(null)
    const result = await addPayment({
      account_id:       selectedPkg.account_id,
      student_id:       state.student.id,
      enrollment_id:    selectedPkg.enrollment_id,
      amount,
      payment_date:     quickPayDate,
      payment_method:   quickPayMethod,
      reference_number: quickPayRef || undefined,
    })
    setSubmitting(false)
    if ('error' in result) setError(result.error)
    else { onSuccess(); onClose() }
  }

  function fmt(n: number) {
    return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
  }

  const hasModalFilter = !!(mFilterFinStatus || mFilterExhausted || mFilterNoPackage)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <div className="relative w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-[#0B1F3A]">Add Payment</h2>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Step {state.step} of 3 —{' '}
              {state.step === 1 ? 'Find Student' : state.step === 2 ? 'Contract Setup' : 'Finance Setup'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {[1,2,3].map(n => (
                <span key={n} className={`h-2 w-2 rounded-full ${n === state.step ? 'bg-[#FF8A1F]' : n < state.step ? 'bg-emerald-400' : 'bg-[#E2E8F0]'}`} />
              ))}
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── STEP 1: Find Student ─────────────────────────────────────────── */}
        {state.step === 1 && (
          <div className="flex flex-col">

            {/* Search input */}
            <div className="px-5 pt-4 pb-2">
              <div className="relative">
                <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                <input
                  autoFocus
                  value={search}
                  onChange={e => { setSearch(e.target.value); setSelectedIndex(-1) }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Name, code, phone, parent, group…"
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-3 pl-10 pr-10 text-sm text-[#0B1F3A] placeholder:text-[#94A3B8] focus:border-[#FF8A1F] focus:outline-none"
                  aria-label="Search students"
                />
                {searching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FF8A1F] border-t-transparent" />
                  </span>
                )}
              </div>

              {/* Modal filters */}
              {results.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <select
                    value={mFilterFinStatus}
                    onChange={e => { setMFilterFinStatus(e.target.value); setSelectedIndex(-1) }}
                    className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1 text-xs text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                  >
                    <option value="">All status</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="OVERDUE">Overdue</option>
                    <option value="DUE_SOON">Due Soon</option>
                    <option value="CURRENT">Current</option>
                  </select>

                  <label className="flex cursor-pointer items-center gap-1 text-[11px] text-[#64748B]">
                    <input type="checkbox" checked={mFilterExhausted} onChange={e => { setMFilterExhausted(e.target.checked); setSelectedIndex(-1) }}
                      className="h-3 w-3 rounded accent-[#FF8A1F]" />
                    Exhausted
                  </label>
                  <label className="flex cursor-pointer items-center gap-1 text-[11px] text-[#64748B]">
                    <input type="checkbox" checked={mFilterNoPackage} onChange={e => { setMFilterNoPackage(e.target.checked); setSelectedIndex(-1) }}
                      className="h-3 w-3 rounded accent-[#FF8A1F]" />
                    No Package
                  </label>

                  {hasModalFilter && (
                    <button
                      onClick={() => { setMFilterFinStatus(''); setMFilterExhausted(false); setMFilterNoPackage(false); setSelectedIndex(-1) }}
                      className="text-[11px] text-[#FF8A1F] hover:underline"
                    >
                      Clear ×
                    </button>
                  )}

                  <span className="ml-auto text-[10px] text-[#94A3B8]">
                    {displayResults.length} result{displayResults.length !== 1 ? 's' : ''} · ↑↓ Enter
                  </span>
                </div>
              )}
            </div>

            {/* Results list */}
            {displayResults.length > 0 && (
              <div className="max-h-104 divide-y divide-[#F1F5F9] overflow-y-auto border-t border-[#F1F5F9]">
                {displayResults.map((s, idx) => {
                  const isSelected  = idx === selectedIndex
                  const sessLeft    = s.remaining_sessions ?? 0
                  const sessTot     = s.enrolled_sessions  ?? 0
                  const isExhausted = sessTot > 0 && sessLeft <= 0
                  const isCritical  = sessTot > 0 && sessLeft <= 2 && sessLeft > 0
                  const noPackage   = s.active_enrollments_count === 0

                  return (
                    <button
                      key={s.id}
                      ref={el => { resultRefs.current[idx] = el }}
                      onClick={() => selectStudent(s)}
                      className={`w-full flex items-start gap-3 px-5 py-3 text-left transition-colors border-l-2 ${
                        isSelected ? 'bg-orange-50 border-[#FF8A1F]' : 'hover:bg-[#F8FAFC] border-transparent'
                      }`}
                      role="option" aria-selected={isSelected}
                    >
                      {/* Avatar */}
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        isExhausted ? 'bg-purple-100 text-purple-700' :
                        s.financial_status === 'OVERDUE' || s.financial_status === 'BLOCKED' ? 'bg-red-100 text-red-700' :
                        'bg-[#FF8A1F]/10 text-[#FF8A1F]'
                      }`}>
                        {s.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        {/* Row 1: name + code */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-sm font-semibold leading-tight text-[#0B1F3A]">
                            <Highlight text={s.name} query={search} />
                          </span>
                          {s.code && (
                            <span className="rounded bg-[#F1F5F9] px-1.5 py-px font-mono text-[10px] text-[#64748B]">
                              <Highlight text={s.code} query={search} />
                            </span>
                          )}
                          {s.age != null && (
                            <span className="text-[11px] text-[#94A3B8]">{s.age}y</span>
                          )}
                        </div>

                        {/* Row 2: phones */}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {s.phone && (
                            <span className="text-[11px] text-[#64748B]">
                              📱 <Highlight text={s.phone} query={search} />
                            </span>
                          )}
                          {s.parent_name && (
                            <span className="text-[11px] text-[#64748B]">
                              👤 <Highlight text={s.parent_name} query={search} />
                            </span>
                          )}
                          {s.parent_phone && (
                            <span className="text-[11px] text-[#64748B]">
                              <Highlight text={s.parent_phone} query={search} />
                            </span>
                          )}
                        </div>

                        {/* Row 3: branch · group · status badges */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="rounded bg-[#F1F5F9] px-1.5 py-px text-[11px] font-medium text-[#64748B]">
                            {s.branch_name}
                          </span>
                          {s.active_group_name && (
                            <span className="text-[11px] text-[#64748B]">
                              <Highlight text={s.active_group_name} query={search} />
                            </span>
                          )}
                          {s.financial_status && (
                            <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${FIN_BADGE[s.financial_status] ?? 'bg-slate-100 text-slate-600'}`}>
                              {FIN_LABEL[s.financial_status] ?? s.financial_status}
                            </span>
                          )}
                          {noPackage && (
                            <span className="rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-semibold text-amber-700">
                              No Package
                            </span>
                          )}
                          {isExhausted && (
                            <span className="rounded-full bg-purple-50 px-1.5 py-px text-[10px] font-semibold text-purple-700">
                              Exhausted
                            </span>
                          )}
                          {isCritical && !isExhausted && (
                            <span className="rounded-full bg-red-50 px-1.5 py-px text-[10px] font-semibold text-red-600">
                              {sessLeft} sess. left
                            </span>
                          )}
                          {sessTot > 0 && !isExhausted && !isCritical && (
                            <span className="text-[11px] text-[#64748B]">{sessLeft}/{sessTot} sess.</span>
                          )}
                          {s.active_enrollments_count > 1 && (
                            <span className="text-[10px] text-[#94A3B8]">{s.active_enrollments_count} active</span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Empty / hint states */}
            {search.length >= 2 && !searching && displayResults.length === 0 && results.length > 0 && (
              <div className="px-5 py-4 text-center">
                <p className="text-sm text-[#64748B]">No results match the active filters.</p>
                <button onClick={() => { setMFilterFinStatus(''); setMFilterExhausted(false); setMFilterNoPackage(false) }}
                  className="mt-1 text-xs text-[#FF8A1F] hover:underline">Clear filters</button>
              </div>
            )}
            {search.length >= 2 && !searching && results.length === 0 && (
              <div className="px-5 py-6 text-center">
                <p className="text-sm font-medium text-[#0B1F3A]">No students found for &ldquo;{search}&rdquo;</p>
                <p className="mt-1 text-xs text-[#94A3B8]">Try: student code · partial phone · parent name · Arabic name</p>
                <div className="mt-4 flex flex-col gap-2">
                  <a href="/portal/team-leader/students/new" target="_blank" rel="noopener noreferrer"
                    className="rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#0B1F3A] transition-colors hover:border-[#FF8A1F] hover:text-[#FF8A1F]">
                    + Create New Student
                  </a>
                  <a href="/portal/team-leader/leads" target="_blank" rel="noopener noreferrer"
                    className="rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition-colors hover:border-[#CBD5E1]">
                    Convert Existing Lead
                  </a>
                </div>
              </div>
            )}
            {search.length >= 2 && searching && results.length === 0 && (
              <div className="px-5 py-8 text-center">
                <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-[#FF8A1F] border-t-transparent" />
              </div>
            )}
            {search.length < 2 && (
              <div className="px-5 py-7 text-center">
                <p className="text-sm text-[#94A3B8]">Search by name, code, or phone</p>
                <p className="mt-0.5 text-xs text-[#CBD5E1]">parent name · parent phone · group name</p>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Contract Setup ───────────────────────────────────────── */}
        {state.step === 2 && state.student && (
          <div className="max-h-[72vh] overflow-y-auto p-6 space-y-4">

            {/* Selected student card */}
            <div className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF8A1F]/10 text-sm font-bold text-[#FF8A1F]">
                {state.student.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2">
                  <p className="text-sm font-semibold text-[#0B1F3A]">{state.student.name}</p>
                  {state.student.code && (
                    <span className="rounded bg-[#E2E8F0] px-1.5 py-px font-mono text-[10px] text-[#64748B]">
                      {state.student.code}
                    </span>
                  )}
                  {state.student.age != null && (
                    <span className="text-[11px] text-[#94A3B8]">{state.student.age}y</span>
                  )}
                </div>
                <p className="text-xs text-[#64748B]">
                  {state.student.branch_name}
                  {state.student.phone && <span className="ml-1">· {state.student.phone}</span>}
                </p>
              </div>
              <button
                onClick={() => { setState(prev => ({ ...prev, step: 1, student: null, course: null })); setSearch(''); setWarnings([]); setCourseConflict(null) }}
                className="shrink-0 text-xs text-[#FF8A1F] hover:underline"
              >
                Change
              </button>
            </div>

            {warnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
                {warnings.map((w, i) => <p key={i} className="text-xs font-medium text-amber-700">⚠ {w}</p>)}
              </div>
            )}

            {/* ── Mode selector: pay existing OR create new contract ──────────── */}
            {preselectedPackages && preselectedPackages.length > 0 && (
              <div className="flex gap-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1">
                <button
                  type="button"
                  onClick={() => setPayMode('existing')}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${payMode === 'existing' ? 'bg-[#FF8A1F] text-white shadow-sm' : 'text-[#64748B] hover:text-[#0B1F3A]'}`}
                >
                  Pay Existing Package
                </button>
                <button
                  type="button"
                  onClick={() => setPayMode('new')}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${payMode === 'new' ? 'bg-[#FF8A1F] text-white shadow-sm' : 'text-[#64748B] hover:text-[#0B1F3A]'}`}
                >
                  + New Contract
                </button>
              </div>
            )}

            {/* ── Existing package quick-pay form ───────────────────────────── */}
            {preselectedPackages && preselectedPackages.length > 0 && payMode === 'existing' && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#64748B]">Select Package</label>
                  <div className="divide-y divide-[#F1F5F9] rounded-xl border border-[#E2E8F0]">
                    {preselectedPackages.map(pkg => {
                      const isSelected = selectedPkg?.enrollment_id === pkg.enrollment_id
                      const canPay = !!pkg.account_id
                      const finColor =
                        pkg.financial_status === 'BLOCKED' ? 'text-red-700' :
                        pkg.financial_status === 'OVERDUE'  ? 'text-amber-700' :
                        pkg.remaining_sessions <= 0 ? 'text-purple-700' : 'text-emerald-700'
                      return (
                        <button
                          key={pkg.enrollment_id}
                          type="button"
                          onClick={() => canPay && setSelectedPkg(pkg)}
                          disabled={!canPay}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${isSelected ? 'bg-orange-50' : 'hover:bg-[#F8FAFC]'} ${!canPay ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                          <div>
                            <p className="text-sm font-medium text-[#0B1F3A]">
                              {pkg.course_name ?? pkg.group_name ?? 'Contract'}
                            </p>
                            <p className="text-xs text-[#64748B]">
                              {pkg.group_name && pkg.course_name ? `${pkg.group_name} · ` : ''}
                              {pkg.enrolled_sessions > 0 ? `${pkg.remaining_sessions}/${pkg.enrolled_sessions} sessions` : 'Unlimited'}
                            </p>
                          </div>
                          <div className="text-right">
                            {pkg.financial_status && (
                              <p className={`text-[11px] font-semibold ${finColor}`}>{pkg.financial_status}</p>
                            )}
                            {!canPay && <p className="text-[10px] text-[#94A3B8]">No account</p>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {selectedPkg?.account_id && (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#64748B]">Amount (EGP)</label>
                      <input
                        type="number" min="1" step="0.01"
                        value={quickPayAmt}
                        onChange={e => setQuickPayAmt(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[#64748B]">Method</label>
                        <select
                          value={quickPayMethod}
                          onChange={e => setQuickPayMethod(e.target.value as PaymentMethod)}
                          className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                        >
                          {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[#64748B]">Date</label>
                        <input
                          type="date"
                          value={quickPayDate}
                          onChange={e => setQuickPayDate(e.target.value)}
                          className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#64748B]">
                        Reference <span className="text-[11px] text-[#94A3B8]">(optional)</span>
                      </label>
                      <input
                        value={quickPayRef}
                        onChange={e => setQuickPayRef(e.target.value)}
                        placeholder="e.g. Instapay ref, receipt #"
                        className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                      />
                    </div>
                  </>
                )}

                {error && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>
                )}

                <div className="flex justify-between gap-3 pt-1">
                  <button type="button" onClick={onClose}
                    className="rounded-xl border border-[#E2E8F0] px-5 py-2.5 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExistingPaySubmit}
                    disabled={submitting || !selectedPkg?.account_id || !quickPayAmt}
                    className="flex items-center gap-2 rounded-xl bg-[#FF8A1F] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#e87c18] disabled:opacity-40"
                  >
                    {submitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                    Add Payment
                  </button>
                </div>
              </div>
            )}

            {state.student.active_summaries.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                  Current Active Enrollments ({state.student.active_summaries.length})
                </p>
                <div className="divide-y divide-[#F1F5F9] rounded-xl border border-[#E2E8F0]">
                  {state.student.active_summaries.map((e, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-[#0B1F3A]">{e.course_name ?? '—'}</p>
                        {e.group_name && <p className="truncate text-[11px] text-[#94A3B8]">{e.group_name}</p>}
                      </div>
                      <div className="ml-3 shrink-0 text-right">
                        {e.financial_status && (
                          <p className={`text-[10px] font-semibold ${
                            { CURRENT:'text-emerald-600', DUE_SOON:'text-amber-600', OVERDUE:'text-red-600', BLOCKED:'text-red-700' }[e.financial_status] ?? 'text-slate-500'
                          }`}>{e.financial_status}</p>
                        )}
                        <p className="text-[11px] text-[#94A3B8]">{e.remaining_sessions} sess. left</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Course */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#64748B]">
                Course <span className="text-red-400">*</span>
              </label>
              <select
                value={state.course?.id ?? ''}
                onChange={e => handleCourseChange(e.target.value)}
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
              >
                <option value="">Select a course…</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}{c.level ? ` (${c.level})` : ''}</option>)}
              </select>
              {courseConflict && <p className="mt-1 text-[11px] font-medium text-amber-600">⚠ {courseConflict}</p>}
            </div>

            {/* Instructor */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#64748B]">
                Instructor <span className="text-[11px] font-normal text-[#94A3B8]">(optional)</span>
              </label>
              <select
                value={state.instructor?.id ?? ''}
                onChange={e => { const i = instructors.find(i => i.id === e.target.value) ?? null; setState(prev => ({ ...prev, instructor: i })) }}
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
              >
                <option value="">No instructor assigned</option>
                {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>

            {/* Group */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#64748B]">
                Group <span className="text-[11px] font-normal text-[#94A3B8]">(optional)</span>
              </label>
              {groups.length === 0 ? (
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-center text-sm text-[#94A3B8]">
                  No active groups in this branch.
                </div>
              ) : (
                <div className="max-h-40 divide-y divide-[#F1F5F9] overflow-y-auto rounded-xl border border-[#E2E8F0]">
                  <button
                    onClick={() => selectGroup(null)}
                    className={`w-full flex items-center px-4 py-2.5 text-left text-sm hover:bg-[#F8FAFC] ${!state.group ? 'bg-orange-50 font-medium text-[#FF8A1F]' : 'text-[#64748B]'}`}
                  >
                    No group (standalone)
                  </button>
                  {groups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => selectGroup(g)}
                      className={`w-full flex items-start justify-between px-4 py-2.5 text-left hover:bg-[#F8FAFC] ${state.group?.id === g.id ? 'bg-orange-50' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0B1F3A] truncate">{g.name}</p>
                        <p className="text-xs text-[#64748B]">
                          {g.course_title ?? 'No course'}{g.instructor_name && ` · ${g.instructor_name}`}
                        </p>
                      </div>
                      {state.group?.id === g.id && (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8A1F]">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Session Package */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#64748B]">Session Package</label>
              <div className="mb-2 flex gap-1.5">
                {[12, 24, 36, 48].map(n => (
                  <button key={n} type="button"
                    onClick={() => setState(prev => ({ ...prev, enrolledSessions: String(n) }))}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                      state.enrolledSessions === String(n) ? 'border-[#FF8A1F] bg-orange-50 text-[#FF8A1F]' : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                    }`}>
                    {n}
                  </button>
                ))}
                <button type="button"
                  onClick={() => setState(prev => ({ ...prev, enrolledSessions: '0' }))}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                    state.enrolledSessions === '0' ? 'border-[#FF8A1F] bg-orange-50 text-[#FF8A1F]' : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                  }`}>
                  ∞
                </button>
              </div>
              <input
                type="number" min="0" max="500" step="1"
                value={state.enrolledSessions}
                onChange={e => { const v = e.target.value; if (v === '' || parseInt(v) >= 0) setState(prev => ({ ...prev, enrolledSessions: v })) }}
                placeholder="Or enter custom (0 = unlimited)"
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
              />
            </div>

            {/* Enrollment type + start date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#64748B]">Enrollment Type</label>
                <select
                  value={state.enrollmentType}
                  onChange={e => setState(prev => ({ ...prev, enrollmentType: e.target.value as 'primary' | 'secondary' }))}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                >
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#64748B]">Start Date</label>
                <input
                  type="date" value={state.startDate}
                  onChange={e => setState(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>
            </div>

            {payMode !== 'existing' && (
              <div className="flex gap-3 border-t border-[#E2E8F0] pt-4">
                <button onClick={() => setState(prev => ({ ...prev, step: 1 }))}
                  className="flex-1 rounded-xl border border-[#E2E8F0] py-2.5 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]">
                  Back
                </button>
                <button
                  disabled={!state.course}
                  onClick={() => setState(prev => ({ ...prev, step: 3 }))}
                  className="flex-1 rounded-xl bg-[#FF8A1F] py-2.5 text-sm font-medium text-white hover:bg-[#e87c18] disabled:opacity-40"
                >
                  Next: Finance →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Finance Setup ────────────────────────────────────────── */}
        {state.step === 3 && state.student && state.course && (
          <div className="p-6 space-y-5">

            {/* Summary */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs space-y-1">
              <p><span className="text-[#94A3B8]">Student:</span> <span className="font-medium text-[#0B1F3A]">{state.student.name}</span></p>
              <p><span className="text-[#94A3B8]">Course:</span> <span className="font-medium text-[#0B1F3A]">{state.course.title}</span></p>
              {state.instructor && <p><span className="text-[#94A3B8]">Instructor:</span> <span className="text-[#64748B]">{state.instructor.name}</span></p>}
              {state.group && <p><span className="text-[#94A3B8]">Group:</span> <span className="text-[#64748B]">{state.group.name}</span></p>}
              {state.enrolledSessions && parseInt(state.enrolledSessions) > 0 && (
                <p><span className="text-[#94A3B8]">Sessions:</span> <span className="text-[#64748B]">{state.enrolledSessions}</span></p>
              )}
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#64748B]">Total Amount (EGP)</label>
                <input type="number" min="0" step="50" value={state.totalAmount}
                  onChange={e => setState(prev => ({ ...prev, totalAmount: e.target.value }))}
                  placeholder="e.g. 3000"
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#64748B]">Discount (EGP)</label>
                <input type="number" min="0" step="50" value={state.discountAmount}
                  onChange={e => setState(prev => ({ ...prev, discountAmount: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none" />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
              <span className="text-sm font-medium text-emerald-700">Net Total</span>
              <span className="text-lg font-bold text-emerald-700">EGP {fmt(net)}</span>
            </div>

            {/* Installments */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#64748B]">Installments (0 = no plan)</label>
                <input type="number" min="0" max="24" value={state.installmentCount}
                  onChange={e => setState(prev => ({ ...prev, installmentCount: e.target.value }))}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#64748B]">First Due Date</label>
                <input type="date" value={state.firstDueDate}
                  onChange={e => setState(prev => ({ ...prev, firstDueDate: e.target.value }))}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none" />
              </div>
            </div>

            {/* Initial payment */}
            <div>
              <p className="mb-2 text-xs font-semibold text-[#64748B]">
                Initial Payment <span className="font-normal text-[#94A3B8]">(optional)</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] text-[#94A3B8]">Amount Paid Now</label>
                  <input type="number" min="0" value={state.initPayAmount}
                    onChange={e => setState(prev => ({ ...prev, initPayAmount: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#94A3B8]">Method</label>
                  <select value={state.initPayMethod}
                    onChange={e => setState(prev => ({ ...prev, initPayMethod: e.target.value as PaymentMethod }))}
                    className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#94A3B8]">Payment Date</label>
                  <input type="date" value={state.initPayDate}
                    onChange={e => setState(prev => ({ ...prev, initPayDate: e.target.value }))}
                    className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#94A3B8]">Reference (optional)</label>
                  <input value={state.initPayRef}
                    onChange={e => setState(prev => ({ ...prev, initPayRef: e.target.value }))}
                    placeholder="Instapay ref, etc."
                    className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none" />
                </div>
              </div>
            </div>

            {/* Preview */}
            {net > 0 && (
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Net Total</span>
                  <span className="font-medium text-[#0B1F3A]">EGP {fmt(net)}</span>
                </div>
                {parseInt(state.enrolledSessions) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Sessions Package</span>
                    <span className="font-medium text-[#0B1F3A]">{state.enrolledSessions} sessions</span>
                  </div>
                )}
                {initPay > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Paid Now</span>
                    <span className="font-medium text-emerald-600">EGP {fmt(initPay)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[#E2E8F0] pt-1.5">
                  <span className="text-[#94A3B8]">Remaining</span>
                  <span className={`font-bold ${remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    EGP {fmt(remaining)}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <div className="flex gap-3 border-t border-[#E2E8F0] pt-4">
              <button onClick={() => setState(prev => ({ ...prev, step: 2 }))}
                className="flex-1 rounded-xl border border-[#E2E8F0] py-2.5 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]">
                Back
              </button>
              <button
                disabled={submitting || !state.totalAmount || net <= 0}
                onClick={handleSubmit}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#FF8A1F] py-2.5 text-sm font-medium text-white hover:bg-[#e87c18] disabled:opacity-40"
              >
                {submitting ? (
                  <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Creating…</>
                ) : 'Create Contract'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
