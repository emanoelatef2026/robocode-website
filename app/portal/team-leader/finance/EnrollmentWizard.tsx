'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { enrollStudentFull } from '@/modules/enrollments/actions'
import type { PaymentMethod } from '@/modules/finance/types'
import { PAYMENT_METHOD_LABELS } from '@/modules/finance/types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface StudentResult {
  id:          string
  name:        string
  code:        string | null
  email:       string | null
  phone:       string | null
  branch_id:   string
  branch_name: string
  parent_name: string | null
  parent_phone: string | null
}

interface CourseResult {
  id:    string
  title: string
  level: string | null
}

interface InstructorResult {
  id:   string
  name: string
}

interface GroupResult {
  id:              string
  name:            string
  course_id:       string | null
  course_title:    string | null
  instructor_id:   string | null
  instructor_name: string | null
}

interface WizardState {
  step:            1 | 2 | 3
  student:         StudentResult | null
  course:          CourseResult | null
  instructor:      InstructorResult | null
  group:           GroupResult | null       // optional
  startDate:       string
  enrollmentType:  'primary' | 'secondary'
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

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  branchIds: string[]
  onClose:   () => void
  onSuccess: () => void
}

export default function EnrollmentWizard({ branchIds, onClose, onSuccess }: Props) {
  const [state, setState] = useState<WizardState>({
    step: 1, student: null, course: null, instructor: null, group: null,
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

  const [search,      setSearch]      = useState('')
  const [results,     setResults]     = useState<StudentResult[]>([])
  const [courses,     setCourses]     = useState<CourseResult[]>([])
  const [instructors, setInstructors] = useState<InstructorResult[]>([])
  const [groups,      setGroups]      = useState<GroupResult[]>([])
  const [searching,   setSearching]   = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // Student search with debounce
  useEffect(() => {
    if (search.length < 2) { setResults([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const qs = new URLSearchParams({ q: search, branchIds: branchIds.join(',') })
        const res = await fetch(`/api/students/search?${qs}`)
        if (res.ok) setResults(await res.json())
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [search, branchIds])

  // Load courses + instructors + groups when student selected
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

  function selectStudent(s: StudentResult) {
    setState(prev => ({ ...prev, student: s, step: 2 }))
    setSearch('')
    setResults([])
    loadEnrollmentData(s.branch_id)
  }

  // When a group is selected, auto-fill course/instructor if not set
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

  const net      = Math.max(0, (parseFloat(state.totalAmount) || 0) - (parseFloat(state.discountAmount) || 0))
  const initPay  = parseFloat(state.initPayAmount) || 0
  const remaining = Math.max(0, net - initPay)

  async function handleSubmit() {
    if (!state.student || !state.course) { setError('Please select a student and course'); return }
    if (!state.totalAmount || net <= 0) { setError('Please enter a valid total amount'); return }
    setSubmitting(true)
    setError(null)

    const result = await enrollStudentFull({
      student_id:        state.student.id,
      branch_id:         state.student.branch_id,
      group_id:          state.group?.id ?? null,
      course_id:         state.course.id,
      instructor_id:     state.instructor?.id ?? null,
      start_date:        state.startDate,
      enrollment_type:   state.enrollmentType,
      enrolled_sessions: parseInt(state.enrolledSessions) || 0,
      total_amount:      parseFloat(state.totalAmount) || 0,
      discount_amount:   parseFloat(state.discountAmount) || 0,
      installment_count: parseInt(state.installmentCount) || 0,
      first_due_date:    state.firstDueDate,
      initial_payment_amount:    initPay,
      initial_payment_method:    state.initPayMethod,
      initial_payment_date:      state.initPayDate,
      initial_payment_reference: state.initPayRef || undefined,
      initial_payment_notes:     state.initPayNotes || undefined,
    })

    setSubmitting(false)
    if ('error' in result) {
      setError(result.error)
    } else {
      onSuccess()
      onClose()
    }
  }

  function fmt(n: number) {
    return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <div className="relative w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-[#0B1F3A]">New Enrollment</h2>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Step {state.step} of 3 — {state.step === 1 ? 'Find Student' : state.step === 2 ? 'Contract Setup' : 'Finance Setup'}
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

        {/* ── Step 1: Find Student ──────────────────────────────────────── */}
        {state.step === 1 && (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">
                Search student by name, phone, or parent phone
              </label>
              <div className="relative">
                <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Name, phone, student code, parent phone…"
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-3 pl-10 pr-4 text-sm text-[#0B1F3A] placeholder:text-[#94A3B8] focus:border-[#FF8A1F] focus:outline-none"
                />
                {searching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FF8A1F] border-t-transparent" />
                  </span>
                )}
              </div>
            </div>
            {results.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-xl border border-[#E2E8F0] divide-y divide-[#F1F5F9]">
                {results.map(s => (
                  <button key={s.id} onClick={() => selectStudent(s)} className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAFC] text-left">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF8A1F]/10 text-sm font-bold text-[#FF8A1F]">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0B1F3A]">{s.name}</p>
                      <p className="text-xs text-[#64748B]">{s.branch_name}{s.code && <span className="ml-1 text-[#94A3B8]">#{s.code}</span>}</p>
                      {(s.parent_name || s.parent_phone || s.phone) && (
                        <p className="text-[11px] text-[#94A3B8]">{[s.parent_name, s.parent_phone ?? s.phone].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {search.length >= 2 && !searching && results.length === 0 && (
              <p className="text-center text-sm text-[#94A3B8]">No students found matching &ldquo;{search}&rdquo;</p>
            )}
            {search.length < 2 && (
              <p className="text-center text-sm text-[#94A3B8]">Type at least 2 characters to search</p>
            )}
          </div>
        )}

        {/* ── Step 2: Contract Setup ────────────────────────────────────── */}
        {state.step === 2 && state.student && (
          <div className="p-6 space-y-4">
            {/* Selected student */}
            <div className="flex items-center gap-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF8A1F]/10 text-sm font-bold text-[#FF8A1F]">
                {state.student.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#0B1F3A]">{state.student.name}</p>
                <p className="text-xs text-[#64748B]">{state.student.branch_name}{state.student.code ? ` · #${state.student.code}` : ''}</p>
              </div>
              <button onClick={() => { setState(prev => ({ ...prev, step: 1, student: null })); setSearch('') }} className="text-xs text-[#FF8A1F] hover:underline">Change</button>
            </div>

            {/* Course — REQUIRED */}
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">
                Course <span className="text-red-400">*</span>
              </label>
              <select
                value={state.course?.id ?? ''}
                onChange={e => {
                  const c = courses.find(c => c.id === e.target.value) ?? null
                  setState(prev => ({ ...prev, course: c }))
                }}
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
              >
                <option value="">Select a course…</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}{c.level ? ` (${c.level})` : ''}</option>)}
              </select>
            </div>

            {/* Instructor — optional */}
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">
                Instructor <span className="text-[#94A3B8] text-[11px]">(optional)</span>
              </label>
              <select
                value={state.instructor?.id ?? ''}
                onChange={e => {
                  const i = instructors.find(i => i.id === e.target.value) ?? null
                  setState(prev => ({ ...prev, instructor: i }))
                }}
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
              >
                <option value="">No instructor assigned</option>
                {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>

            {/* Group — optional */}
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1.5">
                Group <span className="text-[#94A3B8] text-[11px]">(optional — delivery container)</span>
              </label>
              {groups.length === 0 ? (
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#94A3B8] text-center">
                  No active groups in this branch.
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-[#E2E8F0] divide-y divide-[#F1F5F9]">
                  {/* None option */}
                  <button
                    onClick={() => selectGroup(null)}
                    className={`w-full flex items-center px-4 py-2.5 text-left text-sm hover:bg-[#F8FAFC] ${!state.group ? 'bg-orange-50 font-medium text-[#FF8A1F]' : 'text-[#64748B]'}`}
                  >
                    No group (standalone enrollment)
                  </button>
                  {groups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => selectGroup(g)}
                      className={`w-full flex items-start justify-between px-4 py-2.5 hover:bg-[#F8FAFC] text-left ${state.group?.id === g.id ? 'bg-orange-50' : ''}`}
                    >
                      <div>
                        <p className="text-sm font-medium text-[#0B1F3A]">{g.name}</p>
                        <p className="text-xs text-[#64748B]">
                          {g.course_title ?? 'No course'}
                          {g.instructor_name && <span className="ml-1">· {g.instructor_name}</span>}
                        </p>
                      </div>
                      {state.group?.id === g.id && (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#FF8A1F] shrink-0 mt-0.5">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sessions + type + start date */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">Session Package</label>
                <input
                  type="number" min="0" max="200" step="1"
                  value={state.enrolledSessions}
                  onChange={e => setState(prev => ({ ...prev, enrolledSessions: e.target.value }))}
                  placeholder="e.g. 30"
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                />
                <p className="mt-0.5 text-[10px] text-[#94A3B8]">0 = unlimited</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">Type</label>
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
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={state.startDate}
                  onChange={e => setState(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 border-t border-[#E2E8F0] pt-4">
              <button onClick={() => setState(prev => ({ ...prev, step: 1 }))} className="flex-1 rounded-xl border border-[#E2E8F0] py-2.5 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]">
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
          </div>
        )}

        {/* ── Step 3: Finance Setup ─────────────────────────────────────── */}
        {state.step === 3 && state.student && state.course && (
          <div className="p-6 space-y-5">
            {/* Summary */}
            <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-3 text-xs space-y-1">
              <p><span className="text-[#94A3B8]">Student:</span> <span className="font-medium text-[#0B1F3A]">{state.student.name}</span></p>
              <p><span className="text-[#94A3B8]">Course:</span> <span className="font-medium text-[#0B1F3A]">{state.course.title}</span></p>
              {state.instructor && <p><span className="text-[#94A3B8]">Instructor:</span> <span className="text-[#64748B]">{state.instructor.name}</span></p>}
              {state.group && <p><span className="text-[#94A3B8]">Group:</span> <span className="text-[#64748B]">{state.group.name}</span></p>}
              {state.enrolledSessions && parseInt(state.enrolledSessions) > 0 && (
                <p><span className="text-[#94A3B8]">Sessions:</span> <span className="text-[#64748B]">{state.enrolledSessions} sessions</span></p>
              )}
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">Total Amount (EGP)</label>
                <input
                  type="number" min="0" step="50"
                  value={state.totalAmount}
                  onChange={e => setState(prev => ({ ...prev, totalAmount: e.target.value }))}
                  placeholder="e.g. 3000"
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">Discount (EGP)</label>
                <input
                  type="number" min="0" step="50"
                  value={state.discountAmount}
                  onChange={e => setState(prev => ({ ...prev, discountAmount: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-700">Net Total</span>
              <span className="text-lg font-bold text-emerald-700">EGP {fmt(net)}</span>
            </div>

            {/* Installments */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">Installments (0 = no plan)</label>
                <input
                  type="number" min="0" max="24"
                  value={state.installmentCount}
                  onChange={e => setState(prev => ({ ...prev, installmentCount: e.target.value }))}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">First Due Date</label>
                <input
                  type="date"
                  value={state.firstDueDate}
                  onChange={e => setState(prev => ({ ...prev, firstDueDate: e.target.value }))}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>
            </div>

            {/* Initial payment */}
            <div>
              <p className="text-xs font-semibold text-[#64748B] mb-2">Initial Payment <span className="text-[#94A3B8] font-normal">(optional)</span></p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#94A3B8] mb-1">Amount Paid Now</label>
                  <input
                    type="number" min="0"
                    value={state.initPayAmount}
                    onChange={e => setState(prev => ({ ...prev, initPayAmount: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#94A3B8] mb-1">Method</label>
                  <select
                    value={state.initPayMethod}
                    onChange={e => setState(prev => ({ ...prev, initPayMethod: e.target.value as PaymentMethod }))}
                    className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                  >
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[#94A3B8] mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={state.initPayDate}
                    onChange={e => setState(prev => ({ ...prev, initPayDate: e.target.value }))}
                    className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#94A3B8] mb-1">Reference (optional)</label>
                  <input
                    value={state.initPayRef}
                    onChange={e => setState(prev => ({ ...prev, initPayRef: e.target.value }))}
                    placeholder="Instapay ref, etc."
                    className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Preview card */}
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
                  <span className={`font-bold ${remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>EGP {fmt(remaining)}</span>
                </div>
              </div>
            )}

            {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 border-t border-[#E2E8F0] pt-4">
              <button onClick={() => setState(prev => ({ ...prev, step: 2 }))} className="flex-1 rounded-xl border border-[#E2E8F0] py-2.5 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]">
                Back
              </button>
              <button
                disabled={submitting || !state.totalAmount || net <= 0}
                onClick={handleSubmit}
                className="flex-1 rounded-xl bg-[#FF8A1F] py-2.5 text-sm font-medium text-white hover:bg-[#e87c18] disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Creating…</>
                ) : 'Create Enrollment'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
