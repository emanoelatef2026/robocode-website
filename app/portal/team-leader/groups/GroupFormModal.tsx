'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { createGroupModal, updateGroupModal } from '@/modules/groups/modal-actions'
import type { GroupOperationalRow, GroupFormOptions, GroupStudentOption } from '@/modules/groups/operational'
import type { ActionResult } from '@/types/app'

// ── Types ──────────────────────────────────────────────────────────────────────

interface StudentLink {
  _key:               string
  student_id:         string
  student_name:       string
  student_code:       string | null
  branch_name:        string
  age:                number | null
  phone:              string | null
  parent_phone:       string | null
  attendance_pct:     number | null
  sessions_remaining: number | null
}

interface Props {
  isOpen:         boolean
  mode:           'create' | 'edit'
  group?:         GroupOperationalRow
  options:        GroupFormOptions
  studentOptions: GroupStudentOption[]
  defaultBranchId?: string
  onClose:        () => void
  onSuccess:      (id: string) => void
}

const DAYS = [
  { value: 'sunday',    label: 'Sunday'    },
  { value: 'monday',    label: 'Monday'    },
  { value: 'tuesday',   label: 'Tuesday'   },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday',  label: 'Thursday'  },
  { value: 'friday',    label: 'Friday'    },
  { value: 'saturday',  label: 'Saturday'  },
]

const TYPES = [
  { value: 'class',     label: 'Class'     },
  { value: 'workshop',  label: 'Workshop'  },
  { value: 'bootcamp',  label: 'Bootcamp'  },
  { value: 'trial',     label: 'Trial'     },
  { value: 'makeup',    label: 'Makeup'    },
]

const STATUSES = ['forming','active','completed','cancelled']

// Normalize Egyptian phone numbers (012…, +2012…, 2012…, 002012…) to digit-only local form.
function normalizeEgyptianPhone(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.startsWith('002') && digits.length >= 13) return '0' + digits.slice(3)
  if (digits.startsWith('20')  && digits.length >= 12) return '0' + digits.slice(2)
  return digits
}

function phoneMatch(query: string, phone: string | null | undefined): boolean {
  if (!phone || !query) return false
  const qNorm = normalizeEgyptianPhone(query)
  const pNorm = normalizeEgyptianPhone(phone)
  return qNorm.length >= 4 && pNorm.includes(qNorm)
}

// ── Student row helpers ────────────────────────────────────────────────────────

function attColor(pct: number | null): string {
  if (pct == null) return 'text-[#94A3B8]'
  return pct >= 75 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-500'
}

function sessColor(rem: number | null): string {
  if (rem == null) return 'text-[#64748B]'
  return rem <= 2 ? 'text-red-500' : 'text-[#64748B]'
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function GroupFormModal({ isOpen, mode, group, options, studentOptions, defaultBranchId, onClose, onSuccess }: Props) {
  const action = mode === 'create' ? createGroupModal : updateGroupModal
  const [state, dispatch, pending] = useActionState<ActionResult<{ id: string }> | null, FormData>(action as any, null)

  // Branch selection — controlled so it can be initialized on open
  const [selectedBranchId, setSelectedBranchId] = useState('')

  // Controlled instructor selects — prevents same-person-in-both bug
  const [leadInstrId, setLeadInstrId] = useState('')
  const [asstInstrId, setAsstInstrId] = useState('')

  // Student allocation state
  const [links, setLinks]           = useState<StudentLink[]>([])
  const [toRemove, setToRemove]     = useState<string[]>([])
  const [pickerQ, setPickerQ]       = useState('')
  const [showPicker, setShowPicker] = useState(false)

  // Picker filters
  const [pickerBranch, setPickerBranch]     = useState('')
  const [pickerHasGroup, setPickerHasGroup] = useState<'' | 'has' | 'none'>('')

  const pickerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // ── Init on open ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return

    setSelectedBranchId(group?.branch_id ?? defaultBranchId ?? options.branches[0]?.id ?? '')
    setLeadInstrId(group?.lead_instructor_id ?? '')
    setAsstInstrId(group?.asst_instructor_id ?? '')

    if (mode === 'edit' && group) {
      // Hydrate operational fields from studentOptions where available
      const optMap = new Map(studentOptions.map(s => [s.student_id, s]))
      setLinks(
        (group.enrolled_students ?? []).map(s => {
          const opt = optMap.get(s.student_id)
          return {
            _key:               s.student_id,
            student_id:         s.student_id,
            student_name:       s.student_name,
            student_code:       s.student_code,
            branch_name:        opt?.branch_name ?? group.branch_name,
            age:                opt?.age          ?? null,
            phone:              opt?.phone         ?? null,
            parent_phone:       opt?.parent_phone  ?? null,
            attendance_pct:     opt?.attendance_pct     ?? null,
            sessions_remaining: opt?.sessions_remaining ?? null,
          }
        })
      )
    } else {
      setLinks([])
    }
    setToRemove([])
    setPickerQ('')
    setShowPicker(false)
    setPickerBranch('')
    setPickerHasGroup('')
  }, [isOpen, mode, group, studentOptions])

  // ── Close on success ────────────────────────────────────────────────────────
  useEffect(() => {
    if (state?.success) onSuccess(state.data.id)
  }, [state])

  // ── Click-outside picker ─────────────────────────────────────────────────────
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // ── ESC key ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (showPicker) { setShowPicker(false); return }
      onClose()
    }
    if (isOpen) document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [isOpen, showPicker, onClose])

  if (!isOpen) return null

  // ── Instructor dropdown filtering — hard-prevent duplicate assignment ─────
  const isDuplicateInstr = !!(leadInstrId && asstInstrId && leadInstrId === asstInstrId)
  const leadOptions = options.instructors.filter(i => !asstInstrId || i.id !== asstInstrId)
  const asstOptions = options.instructors.filter(i => !leadInstrId || i.id !== leadInstrId)

  // ── Student picker helpers ───────────────────────────────────────────────────
  const linkedIds = new Set(links.map(l => l.student_id))

  const filtered = studentOptions.filter(s => {
    if (linkedIds.has(s.student_id)) return false
    if (pickerBranch && s.branch_id !== pickerBranch) return false
    if (pickerHasGroup === 'has'  && !s.group_name) return false
    if (pickerHasGroup === 'none' &&  s.group_name) return false

    const q = pickerQ.toLowerCase().trim()
    if (!q) return true

    if (phoneMatch(pickerQ, s.phone))        return true
    if (phoneMatch(pickerQ, s.parent_phone)) return true

    return (
      s.student_name.toLowerCase().includes(q) ||
      (s.student_code ?? '').toLowerCase().includes(q)
    )
  }).slice(0, 40)

  function addStudent(s: GroupStudentOption) {
    setLinks(prev => {
      if (prev.some(l => l.student_id === s.student_id)) return prev
      return [...prev, {
        _key:               s.student_id,
        student_id:         s.student_id,
        student_name:       s.student_name,
        student_code:       s.student_code,
        branch_name:        s.branch_name,
        age:                s.age,
        phone:              s.phone,
        parent_phone:       s.parent_phone,
        attendance_pct:     s.attendance_pct,
        sessions_remaining: s.sessions_remaining,
      }]
    })
    setPickerQ('')
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  function removeLink(studentId: string) {
    setLinks(prev => prev.filter(l => l.student_id !== studentId))
    if (mode === 'edit' && group?.enrolled_students.some(s => s.student_id === studentId)) {
      setToRemove(prev => [...prev, studentId])
    }
  }

  const originalIds   = new Set((group?.enrolled_students ?? []).map(s => s.student_id))
  const studentsToAdd = links.filter(l => !originalIds.has(l.student_id)).map(l => l.student_id)

  const addJson    = JSON.stringify(studentsToAdd)
  const removeJson = JSON.stringify(toRemove)

  // ── Derived defaults ─────────────────────────────────────────────────────────
  const name        = group?.name            ?? ''
  const type        = group?.type            ?? 'class'
  const status      = group?.status          ?? 'forming'
  const capacity    = group?.capacity        ?? ''
  const courseId    = group?.course_id       ?? ''
  const dayOfWeek   = group?.day_of_week     ?? ''
  const startTime   = group?.start_time      ?? ''
  const durationMin = group?.duration_minutes ?? ''
  const startDate   = group?.start_date      ?? ''
  const endDate     = group?.end_date        ?? ''
  const meetingLink = group?.meeting_link    ?? ''
  const notes       = group?.notes           ?? ''

  const title = mode === 'create' ? 'New Group' : `Edit: ${group?.name}`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E2E8F0] bg-white px-5 py-4">
          <h2 className="text-base font-semibold text-[#0B1F3A]">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0B1F3A] transition">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>

        <form action={dispatch} className="px-5 py-4 space-y-5">
          {mode === 'edit' && <input type="hidden" name="id" value={group?.group_id} />}
          <input type="hidden" name="students_to_add_json"    value={addJson} />
          <input type="hidden" name="students_to_remove_json" value={removeJson} />

          {/* ── Basic Info ─────────────────────────────────────────────────── */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Basic Info</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Name <span className="text-red-500">*</span></label>
                <input name="name" defaultValue={name} required
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
                  placeholder="e.g. Scratch Beginners – Batch 3" />
              </div>

              {/* Branch — visible selector ensures branch is always intentionally set */}
              {options.branches.length === 1 ? (
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Branch</label>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#374151]">
                    {options.branches[0].name}
                  </div>
                  <input type="hidden" name="branch_id" value={options.branches[0].id} />
                </div>
              ) : (
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Branch <span className="text-red-500">*</span></label>
                  <select
                    name="branch_id"
                    value={selectedBranchId}
                    onChange={e => setSelectedBranchId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
                  >
                    <option value="">— Select branch —</option>
                    {options.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Type <span className="text-red-500">*</span></label>
                <select name="type" defaultValue={type}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20">
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Max Capacity</label>
                <input name="capacity" type="number" min={1} max={500} defaultValue={capacity as string}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
                  placeholder="Optional" />
              </div>

              {mode === 'edit' && (
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Status</label>
                  <select name="status" defaultValue={status}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20">
                    {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              )}

              <div className={mode === 'edit' ? '' : 'sm:col-span-2'}>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Notes</label>
                <textarea name="notes" defaultValue={notes} rows={2}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20 resize-none"
                  placeholder="Optional notes…" />
              </div>
            </div>
          </section>

          {/* ── Course & Instructor ───────────────────────────────────────── */}
          <section className="border-t border-[#F1F5F9] pt-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Course & Instructor</h3>

            {isDuplicateInstr && (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700 font-medium">
                Lead and assistant instructor must be different.
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Course</label>
                <select name="course_id" defaultValue={courseId}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20">
                  <option value="">— No course —</option>
                  {options.courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>

              {/* Lead — controlled; filters out current assistant */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Lead Instructor</label>
                <select
                  name="instructor_id"
                  value={leadInstrId}
                  onChange={e => setLeadInstrId(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
                >
                  <option value="">— No instructor —</option>
                  {leadOptions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>

              {/* Assistant — controlled; filters out current lead */}
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Assistant Instructor</label>
                <select
                  name="asst_instructor_id"
                  value={asstInstrId}
                  onChange={e => setAsstInstrId(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
                >
                  <option value="">— None —</option>
                  {asstOptions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* ── Schedule ─────────────────────────────────────────────────── */}
          <section className="border-t border-[#F1F5F9] pt-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Schedule</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Day</label>
                <select name="day_of_week" defaultValue={dayOfWeek}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20">
                  <option value="">—</option>
                  {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Start Time</label>
                <input name="start_time" type="time" defaultValue={startTime}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20" />
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Duration (min)</label>
                <input name="duration_minutes" type="number" min={15} max={480} defaultValue={durationMin as string}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
                  placeholder="90" />
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Start Date</label>
                <input name="start_date" type="date" defaultValue={startDate}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20" />
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">End Date</label>
                <input name="end_date" type="date" defaultValue={endDate}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20" />
              </div>

              <div className="col-span-2 sm:col-span-3">
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Meeting Link</label>
                <input name="meeting_link" type="url" defaultValue={meetingLink}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
                  placeholder="https://meet.google.com/…" />
              </div>
            </div>
          </section>

          {/* ── Students ─────────────────────────────────────────────────── */}
          <section className="border-t border-[#F1F5F9] pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Students</h3>
              <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-semibold text-[#64748B]">
                {links.length} linked
              </span>
            </div>

            {/* ── Selected student rows (stacked operational cards) ── */}
            {links.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {links.map(l => (
                  <div key={l._key} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        {/* Line 1: Name */}
                        <div className="text-[13px] font-semibold text-[#0B1F3A]">{l.student_name}</div>
                        {/* Line 2: Code • Age */}
                        <div className="text-[11px] text-[#64748B]">
                          {l.student_code ?? '—'}{' • '}{l.age != null ? `${l.age}y` : '—'}
                        </div>
                        {/* Line 3: Student phone */}
                        <div className="font-mono text-[11px] text-[#374151]">{l.phone ?? '—'}</div>
                        {/* Line 4: Parent phone */}
                        <div className="font-mono text-[11px] text-[#374151]">
                          Parent: {l.parent_phone ?? '—'}
                        </div>
                        {/* Line 5: Branch */}
                        <div className="text-[11px] text-[#94A3B8]">{l.branch_name}</div>
                        {/* Line 6: Sessions + attendance */}
                        <div className="flex flex-wrap items-center gap-x-2 text-[11px]">
                          {l.sessions_remaining != null
                            ? <span className={sessColor(l.sessions_remaining)}>{l.sessions_remaining} sessions left</span>
                            : <span className="text-[#94A3B8]">— sessions left</span>
                          }
                          {l.attendance_pct != null && (
                            <span className={attColor(l.attendance_pct)}>· {l.attendance_pct}% att.</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLink(l.student_id)}
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#E2E8F0] hover:text-[#374151] transition"
                        aria-label={`Remove ${l.student_name}`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Picker filters */}
            <div className="mb-2 flex flex-wrap gap-2">
              {options.branches.length > 1 && (
                <select
                  value={pickerBranch}
                  onChange={e => setPickerBranch(e.target.value)}
                  className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-[12px] text-[#374151] outline-none focus:border-[#FF8A1F]"
                >
                  <option value="">All Branches</option>
                  {options.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
              {(['', 'has', 'none'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPickerHasGroup(v)}
                  className={[
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                    pickerHasGroup === v
                      ? 'border-[#FF8A1F] bg-[#FF8A1F]/10 text-[#FF8A1F]'
                      : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]',
                  ].join(' ')}
                >
                  {v === '' ? 'All' : v === 'has' ? 'In a Group' : 'No Group'}
                </button>
              ))}
            </div>

            {/* Search picker */}
            <div ref={pickerRef} className="relative">
              <input
                ref={searchRef}
                type="text"
                value={pickerQ}
                onChange={e => { setPickerQ(e.target.value); setShowPicker(true) }}
                onFocus={() => setShowPicker(true)}
                placeholder="Name, code, student phone, or parent phone…"
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
              />
              {showPicker && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[#E2E8F0] bg-white shadow-lg">
                  {filtered.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-[#94A3B8]">{pickerQ ? 'No students found.' : 'Type to search…'}</p>
                  ) : filtered.map(s => (
                    <button
                      key={s.student_id}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); addStudent(s) }}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-[#FFF7ED] transition"
                    >
                      <div className="min-w-0 flex-1">
                        {/* Name + code • age */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-medium text-[#0B1F3A]">{s.student_name}</span>
                          <span className="font-mono text-[11px] text-[#94A3B8]">{s.student_code ?? '—'}</span>
                          <span className="text-[11px] text-[#64748B]">· {s.age != null ? `${s.age}y` : '—'}</span>
                        </div>
                        {/* Branch + group + phones */}
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-[#64748B]">
                          <span>{s.branch_name}</span>
                          {s.group_name && (
                            <span className="rounded bg-amber-50 px-1 text-amber-700">in {s.group_name}</span>
                          )}
                          <span>· {s.phone ?? '—'}</span>
                          <span>· P: {s.parent_phone ?? '—'}</span>
                        </div>
                      </div>
                      {/* Operational metrics */}
                      <div className="shrink-0 flex flex-col items-end gap-0.5">
                        {s.attendance_pct != null && (
                          <span className={`text-[11px] font-medium ${attColor(s.attendance_pct)}`}>
                            {s.attendance_pct}% att.
                          </span>
                        )}
                        <span className={`text-[11px] ${s.sessions_remaining != null ? sessColor(s.sessions_remaining) : 'text-[#94A3B8]'}`}>
                          {s.sessions_remaining != null ? `${s.sessions_remaining} sess. left` : '—'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Error */}
          {state && !state.success && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{state.error.message}</p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-4">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F8FAFC] transition">
              Cancel
            </button>
            <button type="submit" disabled={pending || isDuplicateInstr}
              className="rounded-lg bg-[#FF8A1F] px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18] disabled:opacity-60">
              {pending ? 'Saving…' : mode === 'create' ? 'Create Group' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
