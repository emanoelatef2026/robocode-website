'use client'

import { useEffect, useState, useTransition } from 'react'
import type { StudentOperationalRow } from '@/modules/students/operational'
import { assignStudentToGroup } from '@/modules/students/group-actions'

interface Props {
  student:   StudentOperationalRow
  groups:    { id: string; name: string }[]
  onClose:   () => void
  onSuccess: () => void
}

export default function GroupAssignModal({ student, groups, onClose, onSuccess }: Props) {
  const [selectedGroup, setSelectedGroup] = useState('')
  const [error, setError]                 = useState<string | null>(null)
  const [pending, startTransition]        = useTransition()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGroup) { setError('Select a group first'); return }
    setError(null)
    startTransition(async () => {
      const result = await assignStudentToGroup(student.student_id, selectedGroup)
      if (result.success) {
        onSuccess()
      } else {
        setError(result.error.message)
      }
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
        onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-[#0B1F3A]">Assign to Group</h2>
              <p className="text-xs text-[#64748B]">{student.student_name}</p>
            </div>
            <button onClick={onClose}
              className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9]">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="rounded-lg bg-[#FEE2E2] px-3 py-2 text-sm text-[#DC2626]">{error}</div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-[#0B1F3A]">Select Group <span className="text-[#EF4444]">*</span></label>
              {groups.length === 0 ? (
                <p className="text-sm text-[#94A3B8]">No active groups available in this branch.</p>
              ) : (
                <select
                  value={selectedGroup}
                  onChange={e => setSelectedGroup(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0B1F3A] focus:border-[#FF8A1F] focus:outline-none"
                >
                  <option value="">— Select a group —</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              )}
            </div>

            {student.group_id && (
              <div className="rounded-lg bg-[#FFFBEB] border border-amber-100 px-3 py-2 text-xs text-[#B45309]">
                This student is already in a group. Assigning to a new group will add a secondary membership.
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 rounded-lg border border-[#E2E8F0] py-2.5 text-sm font-medium text-[#64748B] hover:border-[#CBD5E1]">
                Cancel
              </button>
              <button type="submit" disabled={pending || groups.length === 0}
                className="flex-1 rounded-lg bg-[#FF8A1F] py-2.5 text-sm font-medium text-white hover:bg-[#e87c18] disabled:opacity-60">
                {pending ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
