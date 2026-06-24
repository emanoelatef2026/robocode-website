'use client'

import { useActionState, useState, useTransition } from 'react'
import {
  updateInstructor,
  deleteInstructor,
  assignGroupToInstructor,
  removeGroupFromInstructor,
  setInstructorPassword,
  sendInstructorPasswordReset,
} from '@/modules/instructors/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import PermissionsChecklist from '@/components/admin/PermissionsChecklist'
import StatusBadge from '@/components/admin/StatusBadge'
import Link from 'next/link'
import type { Instructor } from '@/modules/instructors/types'
import type { InstructorGroup } from '@/modules/instructors/queries'
import type { GroupListItem } from '@/modules/groups/types'
import type { ActionResult } from '@/types/app'

const STATUSES = ['active', 'inactive', 'on_leave'] as const

interface Props {
  instructor:        Instructor
  assignedGroups:    InstructorGroup[]
  availableGroups:   GroupListItem[]
  currentPermissions: string[]
}

export default function InstructorEditForm({
  instructor,
  assignedGroups: initialGroups,
  availableGroups: initialAvailable,
  currentPermissions,
}: Props) {
  const [editState, editAction] = useActionState<ActionResult<void> | null, FormData>(updateInstructor, null)
  const [isPending, startTransition] = useTransition()

  // Local group state for optimistic updates
  const [assignedGroups,  setAssigned]   = useState<InstructorGroup[]>(initialGroups)
  const [availableGroups, setAvailable]  = useState<GroupListItem[]>(initialAvailable)
  const [groupError,      setGroupError] = useState<string | null>(null)

  // Password state
  const [newPassword, setNewPassword]   = useState('')
  const [pwError,     setPwError]       = useState<string | null>(null)
  const [pwSuccess,   setPwSuccess]     = useState<string | null>(null)
  const [emailMsg,    setEmailMsg]      = useState<string | null>(null)

  const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15'

  const handleDelete = async () => {
    if (!confirm('Remove this instructor? This cannot be undone.')) return
    await deleteInstructor(instructor.id)
    window.location.href = '/admin/instructors'
  }

  // ── Group assignment ─────────────────────────────────────────────────────
  const handleAssign = (groupId: string) => {
    const grp = availableGroups.find((g) => g.id === groupId)
    if (!grp) return
    // Optimistic
    setAvailable((prev) => prev.filter((g) => g.id !== groupId))
    setAssigned((prev) => [...prev, { id: grp.id, name: grp.name, code: grp.code, type: grp.type, status: grp.status, branch_id: grp.branch_id, branch_name: grp.branch_name, student_count: grp.student_count ?? 0 }])
    startTransition(async () => {
      const res = await assignGroupToInstructor(instructor.id, groupId)
      if (!res.success) {
        setAssigned((prev) => prev.filter((g) => g.id !== groupId))
        setAvailable((prev) => [...prev, grp])
        setGroupError(res.error.message)
      }
    })
  }

  const handleRemoveGroup = (groupId: string) => {
    if (!confirm('Remove instructor from this group?')) return
    const grp = assignedGroups.find((g) => g.id === groupId)
    if (!grp) return
    setAssigned((prev) => prev.filter((g) => g.id !== groupId))
    setAvailable((prev) => [...prev, { id: grp.id, branch_id: grp.branch_id, name: grp.name, code: grp.code, type: grp.type as any, capacity: null, status: grp.status as any, start_date: null, day_of_week: null, time: null, robocode_share_percent: 100, branch_name: grp.branch_name, student_count: grp.student_count, instructor_name: null }])
    startTransition(async () => {
      const res = await removeGroupFromInstructor(instructor.id, groupId)
      if (!res.success) {
        setAssigned((prev) => [...prev, grp])
        setAvailable((prev) => prev.filter((g) => g.id !== groupId))
        setGroupError(res.error.message)
      }
    })
  }

  // ── Password reset ───────────────────────────────────────────────────────
  const handleSetPassword = () => {
    if (!newPassword || newPassword.length < 6) {
      setPwError('Password must be at least 6 characters.'); return
    }
    setPwError(null); setPwSuccess(null)
    startTransition(async () => {
      const res = await setInstructorPassword(instructor.id, newPassword)
      if (!res.success) { setPwError(res.error.message) }
      else { setPwSuccess('Password updated successfully.'); setNewPassword('') }
    })
  }

  const handleSendReset = () => {
    setEmailMsg(null)
    startTransition(async () => {
      const res = await sendInstructorPasswordReset(instructor.id)
      setEmailMsg(res.success ? 'Reset email sent.' : (res as any).error.message)
    })
  }

  return (
    <div className="space-y-5">
      {instructor.instructor_code && (
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3">
          <p className="text-xs text-[#94A3B8]">Instructor Code</p>
          <p className="mt-0.5 font-mono font-semibold text-[#0B1F3A]">{instructor.instructor_code}</p>
        </div>
      )}

      {/* ── Profile & Settings ─────────────────────────────────────────────── */}
      <div className="ds-card p-6">
        <h2 className="mb-4 text-sm font-semibold text-[#0B1F3A]">Profile & Settings</h2>

        {editState && !editState.success && (
          <div className="mb-4 rounded-lg bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">
            {editState.error.message}
          </div>
        )}

        <form action={editAction} className="space-y-4">
          <input type="hidden" name="id" value={instructor.id} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Status</label>
              <select name="status" defaultValue={instructor.status} className={cls}>
                {STATUSES.map(s => (
                  <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Employee ID</label>
              <input name="employee_id" defaultValue={instructor.employee_id ?? ''} className={cls} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Phone</label>
            <input name="phone" type="tel" defaultValue={instructor.phone ?? ''} className={cls} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Specializations <span className="text-xs text-[#94A3B8]">(comma-separated)</span>
            </label>
            <input name="specializations" defaultValue={instructor.specializations.join(', ')} className={cls} />
          </div>

          <div className="border-t border-[#E2E8F0] pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Payment Info</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Payment link</label>
                <input name="payment_link" defaultValue={instructor.payment_link ?? ''} className={cls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Wallet number</label>
                  <input name="wallet_number" defaultValue={instructor.wallet_number ?? ''} className={cls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Bank account</label>
                  <input name="bank_account_number" defaultValue={instructor.bank_account_number ?? ''} className={cls} />
                </div>
              </div>
            </div>
          </div>

          <PermissionsChecklist defaultPermissions={currentPermissions} />

          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={handleDelete} className="text-sm font-medium text-[#EF4444] hover:text-[#DC2626]">
              Remove instructor
            </button>
            <div className="flex items-center gap-3">
              <Link href="/admin/instructors" className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]">
                Cancel
              </Link>
              <SubmitButton label="Save Changes" />
            </div>
          </div>
        </form>
      </div>

      {/* ── Groups ─────────────────────────────────────────────────────────── */}
      <div className="ds-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#0B1F3A]">
          Groups
          <span className="ml-2 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs font-normal text-[#64748B]">{assignedGroups.length}</span>
        </h2>

        {groupError && (
          <div className="mb-3 rounded-lg bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">
            {groupError}
            <button onClick={() => setGroupError(null)} className="ml-2 underline">dismiss</button>
          </div>
        )}

        {/* Assign to new group */}
        {availableGroups.length > 0 && (
          <div className="mb-3 flex gap-2">
            <select
              id="assign-group-select"
              className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F]"
              defaultValue=""
            >
              <option value="">Assign to group…</option>
              {availableGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}{g.code ? ` (${g.code})` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                const sel = (document.getElementById('assign-group-select') as HTMLSelectElement)?.value
                if (sel) handleAssign(sel)
              }}
              className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e87c18] disabled:opacity-50"
            >
              Assign
            </button>
          </div>
        )}

        {assignedGroups.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No groups assigned.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="ds-table-head">
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="px-3 py-2 text-left text-xs font-medium text-[#64748B]">Code</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[#64748B]">Group</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[#64748B]">Branch</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-[#64748B]">Students</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[#64748B]">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {assignedGroups.map((g) => (
                <tr key={g.id} className="ds-table-row">
                  <td className="px-3 py-2 font-mono text-xs text-[#94A3B8]">{g.code ?? '—'}</td>
                  <td className="px-3 py-2 font-medium text-[#0B1F3A]">
                    <Link href={`/admin/groups/${g.id}`} className="hover:text-[#FF8A1F]">{g.name}</Link>
                  </td>
                  <td className="px-3 py-2 text-[#64748B]">{g.branch_name}</td>
                  <td className="px-3 py-2 text-right font-medium text-[#0B1F3A]">{g.student_count}</td>
                  <td className="px-3 py-2"><StatusBadge status={g.status} /></td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleRemoveGroup(g.id)}
                      className="text-xs font-medium text-[#F87171] hover:text-[#EF4444] disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Password Reset ─────────────────────────────────────────────────── */}
      <div className="ds-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#0B1F3A]">Password Management</h2>

        <div className="space-y-3">
          {/* Direct set */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Set new password directly</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 characters)"
                className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
              />
              <button
                type="button"
                disabled={isPending}
                onClick={handleSetPassword}
                className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e87c18] disabled:opacity-50"
              >
                Set Password
              </button>
            </div>
            {pwError   && <p className="mt-1.5 text-xs text-[#EF4444]">{pwError}</p>}
            {pwSuccess  && <p className="mt-1.5 text-xs text-[#10B981]">{pwSuccess}</p>}
          </div>

          <div className="relative flex items-center">
            <div className="flex-1 border-t border-[#E2E8F0]" />
            <span className="mx-3 text-xs text-[#94A3B8]">or</span>
            <div className="flex-1 border-t border-[#E2E8F0]" />
          </div>

          {/* Send reset email */}
          <div>
            <p className="mb-1.5 text-xs text-[#64748B]">
              Send a password reset email to <strong>{instructor.user_email}</strong>
            </p>
            <button
              type="button"
              disabled={isPending}
              onClick={handleSendReset}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#0B1F3A] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F] disabled:opacity-50"
            >
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
    </div>
  )
}
