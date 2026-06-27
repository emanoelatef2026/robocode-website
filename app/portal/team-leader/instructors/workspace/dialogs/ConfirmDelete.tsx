'use client'

import { useState } from 'react'

export function ConfirmDelete({
  name, instructorCode, branchNames, groupCount, studentCount,
  activeGroupCount, futureSessionCount,
  onConfirm, onCancel, onArchiveInstead, isPending,
}: {
  name:               string
  instructorCode:     string | null
  branchNames:        string[]
  groupCount:         number
  studentCount:       number
  activeGroupCount:   number
  futureSessionCount: number
  onConfirm:          () => void
  onCancel:           () => void
  onArchiveInstead:   () => void
  isPending:          boolean
}) {
  const [confirmText, setConfirmText] = useState('')
  const isBlocked  = activeGroupCount > 0 || futureSessionCount > 0
  const canConfirm = !isBlocked && confirmText === 'DELETE' && !isPending

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="border-b border-[#FEE2E2] bg-[#FEE2E2] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FEE2E2]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-[#EF4444]">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0B1F3A]">Delete Instructor</h2>
              <p className="text-[12px] text-[#EF4444]">This action cannot be undone</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold text-[#0B1F3A]">{name}</p>
              {instructorCode && (
                <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-[10px] text-[#94A3B8]">{instructorCode}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {branchNames.map(b => (
                <span key={b} className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] text-[#64748B]">{b}</span>
              ))}
            </div>
            <div className="flex gap-4 text-[11px] text-[#64748B]">
              <span><strong className="text-[#0B1F3A]">{groupCount}</strong> groups</span>
              <span><strong className="text-[#0B1F3A]">{studentCount}</strong> students affected</span>
            </div>
          </div>

          {isBlocked ? (
            <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 space-y-1.5">
              <p className="text-[12px] font-semibold text-[#92400E]">Cannot delete — active obligations remain:</p>
              {activeGroupCount > 0 && (
                <p className="text-[12px] text-[#B45309]">• {activeGroupCount} active group(s) still assigned</p>
              )}
              {futureSessionCount > 0 && (
                <p className="text-[12px] text-[#B45309]">• {futureSessionCount} upcoming session(s) scheduled</p>
              )}
              <p className="mt-1 text-[11px] text-[#F59E0B]">Remove from active groups and cancel upcoming sessions first, or archive to preserve the record.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-[#FEE2E2] bg-[#FEE2E2] p-3">
                <p className="text-[12px] text-[#DC2626]">
                  This permanently removes the instructor and operational history links. The auth account will be disabled. Audit data is preserved.
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">
                  Type <strong className="font-mono text-[#EF4444]">DELETE</strong> to confirm
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  autoFocus
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 font-mono text-[13px] outline-none focus:border-[#F87171] transition"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 border-t border-[#E2E8F0] px-6 py-4">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] text-[#64748B] hover:bg-[#F8FAFC] transition">
            Cancel
          </button>
          {isBlocked ? (
            <button onClick={onArchiveInstead} className="flex-1 rounded-lg bg-[#F59E0B] py-2 text-[13px] font-semibold text-white hover:bg-[#D97706] transition">
              Archive Instead
            </button>
          ) : (
            <button
              onClick={onConfirm}
              disabled={!canConfirm}
              className="flex-1 rounded-lg border border-red-500 bg-white py-2 text-[13px] font-semibold text-[#EF4444] hover:bg-[#DC2626] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {isPending ? 'Deleting…' : 'Delete Permanently'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
