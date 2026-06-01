'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  deactivateTeamLeader,
  enableTeamLeader,
  archiveTeamLeader,
  transferTeamLeaderOwnership,
  deleteTeamLeader,
} from '@/modules/team-leaders/actions'

interface OtherTL {
  userId:     string
  name:       string
  branchName: string
}

interface Props {
  userId:       string
  status:       'active' | 'inactive'
  branchIds:    string[]
  responsibilities: {
    leadCount:    number
    groupCount:   number
    studentCount: number
  }
  otherTLs:     OtherTL[]
}

export default function TLActionButtons({
  userId, status, branchIds, responsibilities, otherTLs,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [showTransfer, setShowTransfer] = useState(false)
  const [showDelete,   setShowDelete]   = useState(false)
  const [transferTo,   setTransferTo]   = useState('')
  const [deleteTo,     setDeleteTo]     = useState('')
  const [message,      setMessage]      = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()

  const run = (fn: () => Promise<void>) => {
    startTransition(async () => {
      setMessage(null)
      try { await fn() } catch (e: any) { setMessage({ type: 'error', text: e?.message ?? 'Unexpected error.' }) }
    })
  }

  const handleEnable = () => {
    if (!confirm('Re-activate this team leader and restore portal access?')) return
    run(async () => {
      const res = await enableTeamLeader(userId, branchIds)
      if (!res.success) setMessage({ type: 'error', text: res.error.message })
    })
  }

  const handleDeactivate = () => {
    if (!confirm('Deactivate this team leader? They lose portal access immediately.')) return
    run(async () => {
      const res = await deactivateTeamLeader(userId)
      if (!res.success) setMessage({ type: 'error', text: res.error.message })
    })
  }

  const handleArchive = () => {
    if (!confirm('Archive this team leader? They will be flagged as archived and lose portal access permanently.')) return
    run(async () => {
      const res = await archiveTeamLeader(userId)
      if (!res.success) setMessage({ type: 'error', text: res.error.message })
    })
  }

  const handleTransfer = () => {
    if (!transferTo) { setMessage({ type: 'error', text: 'Select a team leader.' }); return }
    if (!confirm(`Transfer ${responsibilities.leadCount} active lead(s) to the selected TL?`)) return
    run(async () => {
      const res = await transferTeamLeaderOwnership(userId, transferTo)
      if (res.success) {
        setMessage({ type: 'success', text: `${(res.data as any).transferred} lead(s) transferred.` })
        setShowTransfer(false)
      } else {
        setMessage({ type: 'error', text: res.error.message })
      }
    })
  }

  const handleDelete = () => {
    const hasLeads = responsibilities.leadCount > 0
    const confirmMsg = hasLeads
      ? `Delete this team leader permanently?\n\n${responsibilities.leadCount} active lead(s) will be ${deleteTo ? 'transferred to the selected TL' : 'left unassigned'}.\n\nStudents and groups in their branches are NOT affected.`
      : `Delete this team leader permanently? This cannot be undone.\n\nStudents and groups are NOT affected.`
    if (!confirm(confirmMsg)) return
    run(async () => {
      const res = await deleteTeamLeader(userId, deleteTo || undefined)
      if (res.success) {
        router.push('/admin/team-leaders')
      } else {
        setMessage({ type: 'error', text: res.error.message })
      }
    })
  }

  const btnBase = 'rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-50'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {status === 'active' ? (
          <button onClick={handleDeactivate} disabled={isPending}
            className={`${btnBase} border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`}>
            Deactivate
          </button>
        ) : (
          <button onClick={handleEnable} disabled={isPending || branchIds.length === 0}
            title={branchIds.length === 0 ? 'Edit branches first' : ''}
            className={`${btnBase} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>
            Enable
          </button>
        )}

        {responsibilities.leadCount > 0 && (
          <button onClick={() => { setShowTransfer(v => !v); setShowDelete(false) }} disabled={isPending}
            className={`${btnBase} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}>
            Transfer Leads ({responsibilities.leadCount})
          </button>
        )}

        <button onClick={() => { setShowDelete(v => !v); setShowTransfer(false) }} disabled={isPending}
          className={`${btnBase} border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}>
          Delete
        </button>

        <button onClick={handleArchive} disabled={isPending}
          className={`${btnBase} border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100`}>
          Archive
        </button>
      </div>

      {/* Transfer panel */}
      {showTransfer && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-800">Transfer Lead Ownership</p>
          <p className="text-xs text-blue-600">
            Reassign {responsibilities.leadCount} active lead(s) to another team leader.
          </p>
          <div className="flex items-center gap-2">
            <select value={transferTo} onChange={e => setTransferTo(e.target.value)}
              className="flex-1 rounded border border-blue-200 bg-white px-2 py-1.5 text-sm">
              <option value="">Select team leader…</option>
              {otherTLs.map(tl => (
                <option key={tl.userId} value={tl.userId}>{tl.name} — {tl.branchName}</option>
              ))}
            </select>
            <button onClick={handleTransfer} disabled={isPending || !transferTo}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              Transfer
            </button>
            <button onClick={() => setShowTransfer(false)} className="text-xs text-blue-500 hover:underline">Cancel</button>
          </div>
        </div>
      )}

      {/* Delete panel */}
      {showDelete && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-red-800">Permanently Delete Team Leader</p>
          <div className="rounded-lg bg-white p-3 text-xs space-y-1">
            <p className="text-[#64748B]">This action cannot be undone. The following will happen:</p>
            <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[#0B1F3A]">
              <li>Team leader role removed</li>
              <li>Portal access revoked permanently</li>
              {responsibilities.leadCount > 0 && (
                <li className="text-amber-700">{responsibilities.leadCount} active lead(s) will be {deleteTo ? 'transferred' : 'left unassigned'}</li>
              )}
              <li className="text-emerald-700">Students, groups, certificates — NOT affected</li>
            </ul>
          </div>

          {responsibilities.leadCount > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-red-700">Transfer active leads to (optional):</p>
              <select value={deleteTo} onChange={e => setDeleteTo(e.target.value)}
                className="w-full rounded border border-red-200 bg-white px-2 py-1.5 text-sm">
                <option value="">Leave leads unassigned</option>
                {otherTLs.map(tl => (
                  <option key={tl.userId} value={tl.userId}>{tl.name} — {tl.branchName}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={handleDelete} disabled={isPending}
              className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {isPending ? 'Deleting…' : 'Confirm Delete'}
            </button>
            <button onClick={() => setShowDelete(false)} className="text-xs text-red-500 hover:underline">Cancel</button>
          </div>
        </div>
      )}

      {message && (
        <p className={`text-xs font-medium ${message.type === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
      {isPending && <p className="text-xs text-[#94A3B8]">Processing…</p>}
    </div>
  )
}
