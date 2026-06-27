'use client'

import { useState, useTransition } from 'react'
import { assignGroupModalAction } from '@/modules/instructors/modal-actions'
import type { InstructorFormOptions } from '@/modules/instructors/types'

export function AssignGroupModal({ instructorId, currentGroupIds, options, onClose, onAssigned }: {
  instructorId:    string
  currentGroupIds: string[]
  options:         InstructorFormOptions
  onClose:         () => void
  onAssigned:      () => void
}) {
  const [groupId, setGroupId]              = useState('')
  const [role, setRole]                    = useState<'lead' | 'assistant'>('lead')
  const [q, setQ]                          = useState('')
  const [allocatedSessions, setAllocated]  = useState<string>('')
  const [isPending, startTransition]       = useTransition()
  const [error, setError]                  = useState<string | null>(null)

  const selectedGroup = options.groups.find(g => g.id === groupId) ?? null
  const fromSession   = selectedGroup ? selectedGroup.next_from_session : 1
  const remaining     = selectedGroup ? Math.max(0, (selectedGroup.total_sessions ?? 0) - fromSession + 1) : 0

  const eligible = options.groups.filter(g =>
    g.status !== 'cancelled' &&
    g.status !== 'archived' &&
    !currentGroupIds.includes(g.id) &&
    (!q || g.name.toLowerCase().includes(q.toLowerCase()) || (g.code ?? '').toLowerCase().includes(q.toLowerCase()))
  )

  function handleAssign() {
    if (!groupId) { setError('Select a group.'); return }
    const parsed = allocatedSessions !== '' ? parseInt(allocatedSessions, 10) : undefined
    if (parsed !== undefined && (isNaN(parsed) || parsed < 1)) { setError('Sessions to teach must be a positive number.'); return }
    startTransition(async () => {
      const res = await assignGroupModalAction(instructorId, groupId, role, fromSession, parsed)
      if (res.success) onAssigned()
      else setError(res.error?.message ?? 'Failed.')
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/50 md:items-center md:justify-center md:p-4">
      <div className="w-full flex flex-col bg-white shadow-2xl overflow-hidden rounded-t-2xl max-h-[90dvh] md:rounded-2xl md:max-h-none md:max-w-lg">
        <div className="flex justify-center pt-2.5 pb-0.5 md:hidden shrink-0">
          <div className="h-1 w-10 rounded-full bg-[#E2E8F0]" />
        </div>

        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 md:px-6 py-3 md:py-4 shrink-0">
          <h2 className="text-[14px] md:text-[15px] font-bold text-[#0B1F3A]">Assign Group</h2>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0B1F3A]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">Role</label>
            <div className="flex gap-2">
              {(['lead', 'assistant'] as const).map(r => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={`flex-1 rounded-lg border py-2 text-[13px] font-medium capitalize transition ${role === r ? 'border-[#FF8A1F] bg-[#FFF7ED] text-[#FF8A1F]' : 'border-[#E2E8F0] text-[#64748B] hover:border-[#FF8A1F]'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">Search Groups</label>
            <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Group name or code…"
              className="mb-2 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F]"
            />
            <div className="max-h-64 overflow-y-auto rounded-xl border border-[#E2E8F0]">
              {eligible.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12px] text-[#94A3B8]">
                  {q ? 'No groups match' : currentGroupIds.length > 0 ? 'All eligible groups already assigned' : 'No active groups available to assign'}
                </p>
              ) : (
                eligible.map(g => (
                  <button key={g.id} type="button" onClick={() => { setGroupId(g.id); setAllocated('') }}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left border-b border-[#F1F5F9] last:border-0 transition ${groupId === g.id ? 'bg-[#FFF7ED]' : 'hover:bg-[#F8FAFC]'}`}>
                    <div>
                      <p className="text-[13px] font-semibold text-[#0B1F3A]">{g.name}</p>
                      <p className="text-[11px] text-[#64748B]">{g.branch_name}{g.code ? ` · ${g.code}` : ''}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-[12px] text-[#64748B]">{g.student_count} students</p>
                      {g.has_instructor && <p className="text-[10px] text-[#F59E0B]">Has instructor</p>}
                      {groupId === g.id && <div className="mt-0.5 h-2 w-2 rounded-full bg-[#FF8A1F] mx-auto" />}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {selectedGroup && (
            remaining <= 0 ? (
              <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12px] text-[#B45309]">
                All {selectedGroup.total_sessions ?? '?'} sessions are already allocated to other instructors. Assigning this instructor will give them an open-ended range.
              </div>
            ) : (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">From Session</label>
                  <div className="flex h-9 items-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[13px] text-[#64748B]">
                    {fromSession}
                    <span className="ml-1 text-[11px] text-[#94A3B8]">of {selectedGroup.total_sessions ?? '∞'}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-[#94A3B8]">Computed from existing allocations</p>
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">
                    Sessions to Teach
                    <span className="ml-1 text-[11px] font-normal text-[#94A3B8]">({remaining} left)</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={remaining}
                    placeholder={String(remaining)}
                    value={allocatedSessions}
                    onChange={e => setAllocated(e.target.value)}
                    className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F]"
                  />
                  {allocatedSessions !== '' && Number(allocatedSessions) > 0 && (
                    <p className="mt-0.5 text-[10px] text-[#64748B]">
                      Will teach sessions {fromSession}–{fromSession + Number(allocatedSessions) - 1}
                    </p>
                  )}
                </div>
              </div>
            )
          )}
          {error && <p className="text-[12px] text-[#EF4444]">{error}</p>}
        </div>

        <div className="shrink-0 border-t border-[#E2E8F0] p-4 flex gap-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button onClick={onClose} className="flex-1 rounded-lg border border-[#E2E8F0] py-2.5 text-[13px] text-[#64748B] hover:bg-[#F8FAFC] transition">Cancel</button>
          <button
            onClick={handleAssign}
            disabled={isPending || !groupId}
            className="flex-1 rounded-lg bg-[#FF8A1F] py-2.5 text-[13px] font-semibold text-white hover:bg-[#e87c18] disabled:opacity-50 transition"
          >
            {isPending ? 'Assigning…' : 'Assign Group'}
          </button>
        </div>
      </div>
    </div>
  )
}
