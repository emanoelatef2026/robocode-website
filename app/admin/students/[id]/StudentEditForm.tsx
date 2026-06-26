'use client'

import { useActionState, useState, useTransition } from 'react'
import {
  updateStudent,
  deleteStudent,
  setStudentPassword,
  sendStudentPasswordReset,
  transferStudentBranch,
} from '@/modules/students/actions'
import {
  enrollStudent,
  unenrollStudent,
  changeEnrollmentType,
} from '@/modules/groups/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { Student } from '@/modules/students/types'
import type { BranchListItem } from '@/modules/branches/types'
import type { GroupListItem } from '@/modules/groups/types'
import type { ActionResult } from '@/types/app'

const STUDENT_STATUSES = ['active', 'inactive', 'graduated', 'paused', 'banned'] as const

interface CurrentGroup {
  id:              string       // group_students.id
  groups:          { id: string; name: string; code: string | null } | null
  enrollment_type: 'primary' | 'secondary'
  student_id:      string
}

interface Props {
  student:        Student
  branches:       BranchListItem[]
  availableGroups: GroupListItem[]
  currentGroups:   CurrentGroup[]
}

function age(dob: string | null | undefined): number | null {
  if (!dob) return null
  const b = new Date(dob)
  const now = new Date()
  let a = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--
  return a
}

export default function StudentEditForm({ student, branches, availableGroups, currentGroups }: Props) {
  const [editState, editAction] = useActionState<ActionResult<void> | null, FormData>(updateStudent, null)
  const [isPending, startTransition] = useTransition()

  const studentAge = age(student.date_of_birth)

  // ── Password state ───────────────────────────────────────────────────────
  const [newPassword, setNewPassword] = useState('')
  const [pwError,     setPwError]     = useState<string | null>(null)
  const [pwSuccess,   setPwSuccess]   = useState<string | null>(null)
  const [emailMsg,    setEmailMsg]    = useState<string | null>(null)

  // ── Branch transfer state ─────────────────────────────────────────────────
  const [targetBranch,    setTargetBranch]    = useState('')
  const [transferError,   setTransferError]   = useState<string | null>(null)
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null)

  // ── Group assignment state ────────────────────────────────────────────────
  const [groupError, setGroupError] = useState<string | null>(null)

  const [enrollState, enrollAction] = useActionState<ActionResult<void> | null, FormData>(enrollStudent, null)

  const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

  const handleDelete = async () => {
    if (!confirm('Remove this student? This cannot be undone.')) return
    await deleteStudent(student.id)
    window.location.href = '/admin/students'
  }

  const handleSetPassword = () => {
    if (!newPassword || newPassword.length < 6) {
      setPwError('Password must be at least 6 characters.'); return
    }
    setPwError(null); setPwSuccess(null)
    startTransition(async () => {
      const res = await setStudentPassword(student.id, newPassword)
      if (!res.success) { setPwError(res.error.message) }
      else { setPwSuccess('Password updated.'); setNewPassword('') }
    })
  }

  const handleSendReset = () => {
    setEmailMsg(null)
    startTransition(async () => {
      const res = await sendStudentPasswordReset(student.id)
      setEmailMsg(res.success ? 'Reset email sent.' : (res as any).error.message)
    })
  }

  const handleTransfer = () => {
    if (!targetBranch) { setTransferError('Select a target branch.'); return }
    if (!confirm('Transfer this student to a new branch? Active group memberships will be dropped.')) return
    setTransferError(null); setTransferSuccess(null)
    startTransition(async () => {
      const res = await transferStudentBranch(student.id, targetBranch)
      if (!res.success) { setTransferError(res.error.message) }
      else { setTransferSuccess('Student transferred. Reloading…'); setTimeout(() => window.location.reload(), 800) }
    })
  }

  const handleChangeType = (groupStudentId: string, studentId: string, currentType: 'primary' | 'secondary') => {
    const groupRow = currentGroups.find((g) => g.id === groupStudentId)
    if (!groupRow?.groups?.id) return
    const next = currentType === 'primary' ? 'secondary' : 'primary'
    startTransition(async () => {
      const res = await changeEnrollmentType(groupRow.groups!.id, studentId, next)
      if (!res.success) setGroupError(res.error.message)
      else window.location.reload()
    })
  }

  const handleRemoveGroup = (studentId: string, groupStudentRow: CurrentGroup) => {
    if (!groupStudentRow.groups?.id) return
    if (!confirm('Remove student from this group?')) return
    startTransition(async () => {
      const res = await unenrollStudent(groupStudentRow.groups!.id, studentId)
      if (!res.success) setGroupError(res.error.message)
      else window.location.reload()
    })
  }

  return (
    <div className="space-y-5">
      {/* ── Summary bar ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4 text-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-[#94A3B8]">Student Code</p>
            <p className="mt-0.5 font-mono font-medium text-[#0B1F3A]">{student.student_code ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-[#94A3B8]">Age</p>
            <p className="mt-0.5 font-medium text-[#0B1F3A]">{studentAge != null ? `${studentAge} yrs` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-[#94A3B8]">Branch</p>
            <p className="mt-0.5 font-medium text-[#0B1F3A]">{student.branch_name}</p>
          </div>
          <div>
            <p className="text-xs text-[#94A3B8]">Enrolled</p>
            <p className="mt-0.5 font-medium text-[#0B1F3A]">
              {new Date(student.enrollment_date).toLocaleDateString('en-GB')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Profile editor ─────────────────────────────────────────────────── */}
      <div className="ds-card p-6">
        <h2 className="mb-4 text-sm font-semibold text-[#0B1F3A]">Profile</h2>

        {editState && !editState.success && (
          <div className="mb-4 rounded-lg bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">
            {editState.error.message}
          </div>
        )}

        <form action={editAction} className="space-y-4">
          <input type="hidden" name="id" value={student.id} />

          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">First name</label>
              <input name="first_name" defaultValue={student.first_name ?? ''} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Last name</label>
              <input name="last_name" defaultValue={student.last_name ?? ''} className={cls} />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Email</label>
            <input name="email" type="email" defaultValue={student.user_email ?? ''} className={cls} />
          </div>

          {/* Status + DOB */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Status</label>
              <select name="status" defaultValue={student.status} className={cls}>
                {STUDENT_STATUSES.map(s => (
                  <option key={s} value={s} className="capitalize">{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Date of birth</label>
              <input name="date_of_birth" type="date" defaultValue={student.date_of_birth ?? ''} className={cls} />
            </div>
          </div>

          {/* Grade + Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">School grade</label>
              <input name="school_grade" defaultValue={student.school_grade ?? ''} className={cls} placeholder="e.g. Grade 5" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Phone</label>
              <input name="phone" type="tel" defaultValue={student.phone ?? ''} className={cls} />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Address</label>
            <input name="address" defaultValue={student.address ?? ''} className={cls} />
          </div>

          {/* Parent phones */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Parent phone 1</label>
              <input name="parent_phone_1" type="tel" defaultValue={student.parent_phone_1 ?? ''} className={cls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Parent phone 2</label>
              <input name="parent_phone_2" type="tel" defaultValue={student.parent_phone_2 ?? ''} className={cls} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Notes</label>
            <textarea name="notes" rows={3} defaultValue={student.notes ?? ''} className={cls} />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={handleDelete} className="text-sm font-medium text-[#EF4444] hover:text-[#DC2626]">
              Remove student
            </button>
            <div className="flex items-center gap-3">
              <Link href="/admin/students" className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]">
                Cancel
              </Link>
              <SubmitButton label="Save Changes" />
            </div>
          </div>
        </form>
      </div>

      {/* ── Group Assignment ──────────────────────────────────────────────── */}
      <div className="ds-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#0B1F3A]">Group Assignment</h2>

        {groupError && (
          <div className="mb-3 rounded-lg bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">
            {groupError}
            <button onClick={() => setGroupError(null)} className="ml-2 underline">dismiss</button>
          </div>
        )}
        {enrollState && !enrollState.success && (
          <div className="mb-3 rounded-lg bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">{enrollState.error.message}</div>
        )}

        {/* Current active groups */}
        {currentGroups.length > 0 && (
          <div className="mb-3 divide-y divide-[#F1F5F9] rounded-lg border border-[#E2E8F0]">
            {currentGroups.map((g) => (
              <div key={g.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-[#0B1F3A]">{g.groups?.name ?? '—'}</span>
                  {g.groups?.code && <span className="ml-1.5 font-mono text-xs text-[#94A3B8]">{g.groups.code}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleChangeType(g.id, student.id, g.enrollment_type)}
                    className={[
                      'rounded-full px-2 py-0.5 text-[11px] font-medium capitalize cursor-pointer transition hover:opacity-75 disabled:opacity-50',
                      g.enrollment_type === 'primary' ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'bg-purple-50 text-purple-700',
                    ].join(' ')}
                    title="Click to toggle type"
                  >
                    {g.enrollment_type} ↻
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleRemoveGroup(student.id, g)}
                    className="text-xs text-[#F87171] hover:text-[#EF4444] disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Enroll in a new group */}
        {availableGroups.length > 0 && (
          <form action={enrollAction} className="flex gap-2">
            <input type="hidden" name="student_id" value={student.id} />
            <select name="group_id" required className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F]">
              <option value="">Enroll in group…</option>
              {availableGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}{g.code ? ` (${g.code})` : ''}</option>
              ))}
            </select>
            <select name="enrollment_type" defaultValue="primary" className="rounded-lg border border-[#E2E8F0] px-2.5 py-2 text-sm outline-none">
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
            </select>
            <SubmitButton label="Enroll" pendingLabel="…" />
          </form>
        )}
        {availableGroups.length === 0 && currentGroups.length === 0 && (
          <p className="text-sm text-[#94A3B8]">No groups available in this branch.</p>
        )}
      </div>

      {/* ── Password Reset ─────────────────────────────────────────────────── */}
      <div className="ds-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#0B1F3A]">Password Management</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Set new password directly</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 characters)"
                className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              />
              <button type="button" disabled={isPending} onClick={handleSetPassword}
                className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#e87c18] disabled:opacity-50">
                Set Password
              </button>
            </div>
            {pwError   && <p className="mt-1 text-xs text-[#EF4444]">{pwError}</p>}
            {pwSuccess  && <p className="mt-1 text-xs text-[#10B981]">{pwSuccess}</p>}
          </div>

          <div className="relative flex items-center">
            <div className="flex-1 border-t border-[#E2E8F0]" />
            <span className="mx-3 text-xs text-[#94A3B8]">or</span>
            <div className="flex-1 border-t border-[#E2E8F0]" />
          </div>

          <div>
            <p className="mb-1.5 text-xs text-[#64748B]">
              Send a reset email to <strong>{student.user_email}</strong>
            </p>
            <button type="button" disabled={isPending} onClick={handleSendReset}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#0B1F3A] hover:border-[#FF8A1F] hover:text-[#FF8A1F] disabled:opacity-50">
              Send Reset Email
            </button>
            {emailMsg && (
              <p className={`mt-1.5 text-xs ${emailMsg.includes('sent') ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                {emailMsg}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Branch Transfer ────────────────────────────────────────────────── */}
      {branches.length > 1 && (
        <div className="rounded-xl border border-amber-100 bg-[#FFFBEB] p-5">
          <h2 className="mb-1 text-sm font-semibold text-[#92400E]">Branch Transfer</h2>
          <p className="mb-3 text-xs text-[#B45309]">
            Moves the student to a new branch. Active group memberships are dropped. All academic history is preserved.
          </p>

          <div className="flex gap-2">
            <select
              value={targetBranch}
              onChange={(e) => setTargetBranch(e.target.value)}
              className="flex-1 rounded-lg border border-[#FDE68A] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#F59E0B]"
            >
              <option value="">Select target branch…</option>
              {branches.filter((b) => b.id !== student.branch_id).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <button type="button" disabled={isPending || !targetBranch} onClick={handleTransfer}
              className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-[#92400E] hover:bg-[#FFFBEB] disabled:opacity-50">
              Transfer
            </button>
          </div>
          {transferError   && <p className="mt-2 text-xs text-[#EF4444]">{transferError}</p>}
          {transferSuccess  && <p className="mt-2 text-xs text-[#10B981]">{transferSuccess}</p>}
        </div>
      )}
    </div>
  )
}
