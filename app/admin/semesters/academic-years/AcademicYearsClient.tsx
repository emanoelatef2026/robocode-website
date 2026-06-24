'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createAcademicYear, updateAcademicYear, deleteAcademicYear } from '@/modules/academic-years/actions'
import SubmitButton from '@/components/admin/SubmitButton'
import type { AcademicYearListItem } from '@/modules/academic-years/types'
import type { ActionResult } from '@/types/app'

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [state, action] = useActionState<ActionResult<{ id: string }> | null, FormData>(
    createAcademicYear,
    null
  )

  useEffect(() => {
    if (state?.success) onCreated()
  }, [state, onCreated])

  return (
    <div className="ds-card p-5">
      <h2 className="mb-4 text-sm font-medium text-[#0B1F3A]">Add Academic Year</h2>
      {state && !state.success && (
        <div className="mb-3 rounded-lg bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">{state.error.message}</div>
      )}
      <form action={action} className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Name</label>
            <input name="name" required placeholder="e.g. 2025-2026"
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">Start date</label>
            <input name="start_date" type="date" required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#64748B]">End date</label>
            <input name="end_date" type="date" required
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-[#0B1F3A]">
            <input name="is_current" type="checkbox" value="on"
              className="h-4 w-4 rounded border-[#E2E8F0] accent-[#FF8A1F]" />
            Mark as current year
          </label>
          <SubmitButton label="Create" pendingLabel="Creating…" />
        </div>
      </form>
    </div>
  )
}

function YearRow({ year, onChanged }: { year: AcademicYearListItem; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [state, action] = useActionState<ActionResult<void> | null, FormData>(updateAcademicYear, null)

  useEffect(() => {
    if (state?.success) { setEditing(false); onChanged() }
  }, [state, onChanged])

  const handleDelete = async () => {
    if (!confirm(`Delete "${year.name}"? All semesters in this year will also be deleted.`)) return
    const result = await deleteAcademicYear(year.id)
    if (result.success) onChanged()
    else alert(result.error.message)
  }

  return (
    <li className="ds-card">
      {!editing ? (
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {year.is_current && (
              <span className="rounded-md bg-[#FF8A1F]/10 px-2 py-0.5 text-xs font-medium text-[#FF8A1F]">
                Current
              </span>
            )}
            <p className="text-sm font-medium text-[#0B1F3A]">{year.name}</p>
            <p className="text-xs text-[#64748B]">
              {new Date(year.start_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
              {' – '}
              {new Date(year.end_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setEditing(true)}
              className="text-xs font-medium text-[#FF8A1F] hover:underline">
              Edit
            </button>
            <button type="button" onClick={handleDelete}
              className="text-xs text-[#F87171] hover:text-[#EF4444]">
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4">
          {state && !state.success && (
            <div className="mb-3 rounded-lg bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">{state.error.message}</div>
          )}
          <form action={action} className="space-y-3">
            <input type="hidden" name="id" value={year.id} />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Name</label>
                <input name="name" defaultValue={year.name} required
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">Start date</label>
                <input name="start_date" type="date" defaultValue={year.start_date} required
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#64748B]">End date</label>
                <input name="end_date" type="date" defaultValue={year.end_date} required
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0B1F3A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/15" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-[#0B1F3A]">
                <input name="is_current" type="checkbox" value="on" defaultChecked={year.is_current}
                  className="h-4 w-4 rounded border-[#E2E8F0] accent-[#FF8A1F]" />
                Mark as current year
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(false)}
                  className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#64748B] transition hover:border-[#CBD5E1]">
                  Cancel
                </button>
                <SubmitButton label="Save" pendingLabel="Saving…" />
              </div>
            </div>
          </form>
        </div>
      )}
    </li>
  )
}

interface Props {
  years: AcademicYearListItem[]
}

export default function AcademicYearsClient({ years: initialYears }: Props) {
  const router = useRouter()
  const [years, setYears] = useState(initialYears)

  const refresh = () => router.refresh()

  useEffect(() => {
    setYears(initialYears)
  }, [initialYears])

  return (
    <div className="space-y-5">
      <CreateForm onCreated={refresh} />

      {years.length === 0 ? (
        <p className="text-sm text-[#94A3B8]">No academic years yet. Create one above.</p>
      ) : (
        <ul className="space-y-2">
          {years.map((y) => (
            <YearRow key={y.id} year={y} onChanged={refresh} />
          ))}
        </ul>
      )}
    </div>
  )
}
