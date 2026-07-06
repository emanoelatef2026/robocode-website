'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { createStudentModal, updateStudentModal, deleteStudentAction } from '@/modules/students/modal-actions'
import type { StudentOperationalRow, GroupPickerOption } from '@/modules/students/operational'
import type { ActionResult } from '@/types/app'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ParentContactBlock {
  _key:               string
  name:               string
  relation:           string
  phone1:             string
  phone2:             string
  whatsapp_preferred: boolean
  is_primary:         boolean
  is_emergency:       boolean
  password:           string
}

interface Props {
  mode:         'create' | 'edit'
  student?:     StudentOperationalRow
  branchId:     string
  branchIds:    string[]
  branches:     { id: string; name: string }[]
  groupOptions?: GroupPickerOption[]
  isTL:         boolean
  onClose:      () => void
  onSuccess:    () => void
  onDelete?:    () => void
}

// ── Constants ──────────────────────────────────────────────────────────────────

const RELATIONS = ['father', 'mother', 'guardian', 'other'] as const
const STATUSES  = ['active', 'inactive', 'graduated', 'paused', 'banned'] as const

function newContact(isPrimary = false): ParentContactBlock {
  return {
    _key:               crypto.randomUUID(),
    name:               '',
    relation:           'guardian',
    phone1:             '',
    phone2:             '',
    whatsapp_preferred: false,
    is_primary:         isPrimary,
    is_emergency:       true,
    password:           '',
  }
}

// Derive age from ISO date string
function ageFromDob(dob: string): number | null {
  const d = new Date(dob)
  if (isNaN(d.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--
  return age
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function StudentFormModal({
  mode, student, branchId, branchIds, branches, groupOptions = [], isTL, onClose, onSuccess, onDelete,
}: Props) {
  // Only lock the branch when the user truly has a single branch — multi-branch
  // users must pick explicitly, otherwise every student silently lands in branchIds[0].
  const singleBranch = branchIds.length <= 1 ? (branchId || branchIds[0]) : undefined
  const isEdit       = mode === 'edit'

  // Branch the student will belong to — drives which groups can be picked.
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    () => singleBranch ?? (mode === 'edit' ? (student?.branch_id ?? '') : '')
  )

  // ── Contact state ───────────────────────────────────────────────────────────
  const initialContacts: ParentContactBlock[] = isEdit && student?.parent_contacts?.length
    ? student.parent_contacts.map(c => ({
        _key:               crypto.randomUUID(),
        name:               c.name,
        relation:           c.relation,
        phone1:             c.phone1  ?? '',
        phone2:             c.phone2  ?? '',
        whatsapp_preferred: c.whatsapp_preferred,
        is_primary:         c.is_primary,
        is_emergency:       c.is_emergency,
        password:           '',
      }))
    : [newContact(true)]

  const [contacts, setContacts] = useState<ParentContactBlock[]>(initialContacts)

  // ── Age / DOB cross-validation ──────────────────────────────────────────────
  const [ageVal,       setAgeVal]       = useState<string>(isEdit ? String(student?.age ?? '') : '')
  const [dobVal,       setDobVal]       = useState<string>(isEdit ? (student?.date_of_birth ?? '') : '')
  const [ageWarn,      setAgeWarn]      = useState<string | null>(null)
  const [ageErr,       setAgeErr]       = useState<string | null>(null)
  const [pwErr,        setPwErr]        = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteErr,     setDeleteErr]     = useState<string | null>(null)
  const newPasswordRef = useRef<HTMLInputElement>(null)

  function validateAge(rawAge: string) {
    const n = parseInt(rawAge, 10)
    if (!rawAge) { setAgeErr('Age is required'); return }
    if (isNaN(n) || !Number.isInteger(n)) { setAgeErr('Age must be a whole number'); return }
    if (n < 3 || n > 25) { setAgeErr('Age must be between 3 and 25'); return }
    setAgeErr(null)
  }

  function onAgeChange(v: string) {
    setAgeVal(v)
    validateAge(v)
    // Cross-check with DOB if both present
    if (dobVal && v) {
      const dobAge = ageFromDob(dobVal)
      const enteredAge = parseInt(v, 10)
      if (dobAge !== null && Math.abs(dobAge - enteredAge) > 1) {
        setAgeWarn(`DOB suggests age ${dobAge}, but you entered ${enteredAge}`)
      } else {
        setAgeWarn(null)
      }
    }
  }

  function onDobChange(v: string) {
    setDobVal(v)
    if (v) {
      const derived = ageFromDob(v)
      if (derived !== null && !ageVal) {
        // Auto-fill age from DOB if age is empty
        setAgeVal(String(derived))
        setAgeErr(null)
      }
      if (derived !== null && ageVal) {
        const enteredAge = parseInt(ageVal, 10)
        if (!isNaN(enteredAge) && Math.abs(derived - enteredAge) > 1) {
          setAgeWarn(`DOB suggests age ${derived}, but age is ${enteredAge}`)
        } else {
          setAgeWarn(null)
        }
      }
    } else {
      setAgeWarn(null)
    }
  }

  // ── Group assignment state ──────────────────────────────────────────────────
  const [groupLinks, setGroupLinks] = useState<GroupPickerOption[]>(() => {
    if (!isEdit || !student?.group_memberships?.length || !groupOptions.length) return []
    const optMap = new Map<string, GroupPickerOption>()
    for (const g of groupOptions) optMap.set(g.group_id, g)
    return student.group_memberships.flatMap(m => {
      const opt = optMap.get(m.group_id)
      return opt ? [opt] : []
    })
  })
  const [groupPickerQ,      setGroupPickerQ]      = useState('')
  const [showGroupPicker,   setShowGroupPicker]   = useState(false)
  const [groupPickerBranch, setGroupPickerBranch] = useState('')
  const [groupPickerStatus, setGroupPickerStatus] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)

  const originalGroupIds = useMemo<Set<string>>(() => {
    if (!isEdit || !student?.group_memberships?.length) return new Set()
    return new Set(student.group_memberships.map(m => m.group_id))
  }, []) // intentionally stable — original set never changes in one modal session

  const selectedGroupIds = useMemo(() => new Set(groupLinks.map(g => g.group_id)), [groupLinks])

  const pickerResults = useMemo(() => {
    const q = groupPickerQ.toLowerCase()
    return groupOptions.filter(g => {
      if (selectedGroupIds.has(g.group_id)) return false
      // Hard lock: groups must match the student's branch (server rejects mismatches)
      if (selectedBranchId) {
        if (g.branch_id !== selectedBranchId) return false
      } else if (groupPickerBranch && g.branch_id !== groupPickerBranch) {
        return false
      }
      if (groupPickerStatus && g.status    !== groupPickerStatus) return false
      if (q && !g.group_name.toLowerCase().includes(q) &&
               !(g.course_name?.toLowerCase().includes(q)) &&
               !(g.instructor_name?.toLowerCase().includes(q))) return false
      return true
    })
  }, [groupOptions, selectedGroupIds, groupPickerQ, groupPickerBranch, groupPickerStatus, selectedBranchId])

  const groupsToAdd    = useMemo(() => groupLinks.filter(g => !originalGroupIds.has(g.group_id)).map(g => g.group_id), [groupLinks, originalGroupIds])
  const groupsToRemove = useMemo(() => [...originalGroupIds].filter(id => !selectedGroupIds.has(id)), [originalGroupIds, selectedGroupIds])

  const sameCourseWarning = useMemo(() => {
    const courseIds = groupLinks.map(g => g.course_id).filter(Boolean)
    return courseIds.length > 0 && courseIds.length !== new Set(courseIds).size
  }, [groupLinks])

  const addGroupLink = (g: GroupPickerOption) => {
    setDirty(true)
    setGroupLinks(prev => [...prev, g])
    // First group picked before a branch was chosen — follow the group's branch
    if (!isEdit && !selectedBranchId) setSelectedBranchId(g.branch_id)
  }
  const removeGroupLink = (groupId: string) => { setDirty(true); setGroupLinks(prev => prev.filter(g => g.group_id !== groupId)) }

  // ── Dirty state ─────────────────────────────────────────────────────────────
  const [dirty, setDirty] = useState(false)
  const dialogRef         = useRef<HTMLDivElement>(null)

  // ── Server action ───────────────────────────────────────────────────────────
  const action = isEdit ? updateStudentModal : createStudentModal
  const [state, formAction, isPending] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    action as any,
    null
  )

  useEffect(() => {
    if (state?.success) onSuccess()
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dirty && !confirm('You have unsaved changes. Close anyway?')) return
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dirty, onClose])

  // Close group picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowGroupPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Contact helpers ─────────────────────────────────────────────────────────
  const updateContact = (key: string, field: keyof ParentContactBlock, value: any) => {
    setDirty(true)
    setContacts(cs => cs.map(c => c._key === key ? { ...c, [field]: value } : c))
  }
  const addContact = () => {
    setDirty(true)
    setContacts(cs => [...cs, newContact(false)])
  }
  const removeContact = (key: string) => {
    if (contacts.length <= 1) return
    setDirty(true)
    setContacts(cs => cs.filter(c => c._key !== key))
  }

  const overlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (dirty && !confirm('You have unsaved changes. Close anyway?')) return
      onClose()
    }
  }

  // ── Validate before submit ──────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!ageVal || ageErr) {
      e.preventDefault()
      validateAge(ageVal)
      return
    }
    const hasNamedContact = contacts.some(c => c.name.trim() && c.phone1.trim())
    if (!hasNamedContact) {
      e.preventDefault()
      alert('At least one contact with name and phone is required.')
      return
    }
    const pw = newPasswordRef.current?.value
    if (isEdit && pw && pw.length < 6) {
      e.preventDefault()
      setPwErr('Password must be at least 6 characters')
      return
    }
    setPwErr(null)
  }

  async function handleConfirmDelete() {
    if (!student) return
    setDeleteLoading(true)
    setDeleteErr(null)
    const res = await deleteStudentAction(student.student_id)
    setDeleteLoading(false)
    if (!res.success) {
      setDeleteErr(res.error.message)
      return
    }
    onDelete?.()
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={overlayClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit Student' : 'Add Student'}
        className="relative w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E2E8F0] bg-white px-6 py-4">
          <h2 className="text-base font-semibold text-[#0B1F3A]">
            {isEdit ? `Edit — ${student?.student_name}` : 'Add Student'}
          </h2>
          <button
            type="button"
            onClick={() => { if (dirty && !confirm('Close without saving?')) return; onClose() }}
            className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0B1F3A]"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Server error */}
        {state && !state.success && (
          <div className="mx-6 mt-4 rounded-lg bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">
            {state.error.message}
          </div>
        )}

        <form
          action={formAction}
          onSubmit={handleSubmit}
          onChange={() => setDirty(true)}
          className="space-y-5 p-6"
        >
          {/* Hidden fields */}
          {singleBranch && <input type="hidden" name="branch_id" value={singleBranch} />}
          {isEdit && student && <input type="hidden" name="id" value={student.student_id} />}

          {/* Branch picker for multi-branch TL */}
          {!singleBranch && !isEdit && (
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
                Branch <span className="text-[#EF4444]">*</span>
              </label>
              <select name="branch_id" required
                value={selectedBranchId}
                onChange={e => {
                  const v = e.target.value
                  setSelectedBranchId(v)
                  setDirty(true)
                  // Drop picked groups that no longer match the chosen branch
                  if (v) setGroupLinks(prev => prev.filter(g => g.branch_id === v))
                }}
                className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none">
                <option value="">— Select branch —</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {/* ── Student Identity ────────────────────────────────────── */}
          <fieldset className="space-y-3 rounded-xl border border-[#E2E8F0] p-4">
            <legend className="px-1 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Student</legend>

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
                  First name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  name="first_name"
                  required
                  defaultValue={student?.first_name ?? ''}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
                  Last name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  name="last_name"
                  required
                  defaultValue={student?.last_name ?? ''}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>
            </div>

            {/* Age + Phone row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
                  Age <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  name="age"
                  type="number"
                  min={3}
                  max={25}
                  step={1}
                  required
                  value={ageVal}
                  onChange={e => onAgeChange(e.target.value)}
                  placeholder="e.g. 10"
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none
                    ${ageErr ? 'border-[#F87171] bg-[#FEE2E2]' : 'border-[#E2E8F0] focus:border-[#FF8A1F]'}`}
                />
                {ageErr && <p className="mt-0.5 text-[11px] text-[#EF4444]">{ageErr}</p>}
                {ageWarn && !ageErr && <p className="mt-0.5 text-[11px] text-[#F59E0B]">{ageWarn}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
                  Student phone <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  name="phone"
                  required
                  defaultValue={student?.student_phone ?? ''}
                  placeholder="01XXXXXXXXX"
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>
            </div>

            {/* DOB + Grade row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
                  Date of birth <span className="text-[11px] text-[#94A3B8]">(optional)</span>
                </label>
                <input
                  name="date_of_birth"
                  type="date"
                  value={dobVal}
                  onChange={e => onDobChange(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
                  Grade <span className="text-[11px] text-[#94A3B8]">(optional)</span>
                </label>
                <input
                  name="school_grade"
                  defaultValue={student?.school_grade ?? ''}
                  placeholder="e.g. Grade 5"
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>
            </div>

            {/* Password (create only) — login email is generated automatically as @robocodeschools.com */}
            {!isEdit && (
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
                  Password <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Min 6 characters"
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>
            )}

            {/* Status (edit only) */}
            {isEdit && (
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Status</label>
                <select
                  name="status"
                  defaultValue={student?.student_status ?? 'active'}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm focus:border-[#FF8A1F] focus:outline-none"
                >
                  {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                </select>
              </div>
            )}

            {/* Enrollment date (create only) */}
            {!isEdit && (
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Enrollment date</label>
                <input
                  name="enrollment_date"
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm focus:border-[#FF8A1F] focus:outline-none"
                />
              </div>
            )}

            {/* Student code read-only in edit */}
            {isEdit && student?.student_code && (
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Student Code</label>
                <input
                  readOnly
                  value={student.student_code}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#94A3B8] font-mono cursor-not-allowed"
                />
                <p className="mt-0.5 text-[11px] text-[#94A3B8]">Student code cannot be changed.</p>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Notes</label>
              <textarea
                name="notes"
                rows={2}
                defaultValue={student?.notes ?? ''}
                className="w-full resize-none rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm focus:border-[#FF8A1F] focus:outline-none"
              />
            </div>
          </fieldset>

          {/* ── Account (edit only) ─────────────────────────────────── */}
          {isEdit && (
            <fieldset className="space-y-3 rounded-xl border border-[#E2E8F0] p-4">
              <legend className="px-1 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Account</legend>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Login email</label>
                  <input
                    readOnly
                    value={student?.user_email ?? ''}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#94A3B8] cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
                    New Password <span className="text-[11px] text-[#94A3B8]">(optional)</span>
                  </label>
                  <input
                    ref={newPasswordRef}
                    name="new_password"
                    type="password"
                    placeholder="Leave blank to keep current"
                    autoComplete="new-password"
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none
                      ${pwErr ? 'border-[#F87171] bg-[#FEE2E2]' : 'border-[#E2E8F0] focus:border-[#FF8A1F]'}`}
                  />
                  {pwErr && <p className="mt-0.5 text-[11px] text-[#EF4444]">{pwErr}</p>}
                </div>
              </div>
            </fieldset>
          )}

          {/* ── Parent Contacts ─────────────────────────────────────── */}
          <fieldset className="space-y-3 rounded-xl border border-[#E2E8F0] p-4">
            <div className="flex items-center justify-between">
              <legend className="px-1 text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                Parent Contacts <span className="text-[#EF4444]">*</span>
              </legend>
              <button
                type="button"
                onClick={addContact}
                className="flex items-center gap-1 rounded-lg bg-[#FF8A1F]/10 px-2.5 py-1 text-xs font-semibold text-[#FF8A1F] hover:bg-[#FF8A1F]/20"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                + Add Contact
              </button>
            </div>

            {contacts.map((c, i) => (
              <div key={c._key} className="space-y-2 rounded-lg border border-[#E2E8F0] p-3">
                {/* Contact header */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748B]">Contact {i + 1}</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#64748B]">
                      <input
                        type="checkbox"
                        checked={c.is_primary}
                        onChange={e => updateContact(c._key, 'is_primary', e.target.checked)}
                        className="h-3 w-3 rounded border-[#E2E8F0] accent-[#FF8A1F]"
                      />
                      Primary
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#64748B]">
                      <input
                        type="checkbox"
                        checked={c.is_emergency}
                        onChange={e => updateContact(c._key, 'is_emergency', e.target.checked)}
                        className="h-3 w-3 rounded border-[#E2E8F0] accent-[#FF8A1F]"
                      />
                      Emergency
                    </label>
                    {contacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeContact(c._key)}
                        className="rounded p-0.5 text-[#F87171] hover:bg-[#FEE2E2] hover:text-[#EF4444]"
                        aria-label="Remove contact"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Name + Relation */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-xs text-[#64748B]">
                      Name <span className="text-[#EF4444]">*</span>
                    </label>
                    <input
                      value={c.name}
                      onChange={e => updateContact(c._key, 'name', e.target.value)}
                      placeholder="Contact name"
                      className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs text-[#64748B]">Relation</label>
                    <select
                      value={c.relation}
                      onChange={e => updateContact(c._key, 'relation', e.target.value)}
                      className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
                    >
                      {RELATIONS.map(r => (
                        <option key={r} value={r} className="capitalize">{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Phone 1 + Phone 2 */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-xs text-[#64748B]">
                      Phone 1 <span className="text-[#EF4444]">*</span>
                    </label>
                    <input
                      value={c.phone1}
                      onChange={e => updateContact(c._key, 'phone1', e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs text-[#64748B]">Phone 2</label>
                    <input
                      value={c.phone2}
                      onChange={e => updateContact(c._key, 'phone2', e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
                    />
                  </div>
                </div>

                {/* WhatsApp */}
                <label className="flex cursor-pointer items-center gap-2 text-xs text-[#64748B]">
                  <input
                    type="checkbox"
                    checked={c.whatsapp_preferred}
                    onChange={e => updateContact(c._key, 'whatsapp_preferred', e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-[#E2E8F0] accent-[#25D366]"
                  />
                  WhatsApp preferred
                </label>

                {/* Portal access — set a password to create a login (email is generated automatically) */}
                <div className="mt-1 rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-2.5 space-y-2">
                  <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide">
                    Portal Access (optional)
                  </p>
                  <div>
                    <label className="mb-0.5 block text-xs text-[#64748B]">Password</label>
                    <input
                      value={c.password}
                      onChange={e => updateContact(c._key, 'password', e.target.value)}
                      placeholder="Min 6 chars — leave blank for no portal login"
                      type="password"
                      className="w-full ds-card px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Serialize contacts as JSON hidden field */}
            <input
              type="hidden"
              name="parent_contacts_json"
              value={JSON.stringify(contacts.map(({ _key, ...c }) => c))}
            />
          </fieldset>

          {/* ── Group Assignments ───────────────────────────────────── */}
          {groupOptions.length > 0 && (
            <fieldset className="space-y-3 rounded-xl border border-[#E2E8F0] p-4">
              <legend className="px-1 text-xs font-semibold text-[#64748B] uppercase tracking-wide">
                Group Assignments
              </legend>

              {/* Selected group cards */}
              {groupLinks.length > 0 && (
                <div className="space-y-2">
                  {groupLinks.map(g => {
                    const isFull = g.capacity != null && g.student_count >= g.capacity
                    const sessionStr = g.day_of_week
                      ? `${g.day_of_week}${g.start_time ? ` · ${g.start_time}` : ''}`
                      : null
                    return (
                      <div
                        key={g.group_id}
                        className={`flex items-start justify-between gap-3 rounded-lg border p-3
                          ${isFull ? 'border-[#FDE68A] bg-[#FFFBEB]' : 'border-[#E2E8F0] bg-[#F8FAFC]'}`}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-[13px] font-semibold text-[#0B1F3A]">{g.group_name}</p>
                            {isFull && (
                              <span className="rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">FULL</span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#64748B]">
                            {g.course_name ?? '—'}{g.instructor_name ? ` · ${g.instructor_name}` : ''}
                          </p>
                          {sessionStr && <p className="text-[11px] text-[#64748B]">{sessionStr}</p>}
                          <p className="text-[11px] text-[#94A3B8]">
                            {g.student_count}{g.capacity != null ? `/${g.capacity}` : ''} students
                            {' · '}{g.status}
                            {' · '}{g.branch_name}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeGroupLink(g.group_id)}
                          className="shrink-0 rounded p-0.5 text-[#94A3B8] hover:bg-[#FEE2E2] hover:text-[#EF4444]"
                          aria-label="Remove group"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {sameCourseWarning && (
                <p className="text-[11px] text-[#F59E0B]">
                  Warning: multiple selected groups share the same course.
                </p>
              )}

              {/* Picker */}
              <div className="relative" ref={pickerRef}>
                <div className="mb-2 flex flex-wrap gap-2">
                  <input
                    value={groupPickerQ}
                    onChange={e => setGroupPickerQ(e.target.value)}
                    onFocus={() => setShowGroupPicker(true)}
                    placeholder="Search groups…"
                    className="min-w-40 flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#FF8A1F] focus:outline-none"
                  />
                  {branches.length > 1 && !selectedBranchId && (
                    <select
                      value={groupPickerBranch}
                      onChange={e => setGroupPickerBranch(e.target.value)}
                      className="rounded-lg border border-[#E2E8F0] px-2 py-2 text-xs text-[#64748B] focus:border-[#FF8A1F] focus:outline-none"
                    >
                      <option value="">All Branches</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  )}
                  <select
                    value={groupPickerStatus}
                    onChange={e => setGroupPickerStatus(e.target.value)}
                    className="rounded-lg border border-[#E2E8F0] px-2 py-2 text-xs text-[#64748B] focus:border-[#FF8A1F] focus:outline-none"
                  >
                    <option value="">Forming + Active</option>
                    <option value="forming">Forming</option>
                    <option value="active">Active</option>
                  </select>
                </div>

                {showGroupPicker && pickerResults.length > 0 && (
                  <div className="absolute z-20 max-h-60 w-full overflow-y-auto ds-card shadow-xl">
                    {pickerResults.map(g => {
                      const isFull = g.capacity != null && g.student_count >= g.capacity
                      const sessionStr = g.day_of_week
                        ? `${g.day_of_week}${g.start_time ? ` · ${g.start_time}` : ''}`
                        : null
                      return (
                        <button
                          key={g.group_id}
                          type="button"
                          disabled={isFull}
                          onClick={() => { addGroupLink(g); setGroupPickerQ(''); setShowGroupPicker(false) }}
                          className={`w-full border-b border-[#E2E8F0] px-4 py-3 text-left last:border-0 transition
                            ${isFull ? 'cursor-not-allowed opacity-60' : 'hover:bg-[#F8FAFC]'}`}
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-[13px] font-semibold text-[#0B1F3A]">{g.group_name}</p>
                            {isFull && (
                              <span className="rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">FULL</span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#64748B]">
                            {g.course_name ?? '—'}{g.instructor_name ? ` · ${g.instructor_name}` : ''}
                          </p>
                          {sessionStr && <p className="text-[11px] text-[#64748B]">{sessionStr}</p>}
                          <p className="text-[11px] text-[#94A3B8]">
                            {g.student_count}{g.capacity != null ? `/${g.capacity}` : ''} students
                            {' · '}{g.status}
                            {' · '}{g.branch_name}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )}

                {showGroupPicker && groupPickerQ && pickerResults.length === 0 && (
                  <div className="ds-card px-4 py-3 text-sm text-[#94A3B8]">
                    No groups match your search.
                  </div>
                )}
              </div>

              {/* Hidden inputs consumed by server action */}
              <input type="hidden" name="groups_to_add_json"    value={JSON.stringify(groupsToAdd)} />
              <input type="hidden" name="groups_to_remove_json" value={JSON.stringify(groupsToRemove)} />
            </fieldset>
          )}

          {/* ── Footer ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 pt-2">
            {/* Delete section (edit + TL only) */}
            <div className="flex-1">
              {isEdit && isTL && onDelete && (
                deleteConfirm ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-[#EF4444]">
                      Delete <span className="font-semibold">{student?.student_name}</span>?
                    </p>
                    {deleteErr && <p className="w-full text-xs text-[#EF4444]">{deleteErr}</p>}
                    <button
                      type="button"
                      onClick={handleConfirmDelete}
                      disabled={deleteLoading}
                      className="rounded-lg bg-[#DC2626] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-60"
                    >
                      {deleteLoading ? 'Deleting…' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDeleteConfirm(false); setDeleteErr(null) }}
                      className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#64748B]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(true)}
                    className="text-sm font-medium text-[#EF4444] hover:text-[#DC2626]"
                  >
                    Delete Student
                  </button>
                )
              )}
            </div>
            {/* Cancel + Save */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { if (dirty && !confirm('Close without saving?')) return; onClose() }}
                className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !!ageErr}
                className="rounded-lg bg-[#FF8A1F] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#e87c18] disabled:opacity-60"
              >
                {isPending
                  ? (isEdit ? 'Saving…' : 'Enrolling…')
                  : (isEdit ? 'Save Changes' : 'Enroll Student')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
