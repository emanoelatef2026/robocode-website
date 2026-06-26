'use client'

import { useState, useEffect, useTransition } from 'react'
import type { GroupOperationalRow, GroupStudentOption } from '@/modules/groups/operational'
import { addStudentsToGroupAction } from '@/modules/groups/modal-actions'
import { filterStudentOptions } from '../utils'

export function QuickAddStudentModal({
  isOpen, group, studentOptions, currentStudentIds, onClose, onAdded,
}: {
  isOpen:            boolean
  group:             GroupOperationalRow
  studentOptions:    GroupStudentOption[]
  currentStudentIds: string[]
  onClose:           () => void
  onAdded:           () => void
}) {
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError]       = useState<string | null>(null)
  const [, startT]              = useTransition()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOpen) { setSearch(''); setSelected(new Set()); setError(null) }
  }, [isOpen])

  if (!isOpen) return null

  const filtered       = filterStudentOptions(studentOptions, currentStudentIds, search)
  const newTotal       = group.student_count + selected.size
  const isOverCapacity = group.capacity != null && newTotal > group.capacity

  function toggleStudent(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setError(null)
  }

  function handleAdd() {
    if (!selected.size) return
    if (isOverCapacity) { setError(`Would exceed capacity of ${group.capacity}.`); return }
    setError(null)
    startT(async () => {
      const res = await addStudentsToGroupAction(group.group_id, Array.from(selected))
      if (!res.success) { setError(res.error?.message ?? 'Failed to add students.'); return }
      onAdded()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 md:items-center md:justify-center md:p-4">
      <div className="w-full flex flex-col rounded-t-2xl bg-white shadow-xl max-h-[90dvh] md:rounded-2xl md:max-w-lg">
        <div className="flex justify-center pt-2.5 pb-0.5 md:hidden shrink-0">
          <div className="h-1 w-10 rounded-full bg-[#E2E8F0]" />
        </div>
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 md:px-5 py-3 md:py-4 shrink-0">
          <div>
            <h3 className="text-[14px] md:text-[15px] font-bold text-[#0B1F3A]">Add Student</h3>
            <p className="mt-0.5 text-[12px] text-[#64748B]">to {group.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-[#94A3B8] hover:bg-[#F1F5F9] transition">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="border-b border-[#E2E8F0] px-4 py-3 shrink-0">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, code, phone…"
            autoFocus
            className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[13px] text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:bg-white"
          />
          <div className="mt-2 flex items-center justify-between text-[11px] text-[#64748B]">
            <span>{filtered.length} available</span>
            {group.capacity && (
              <span className={isOverCapacity ? 'font-semibold text-[#EF4444]' : ''}>
                Capacity: {newTotal} / {group.capacity}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#94A3B8]">No eligible students found.</p>
          ) : filtered.map(s => {
            const isSelected = selected.has(s.student_id)
            return (
              <button
                key={s.student_id}
                onClick={() => toggleStudent(s.student_id)}
                className={[
                  'w-full border-b border-[#F1F5F9] px-4 py-3 text-left transition-colors',
                  isSelected ? 'bg-[#FFF7ED]' : 'hover:bg-[#F8FAFC]',
                ].join(' ')}
              >
                <div className="flex items-start gap-3">
                  <div className={[
                    'mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center',
                    isSelected ? 'border-[#FF8A1F] bg-[#FF8A1F]' : 'border-[#CBD5E1]',
                  ].join(' ')}>
                    {isSelected && (
                      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-[#0B1F3A]">{s.student_name}</p>
                      {s.student_code && <span className="font-mono text-[10px] text-[#94A3B8]">{s.student_code}</span>}
                      {s.age != null && <span className="text-[11px] text-[#64748B]">{s.age}y</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      {s.phone && <span className="font-mono text-[11px] text-[#64748B]">{s.phone}</span>}
                      {s.parent_phone && <span className="font-mono text-[11px] text-[#94A3B8]">P: {s.parent_phone}</span>}
                      <span className="text-[11px] text-[#94A3B8]">{s.branch_name}</span>
                      {s.sessions_remaining != null && (
                        <span className={`text-[11px] ${s.sessions_remaining <= 2 ? 'font-medium text-[#EF4444]' : 'text-[#64748B]'}`}>
                          {s.sessions_remaining} sess. left
                        </span>
                      )}
                    </div>
                    {s.group_name && (
                      <p className="mt-0.5 text-[11px] text-[#F59E0B]">Currently in: {s.group_name}</p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="shrink-0 border-t border-[#E2E8F0] px-5 py-4">
          {error && (
            <p className="mb-3 rounded-lg bg-[#FEE2E2] px-3 py-2 text-[12px] text-[#EF4444]">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] text-[#374151] hover:bg-[#F8FAFC] transition"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!selected.size || isOverCapacity}
              className="flex-1 rounded-lg bg-[#FF8A1F] py-2 text-[13px] font-semibold text-white hover:bg-[#e87c18] transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {selected.size > 0 ? `Add (${selected.size}) to Group` : 'Add to Group'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
