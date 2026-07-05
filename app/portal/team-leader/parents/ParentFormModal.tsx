'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createParentContactAction, updateParentContactAction } from '@/modules/parents/contact-actions'
import type { ParentOperationalRow, StudentPickerOption } from '@/modules/parents/operational'
import type { ActionResult } from '@/types/app'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  mode:           'create' | 'edit'
  parent?:        ParentOperationalRow
  studentOptions: StudentPickerOption[]
  onClose:        () => void
  onSuccess:      () => void
}

const RELATIONS = [
  { value: 'father',   label: 'Father' },
  { value: 'mother',   label: 'Mother' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'other',    label: 'Other' },
] as const

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizePhone(p: string): string {
  const s = p.replace(/[\s\-\(\)\+]/g, '')
  if (s.startsWith('20') && s.length >= 12) return '0' + s.slice(2)
  if (s.startsWith('002'))                  return '0' + s.slice(3)
  return s
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ParentFormModal({ mode, parent: p, studentOptions, onClose, onSuccess }: Props) {
  const isEdit = mode === 'edit'

  // ── Form fields ─────────────────────────────────────────────────────────────
  const [name,              setName]             = useState(p?.parent_name ?? '')
  const [phone1,            setPhone1]           = useState(p?.phone ?? '')
  const [phone2,            setPhone2]           = useState(p?.phone2 ?? '')
  const [relation,          setRelation]         = useState<string>(p?.relation ?? 'guardian')
  const [whatsapp,          setWhatsapp]         = useState(p?.whatsapp_preferred ?? false)
  const [notes,             setNotes]            = useState(p?.notes ?? '')
  const hasPortal = isEdit && !!p?.user_id
  const [email,             setEmail]            = useState(isEdit ? (p?.email ?? '') : '')
  const [password,          setPassword]         = useState('')
  const [showPortal,        setShowPortal]       = useState(false)

  // ── Linked students ──────────────────────────────────────────────────────────
  // Edit: current children (with contact_id for removal)
  const [linkedChildren, setLinkedChildren] = useState(
    p?.children.filter(c => !c.is_archived).map(c => ({
      contact_id:   c.contact_id,
      student_id:   c.student_id,
      student_name: c.student_name,
      student_code: c.student_code,
    })) ?? []
  )
  const [contactsToRemove, setContactsToRemove] = useState<string[]>([])
  // Create: selected student ids
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [studentSearch, setStudentSearch] = useState('')

  // ── Server action ─────────────────────────────────────────────────────────────
  const action = isEdit ? updateParentContactAction : createParentContactAction
  const [state, formAction, isPending] = useActionState<ActionResult<any>, FormData>(
    action as any,
    { success: false, error: null } as any
  )

  useEffect(() => {
    if (state && 'success' in state && state.success) onSuccess()
  }, [state])

  // ── Keyboard close ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Student picker (create mode) ─────────────────────────────────────────────
  const alreadyLinkedIds = new Set(linkedChildren.map(c => c.student_id))
  const filteredStudents = studentOptions.filter(s => {
    if (alreadyLinkedIds.has(s.student_id)) return false
    if (!studentSearch) return true
    const q = studentSearch.toLowerCase()
    const qPhone = normalizePhone(studentSearch)
    const phone  = s.phone ? normalizePhone(s.phone) : ''
    return (
      s.student_name.toLowerCase().includes(q) ||
      (s.student_code ?? '').toLowerCase().includes(q) ||
      (s.group_name  ?? '').toLowerCase().includes(q) ||
      (qPhone.length >= 5 && phone.includes(qPhone))
    )
  })

  function toggleStudentSelect(id: string) {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function removeLinkedChild(contactId: string | null, studentId: string) {
    setLinkedChildren(prev => prev.filter(c => c.student_id !== studentId))
    if (contactId) setContactsToRemove(prev => [...prev, contactId])
  }

  // ── Build FormData before submit ─────────────────────────────────────────────
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (!isEdit && selectedStudentIds.length === 0) return

    const fd = new FormData()
    if (isEdit) fd.append('parent_group_id', p!.parent_group_id)
    fd.append('name',               name.trim())
    fd.append('phone1',             phone1.trim())
    fd.append('phone2',             phone2.trim())
    fd.append('relation',           relation)
    fd.append('whatsapp_preferred', String(whatsapp))
    fd.append('notes',              notes.trim())

    if (isEdit) {
      fd.append('students_to_add_json',    JSON.stringify(selectedStudentIds))
      fd.append('contacts_to_remove_json', JSON.stringify(contactsToRemove))
      fd.append('user_id', p!.user_id || '')
      if (email.trim())    fd.append('email',    email.trim())
      if (password.trim()) fd.append('password', password.trim())
    } else {
      fd.append('student_ids_json', JSON.stringify(selectedStudentIds))
      if (showPortal && email.trim()) {
        fd.append('email',    email.trim())
        fd.append('password', password.trim())
      }
    }

    formAction(fd)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const modal = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — full screen on mobile, centered sheet on desktop */}
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
        <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh]">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] shrink-0">
            <div>
              <h2 className="text-base font-bold text-[#0B1F3A]">
                {isEdit ? 'Edit Parent' : 'Add Parent'}
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                {isEdit
                  ? 'Update parent contact info and linked students'
                  : 'Create a new parent contact and link to students'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9]"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Scrollable body */}
          <form
            ref={formRef}
            id="parent-form"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto p-5 space-y-5"
          >
            {/* Error banner */}
            {state && 'error' in state && state.error && (
              <div className="rounded-xl bg-[#FEE2E2] border border-[#FECACA] px-4 py-3 text-sm text-[#DC2626]">
                {state.error.message}
              </div>
            )}

            {/* ── Section: Basic Info ─────────────────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                Parent Info
              </h3>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">
                  Full Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Ahmed Mohamed"
                  required
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] placeholder-[#94A3B8] focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>

              {/* Relation */}
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Relation</label>
                <select
                  value={relation}
                  onChange={e => setRelation(e.target.value)}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                >
                  {RELATIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Phone 1 */}
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">
                  Phone 1 <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  value={phone1}
                  onChange={e => setPhone1(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  type="tel"
                  required
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] placeholder-[#94A3B8] focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>

              {/* Phone 2 */}
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">
                  Phone 2 <span className="text-[#94A3B8] text-[10px]">(optional)</span>
                </label>
                <input
                  value={phone2}
                  onChange={e => setPhone2(e.target.value)}
                  placeholder="Secondary phone"
                  type="tel"
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] placeholder-[#94A3B8] focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>

              {/* WhatsApp toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setWhatsapp(v => !v)}
                  className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                    whatsapp ? 'bg-[#25D366]' : 'bg-[#CBD5E1]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      whatsapp ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </div>
                <span className="text-sm text-[#374151]">WhatsApp preferred</span>
              </label>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">
                  Notes <span className="text-[#94A3B8] text-[10px]">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any notes about this parent..."
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#0B1F3A] placeholder-[#94A3B8] focus:border-[#FF8A1F] focus:outline-none resize-none"
                />
              </div>
            </section>

            {/* ── Section: Linked Students ────────────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                Linked Students
              </h3>

              {/* Current children (edit mode) */}
              {isEdit && linkedChildren.length > 0 && (
                <div className="space-y-1.5">
                  {linkedChildren.map(c => (
                    <div
                      key={c.student_id}
                      className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#0B1F3A]">{c.student_name}</p>
                        {c.student_code && (
                          <p className="text-[11px] text-[#94A3B8]">{c.student_code}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLinkedChild(c.contact_id, c.student_id)}
                        className="ml-2 rounded-lg p-1 text-[#94A3B8] hover:bg-[#FEE2E2] hover:text-[#EF4444]"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Student picker */}
              <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
                <div className="px-3 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <input
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    placeholder="Search students by name, code, group…"
                    className="w-full bg-transparent text-sm text-[#0B1F3A] placeholder-[#94A3B8] outline-none"
                  />
                </div>

                <div className="max-h-44 overflow-y-auto divide-y divide-[#F1F5F9]">
                  {filteredStudents.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-[#94A3B8]">
                      {studentSearch ? 'No students match your search' : 'All students already linked'}
                    </p>
                  ) : filteredStudents.map(s => {
                    const checked = selectedStudentIds.includes(s.student_id)
                    return (
                      <label
                        key={s.student_id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                          checked ? 'bg-[#FF8A1F]/5' : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStudentSelect(s.student_id)}
                          className="h-4 w-4 rounded border-[#CBD5E1] text-[#FF8A1F] focus:ring-[#FF8A1F]"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#0B1F3A] truncate">{s.student_name}</p>
                          <p className="text-[11px] text-[#94A3B8] truncate">
                            {[s.student_code, s.group_name, s.branch_name].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        {s.age !== null && (
                          <span className="shrink-0 text-[11px] text-[#94A3B8]">Age {s.age}</span>
                        )}
                      </label>
                    )
                  })}
                </div>

                {selectedStudentIds.length > 0 && (
                  <div className="px-3 py-2 bg-[#FF8A1F]/5 border-t border-[#E2E8F0]">
                    <p className="text-xs font-medium text-[#FF8A1F]">
                      {selectedStudentIds.length} student{selectedStudentIds.length > 1 ? 's' : ''} selected
                      {isEdit ? ' to add' : ''}
                    </p>
                  </div>
                )}
              </div>

              {!isEdit && selectedStudentIds.length === 0 && (
                <p className="text-[11px] text-[#94A3B8]">Select at least one student to link this parent to.</p>
              )}
            </section>

            {/* ── Section: Portal Access ──────────────────────────────────── */}
            <section className="space-y-3">
              {/* Collapsible header (create & edit-without-account) */}
              {!hasPortal && (
                <button
                  type="button"
                  onClick={() => setShowPortal(v => !v)}
                  className="flex items-center gap-2 text-xs font-semibold text-[#64748B] uppercase tracking-wide"
                >
                  <svg
                    className={`h-3.5 w-3.5 transition-transform ${showPortal ? 'rotate-90' : ''}`}
                    viewBox="0 0 20 20" fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  Portal Access (optional)
                </button>
              )}

              {/* Always expanded when parent already has an account */}
              {hasPortal && (
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                    Portal Access
                  </h3>
                  <span className="rounded-full bg-[#E7F8EE] px-2 py-0.5 text-[10px] font-semibold text-[#15803D]">
                    Active
                  </span>
                </div>
              )}

              {(showPortal || hasPortal) && (
                <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                  {hasPortal ? (
                    <p className="text-xs text-[#64748B]">
                      This parent has a portal account. Update the email or set a new password below.
                    </p>
                  ) : (
                    <p className="text-xs text-[#64748B]">
                      Give this parent a login account to access the parent portal.
                    </p>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1">
                      Email {hasPortal && <span className="text-[#94A3B8] font-normal">(current: {p?.email})</span>}
                    </label>
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder={hasPortal ? 'New email (leave blank to keep current)' : 'parent@email.com'}
                      type="email"
                      autoComplete="off"
                      className="w-full ds-card px-3 py-2.5 text-sm text-[#0B1F3A] placeholder-[#94A3B8] focus:border-[#FF8A1F] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#374151] mb-1">
                      {hasPortal ? 'New Password' : 'Password'}
                    </label>
                    <input
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={hasPortal ? 'Leave blank to keep current password' : 'Min. 6 characters'}
                      type="password"
                      autoComplete="new-password"
                      className="w-full ds-card px-3 py-2.5 text-sm text-[#0B1F3A] placeholder-[#94A3B8] focus:border-[#FF8A1F] focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </section>
          </form>

          {/* Footer */}
          <div className="shrink-0 border-t border-[#E2E8F0] px-5 py-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 rounded-xl border border-[#E2E8F0] py-2.5 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="parent-form"
              disabled={isPending || (!isEdit && selectedStudentIds.length === 0) || !name.trim()}
              className="flex-1 rounded-xl bg-[#FF8A1F] py-2.5 text-sm font-medium text-white hover:bg-[#e87c18] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending
                ? (isEdit ? 'Saving…' : 'Adding…')
                : (isEdit ? 'Save Changes' : 'Add Parent')}
            </button>
          </div>

        </div>
      </div>
    </>
  )

  if (typeof window === 'undefined') return null
  return createPortal(modal, document.body)
}
