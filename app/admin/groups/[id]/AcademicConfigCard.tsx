'use client'

import { useActionState, useState, useTransition } from 'react'
import { saveGroupAcademicConfig, addGroupInstructor, removeGroupInstructor } from '@/modules/groups/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import type { GroupAcademicConfig } from '@/modules/groups/types'
import type { ActionResult } from '@/types/app'

interface CourseOption     { id: string; title: string; code: string | null }
interface InstructorOption { id: string; name: string; branch_name: string }

interface Props {
  groupId:     string
  config:      GroupAcademicConfig
  courses:     CourseOption[]
  instructors: InstructorOption[]
}

export default function AcademicConfigCard({ groupId, config, courses, instructors }: Props) {
  const [state, action] = useActionState<ActionResult<void> | null, FormData>(
    saveGroupAcademicConfig, null
  )

  const hasCourse     = !!config.course_id
  const hasInstructor = !!config.instructor_id
  const isActive      = hasCourse && hasInstructor

  const cls = 'w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15 bg-white'

  const assignedIds = new Set([
    config.instructor_id,
    ...config.additional_instructors.map((i) => i.id),
  ].filter(Boolean))
  const availableForAdditional = instructors.filter((i) => !assignedIds.has(i.id))

  return (
    <div className="ds-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#0B1F3A]">Group Configuration</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          isActive ? 'bg-[#E7F8EE] text-[#15803D]' : 'bg-[#FFFBEB] text-[#B45309]'
        }`}>
          {isActive ? 'Active' : 'Forming'}
        </span>
      </div>

      {!isActive && (
        <div className="mb-4 rounded-lg border border-amber-100 bg-[#FFFBEB] px-3 py-2.5">
          <p className="mb-1.5 text-xs font-medium text-[#92400E]">Missing before group can activate:</p>
          <ul className="space-y-1">
            {[
              { label: 'Course',          met: hasCourse },
              { label: 'Lead Instructor', met: hasInstructor },
            ].map(({ label, met }) => (
              <li key={label} className="flex items-center gap-1.5 text-xs">
                <span className={met ? 'text-[#10B981]' : 'text-[#F59E0B]'}>{met ? '✓' : '✗'}</span>
                <span className={met ? 'text-[#15803D]' : 'text-[#B45309]'}>
                  {label}{met ? ' assigned' : ' not assigned'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state?.success && (
        <div className="mb-3 rounded-lg bg-[#E7F8EE] px-3 py-2 text-sm text-[#15803D]">
          Configuration saved.{' '}
          {isActive
            ? 'Group is now Active — instructors can start sessions.'
            : 'Group remains Forming until course and instructor are assigned.'}
        </div>
      )}
      {state && !state.success && (
        <div className="mb-3 rounded-lg bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">
          {state.error.message}
        </div>
      )}

      <form action={action} className="space-y-3">
        <input type="hidden" name="group_id" value={groupId} />

        <div>
          <label className="mb-1 block text-xs font-medium text-[#64748B]">Course</label>
          <select name="course_id" defaultValue={config.course_id ?? ''} className={cls}>
            <option value="">— No course assigned —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}{c.code ? ` (${c.code})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#64748B]">Total Sessions</label>
          <input
            type="number"
            name="total_sessions"
            defaultValue={config.total_sessions ?? undefined}
            min={1}
            max={999}
            className={cls}
          />
          <p className="mt-0.5 text-xs text-[#94A3B8]">Total sessions planned for this group</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#64748B]">Lead Instructor</label>
          <select name="instructor_id" defaultValue={config.instructor_id ?? ''} className={cls}>
            <option value="">— No instructor assigned —</option>
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end pt-1">
          <SubmitButton label="Save Configuration" />
        </div>
      </form>

      {/* Additional Instructors */}
      <div className="mt-5 border-t border-[#E2E8F0] pt-4">
        <p className="mb-3 text-xs font-semibold text-[#0B1F3A]">
          Additional Instructors
          {config.additional_instructors.length > 0 && (
            <span className="ml-1.5 rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-medium text-[#64748B]">
              {config.additional_instructors.length}
            </span>
          )}
        </p>

        {config.additional_instructors.length > 0 && (
          <ul className="mb-3 space-y-1.5">
            {config.additional_instructors.map((inst) => (
              <AdditionalInstructorRow key={inst.id} groupId={groupId} instructor={inst} />
            ))}
          </ul>
        )}

        {availableForAdditional.length > 0 ? (
          <AddInstructorForm groupId={groupId} instructors={availableForAdditional} />
        ) : config.additional_instructors.length === 0 ? (
          <p className="text-xs text-[#94A3B8]">No additional instructors available to add.</p>
        ) : null}
      </div>
    </div>
  )
}

function AdditionalInstructorRow({
  groupId,
  instructor,
}: {
  groupId:    string
  instructor: { id: string; name: string }
}) {
  const [isPending, startTransition] = useTransition()

  const handleRemove = () => {
    startTransition(async () => {
      await removeGroupInstructor(groupId, instructor.id)
    })
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] px-3 py-2">
      <span className="text-sm text-[#0B1F3A]">{instructor.name}</span>
      <button
        type="button"
        onClick={handleRemove}
        disabled={isPending}
        className="text-xs text-[#F87171] hover:text-[#EF4444] disabled:opacity-50 transition"
      >
        {isPending ? 'Removing…' : 'Remove'}
      </button>
    </li>
  )
}

function AddInstructorForm({
  groupId,
  instructors,
}: {
  groupId:     string
  instructors: Array<{ id: string; name: string }>
}) {
  const [selectedId, setSelectedId] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleAdd = () => {
    if (!selectedId) return
    startTransition(async () => {
      await addGroupInstructor(groupId, selectedId, 'additional')
      setSelectedId('')
    })
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15 bg-white"
      >
        <option value="">— Add instructor —</option>
        {instructors.map((i) => (
          <option key={i.id} value={i.id}>{i.name}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleAdd}
        disabled={isPending || !selectedId}
        className="shrink-0 rounded-lg bg-[#0B1F3A] px-3 py-2 text-xs font-medium text-white hover:bg-[#1e3a5f] disabled:opacity-50 transition"
      >
        {isPending ? '…' : 'Add'}
      </button>
    </div>
  )
}
