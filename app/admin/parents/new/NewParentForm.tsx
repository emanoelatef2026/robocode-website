'use client'

import { useActionState, useRef, useState } from 'react'
import { createParent } from '@/modules/parents/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import Link from 'next/link'
import type { StudentListItem } from '@/modules/students/types'
import type { ActionResult } from '@/types/app'
import type { ParentMatchCandidate } from '@/modules/parents/identity'

interface Props { students: StudentListItem[] }

export default function NewParentForm({ students }: Props) {
  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    createParent,
    null
  )

  const formRef = useRef<HTMLFormElement>(null)
  const [resolvedParentId, setResolvedParentId] = useState('')
  const [forceNewParent,   setForceNewParent]   = useState(false)

  const ambiguousCandidates =
    state && !state.success && state.error?.code === 'AMBIGUOUS_PARENT_MATCH'
      ? ((state.error.data as ParentMatchCandidate[] | undefined) ?? [])
      : null

  function linkToExisting(parentId: string) {
    setResolvedParentId(parentId)
    setForceNewParent(false)
    requestAnimationFrame(() => formRef.current?.requestSubmit())
  }

  function createSeparateAccount() {
    setForceNewParent(true)
    setResolvedParentId('')
    requestAnimationFrame(() => formRef.current?.requestSubmit())
  }

  return (
    <div className="ds-card p-6">
      {state && !state.success && (
        <div className="mb-4 rounded-lg bg-[#FEE2E2] px-4 py-3 text-sm text-[#DC2626]">
          {state.error.message}
        </div>
      )}

      {ambiguousCandidates && ambiguousCandidates.length > 0 && (
        <div className="mb-4 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 space-y-2">
          <p className="text-xs text-[#92400E]">
            This phone number already matches {ambiguousCandidates.length} existing parent account{ambiguousCandidates.length > 1 ? 's' : ''}. Link to one, or create a separate account.
          </p>
          {ambiguousCandidates.map(c => (
            <button
              key={c.parentId}
              type="button"
              onClick={() => linkToExisting(c.parentId)}
              className="w-full flex items-center justify-between rounded-lg border border-[#FDE68A] bg-white px-3 py-2 text-left hover:border-[#F59E0B]"
            >
              <span>
                <span className="block text-xs font-medium text-[#0B1F3A]">{c.name}</span>
                <span className="block text-[11px] text-[#94A3B8]">{c.email} · {c.childCount} child{c.childCount === 1 ? '' : 'ren'} linked</span>
              </span>
              <span className="text-[11px] font-semibold text-[#F59E0B]">Link</span>
            </button>
          ))}
          <button
            type="button"
            onClick={createSeparateAccount}
            className="text-[11px] font-medium text-[#64748B] hover:underline"
          >
            None of these — create a separate new account
          </button>
        </div>
      )}

      <form ref={formRef} action={action} className="space-y-4">
        <input type="hidden" name="resolved_parent_id" value={resolvedParentId} />
        <input type="hidden" name="force_new_parent" value={String(forceNewParent)} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              First name <span className="text-[#EF4444]">*</span>
            </label>
            <input
              name="first_name"
              required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
              Last name <span className="text-[#EF4444]">*</span>
            </label>
            <input
              name="last_name"
              required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Phone <span className="text-[#94A3B8] text-xs font-normal">(used to detect an existing account)</span>
          </label>
          <input
            name="phone"
            type="tel"
            placeholder="01xxxxxxxxx"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">
            Password <span className="text-[#EF4444]">*</span>
          </label>
          <input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Minimum 6 characters"
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
          />
        </div>

        <div className="border-t border-[#E2E8F0] pt-4">
          <p className="mb-3 text-sm font-medium text-[#0B1F3A]">Link to a student (optional)</p>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#64748B]">Student</label>
            <select
              name="student_id"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              <option value="">None</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.user_email}
                  {' '}({s.branch_name})
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium text-[#64748B]">Relationship</label>
            <select
              name="relationship"
              defaultValue="guardian"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15"
            >
              <option value="father">Father</option>
              <option value="mother">Mother</option>
              <option value="guardian">Guardian</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/parents"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Cancel
          </Link>
          <SubmitButton label="Add Parent" pendingLabel="Adding…" />
        </div>
      </form>
    </div>
  )
}
