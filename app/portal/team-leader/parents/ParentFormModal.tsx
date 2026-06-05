'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { createParentModal, updateParentModal } from '@/modules/parents/modal-actions'
import type { ParentOperationalRow, StudentPickerOption } from '@/modules/parents/operational'
import type { ActionResult } from '@/types/app'

// ── Types ──────────────────────────────────────────────────────────────────────

interface StudentLink {
  _key:         string
  student_id:   string
  student_name: string
  student_code: string | null
  branch_name:  string
  relationship: string
  is_primary:   boolean
}

interface Props {
  mode:            'create' | 'edit'
  parent?:         ParentOperationalRow
  studentOptions:  StudentPickerOption[]
  existingParents: ParentOperationalRow[]
  onClose:         () => void
  onSuccess:       () => void
}

const RELATIONS = ['father', 'mother', 'guardian', 'other'] as const

// ── Normalization helpers ──────────────────────────────────────────────────────

function normalizePhone(p: string): string {
  const s = p.replace(/[\s\-\(\)\+]/g, '')
  if (s.startsWith('20') && s.length >= 12) return '0' + s.slice(2)
  if (s.startsWith('002'))                  return '0' + s.slice(3)
  return s
}

function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ParentFormModal({
  mode, parent, studentOptions, existingParents, onClose, onSuccess,
}: Props) {
  const isEdit = mode === 'edit'

  // ── Student links state ─────────────────────────────────────────────────────
  const initialLinks: StudentLink[] = isEdit && parent?.children.length
    ? parent.children.map(c => ({
        _key:         crypto.randomUUID(),
        student_id:   c.student_id,
        student_name: c.student_name,
        student_code: c.student_code,
        branch_name:  c.branch_name,
        relationship: c.relationship,
        is_primary:   c.is_primary,
      }))
    : []

  const [links,      setLinks]      = useState<StudentLink[]>(initialLinks)
  const [dirty,      setDirty]      = useState(false)
  const [pickerQ,    setPickerQ]    = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef                   = useRef<HTMLDivElement>(null)
  const pickerInputRef              = useRef<HTMLInputElement>(null)

  // ── Duplicate detection state ───────────────────────────────────────────────
  const [dupWarning,   setDupWarning]   = useState<string | null>(null)
  const [phoneVal,     setPhoneVal]     = useState(parent?.phone ?? '')
  const [firstNameVal, setFirstNameVal] = useState(parent?.first_name ?? '')
  const [lastNameVal,  setLastNameVal]  = useState(parent?.last_name  ?? '')

  function checkDuplicates(phone: string, firstName: string, lastName: string) {
    if (!existingParents.length) return setDupWarning(null)
    const normPhone = normalizePhone(phone)
    const normName  = normalizeName(`${firstName} ${lastName}`.trim())
    for (const ep of existingParents) {
      if (ep.parent_id === parent?.parent_id) continue
      const epNormPhone = ep.phone ? normalizePhone(ep.phone) : null
      const epNormName  = normalizeName(ep.parent_name)
      if (normPhone.length >= 7 && epNormPhone && normPhone === epNormPhone) {
        return setDupWarning(`Possible duplicate: same phone as "${ep.parent_name}"`)
      }
      if (normName.length >= 4 && epNormName === normName) {
        return setDupWarning(`Possible duplicate: parent named "${ep.parent_name}" already exists`)
      }
    }
    setDupWarning(null)
  }

  // ── Server action ───────────────────────────────────────────────────────────
  const action = isEdit ? updateParentModal : createParentModal
  const [state, dispatch, pending] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    action as (prev: ActionResult<{ id: string }> | null, fd: FormData) => Promise<ActionResult<{ id: string }>>,
    null
  )

  useEffect(() => {
    if (state?.success) onSuccess()
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── ESC close + click-outside picker ───────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPicker) { setShowPicker(false); return }
        handleClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dirty, showPicker]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleClose() {
    if (dirty && !confirm('Discard unsaved changes?')) return
    onClose()
  }

  // ── Student picker ──────────────────────────────────────────────────────────
  const linkedIds = new Set(links.map(l => l.student_id))

  const pickerResults = pickerQ.length >= 1
    ? studentOptions.filter(s => {
        if (linkedIds.has(s.student_id)) return false
        const q      = pickerQ.toLowerCase()
        const qPhone = normalizePhone(pickerQ)
        const sPhone = s.phone ? normalizePhone(s.phone) : ''
        return (
          s.student_name.toLowerCase().includes(q) ||
          (s.student_code ?? '').toLowerCase().includes(q) ||
          (s.group_name  ?? '').toLowerCase().includes(q) ||
          s.branch_name.toLowerCase().includes(q) ||
          (qPhone.length >= 5 && sPhone.includes(qPhone))
        )
      }).slice(0, 10)
    : []

  function addStudent(s: StudentPickerOption) {
    if (linkedIds.has(s.student_id)) return
    setLinks(prev => [
      ...prev,
      {
        _key:         crypto.randomUUID(),
        student_id:   s.student_id,
        student_name: s.student_name,
        student_code: s.student_code,
        branch_name:  s.branch_name,
        relationship: 'guardian',
        is_primary:   prev.length === 0,
      },
    ])
    setPickerQ('')
    setDirty(true)
    // keep picker open for adding another student
    setTimeout(() => pickerInputRef.current?.focus(), 50)
  }

  function removeLink(key: string) {
    if (links.length === 1) {
      if (!confirm('This is the only linked student. Removing it will require you to add another before saving. Remove anyway?')) return
    }
    setLinks(prev => {
      const next = prev.filter(l => l._key !== key)
      if (next.length > 0 && !next.some(l => l.is_primary)) {
        next[0] = { ...next[0], is_primary: true }
      }
      return next
    })
    setDirty(true)
  }

  function setPrimary(key: string) {
    setLinks(prev => prev.map(l => ({ ...l, is_primary: l._key === key })))
    setDirty(true)
  }

  function updateRelation(key: string, rel: string) {
    setLinks(prev => prev.map(l => l._key === key ? { ...l, relationship: rel } : l))
    setDirty(true)
  }

  // ── Submit validation ───────────────────────────────────────────────────────
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent) {
    if (links.length === 0) {
      e.preventDefault()
      alert('At least one student must be linked to this parent.')
    }
  }

  // ── Serialized links (deduplicated by student_id) ───────────────────────────
  const linksJson = JSON.stringify(
    [...new Map(links.map(l => [l.student_id, l])).values()].map(l => ({
      student_id:   l.student_id,
      relationship: l.relationship,
      is_primary:   l.is_primary,
    }))
  )

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="relative w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl max-h-[95vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4 shrink-0">
            <div>
              <h2 className="text-base font-bold text-[#0B1F3A]">
                {isEdit ? 'Edit Parent' : 'Add Parent'}
              </h2>
              {links.length > 0 && (
                <p className="text-[11px] text-[#94A3B8] mt-0.5">{links.length} student{links.length !== 1 ? 's' : ''} linked</p>
              )}
            </div>
            <button onClick={handleClose} className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9]">
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form
            ref={formRef}
            action={dispatch}
            onSubmit={handleSubmit}
            onChange={() => setDirty(true)}
            className="overflow-y-auto flex-1 p-5 space-y-5"
          >
            {isEdit && <input type="hidden" name="id" value={parent!.parent_id} />}
            <input type="hidden" name="student_links_json" value={linksJson} />

            {/* Server error */}
            {state && !state.success && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {state.error.message}
              </div>
            )}

            {/* Duplicate warning */}
            {dupWarning && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-[12px] text-amber-700">{dupWarning}</p>
              </div>
            )}

            {/* ── Parent info ─────────────────────────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Parent Info</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#64748B]">First Name *</label>
                  <input
                    name="first_name"
                    required
                    value={firstNameVal}
                    onChange={e => { setFirstNameVal(e.target.value); checkDuplicates(phoneVal, e.target.value, lastNameVal) }}
                    className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#64748B]">Last Name *</label>
                  <input
                    name="last_name"
                    required
                    value={lastNameVal}
                    onChange={e => { setLastNameVal(e.target.value); checkDuplicates(phoneVal, firstNameVal, e.target.value) }}
                    className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#64748B]">Phone (Primary) *</label>
                <input
                  name="phone"
                  required
                  value={phoneVal}
                  onChange={e => { setPhoneVal(e.target.value); checkDuplicates(e.target.value, firstNameVal, lastNameVal) }}
                  placeholder="+20 10x xxx xxxx"
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>

              {isEdit ? (
                <>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-[#64748B]">Email *</label>
                    <input
                      name="email"
                      type="email"
                      required
                      defaultValue={parent!.email}
                      placeholder="parent@example.com"
                      className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-[#64748B]">New Password</label>
                    <input
                      name="new_password"
                      type="password"
                      minLength={6}
                      placeholder="Leave blank to keep current password"
                      className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-[#94A3B8]">Min 6 characters. Leave blank to keep existing password.</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-[#64748B]">Email (portal login) *</label>
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="parent@example.com"
                      className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-[#64748B]">Password *</label>
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={6}
                      placeholder="Min 6 characters"
                      className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                    />
                  </div>
                </>
              )}
            </section>

            {/* ── Linked children ─────────────────────────────────────────── */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Linked Children <span className="text-red-500">*</span>
                </h3>
                <span className={`text-[11px] font-semibold ${links.length > 1 ? 'text-purple-600' : 'text-[#94A3B8]'}`}>
                  {links.length > 1 ? `${links.length} students` : links.length === 1 ? '1 student' : 'none'}
                </span>
              </div>

              {/* Student search picker */}
              <div ref={pickerRef} className="relative">
                <div className="relative">
                  <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={pickerInputRef}
                    type="text"
                    value={pickerQ}
                    onChange={e => { setPickerQ(e.target.value); setShowPicker(true) }}
                    onFocus={() => setShowPicker(true)}
                    placeholder="Search by name, code, phone…"
                    className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] pl-9 pr-3 py-2 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                  />
                  {pickerQ && (
                    <button
                      type="button"
                      onClick={() => { setPickerQ(''); setShowPicker(false) }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#94A3B8] hover:text-[#0B1F3A]"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>

                {showPicker && pickerQ.length >= 1 && (
                  <div className="absolute z-20 mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white shadow-xl overflow-hidden">
                    {pickerResults.length > 0 ? (
                      <div className="max-h-52 overflow-y-auto">
                        {pickerResults.map(s => (
                          <button
                            key={s.student_id}
                            type="button"
                            onClick={() => addStudent(s)}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[#F8FAFC] border-b border-[#F1F5F9] last:border-0"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-semibold text-[#0B1F3A] leading-tight">{s.student_name}</p>
                              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                {s.student_code && (
                                  <span className="font-mono text-[10px] text-[#94A3B8]">#{s.student_code}</span>
                                )}
                                {s.age !== null && (
                                  <span className="text-[10px] text-[#94A3B8]">· Age {s.age}</span>
                                )}
                                <span className="text-[10px] text-[#64748B]">· {s.branch_name}</span>
                                {s.group_name && (
                                  <span className="text-[10px] text-[#64748B]">· {s.group_name}</span>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-[#FF8A1F]/15">
                              <svg className="h-3 w-3 text-[#FF8A1F]" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-3">
                        <p className="text-[12px] text-[#94A3B8]">No matching active students found.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Linked list */}
              {links.length > 0 ? (
                <div className="space-y-2">
                  {links.map((l, idx) => (
                    <div
                      key={l._key}
                      className={`rounded-xl border p-3 transition ${l.is_primary
                        ? 'border-[#FF8A1F]/40 bg-[#FF8A1F]/5'
                        : 'border-[#E2E8F0] bg-[#F8FAFC]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {/* Index badge */}
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E2E8F0] text-[10px] font-bold text-[#64748B]">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-[#0B1F3A] leading-tight">{l.student_name}</p>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {l.student_code && (
                              <span className="font-mono text-[10px] text-[#94A3B8]">#{l.student_code}</span>
                            )}
                            <span className="text-[10px] text-[#64748B]">· {l.branch_name}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLink(l._key)}
                          title={links.length === 1 ? 'Warning: last linked student' : 'Remove link'}
                          className={`shrink-0 rounded p-1 transition hover:text-red-500 ${links.length === 1 ? 'text-amber-400' : 'text-[#94A3B8]'}`}
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>

                      {links.length === 1 && (
                        <p className="mt-1 pl-7 text-[10px] text-amber-600">
                          Last linked student — removing will leave this parent without any children.
                        </p>
                      )}

                      <div className="mt-2 pl-7 flex items-center gap-2 flex-wrap">
                        <select
                          value={l.relationship}
                          onChange={e => updateRelation(l._key, e.target.value)}
                          className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1 text-[11px] text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                        >
                          {RELATIONS.map(r => (
                            <option key={r} value={r} className="capitalize">{r}</option>
                          ))}
                        </select>
                        {l.is_primary ? (
                          <span className="rounded-full bg-[#FF8A1F]/15 px-2 py-0.5 text-[10px] font-semibold text-[#FF8A1F]">
                            Primary
                          </span>
                        ) : links.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setPrimary(l._key)}
                            className="rounded-lg border border-[#E2E8F0] px-2 py-1 text-[10px] font-medium text-[#64748B] hover:border-[#CBD5E1]"
                          >
                            Set Primary
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] px-4 py-4 text-center">
                  <svg className="mx-auto mb-1.5 h-6 w-6 text-[#CBD5E1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p className="text-[12px] font-medium text-[#94A3B8]">No students linked yet</p>
                  <p className="text-[11px] text-[#CBD5E1]">Search above to add students</p>
                </div>
              )}
            </section>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl border border-[#E2E8F0] py-2.5 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex-1 rounded-xl bg-[#FF8A1F] py-2.5 text-sm font-semibold text-white hover:bg-[#e87c18] disabled:opacity-60"
              >
                {pending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Parent'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
