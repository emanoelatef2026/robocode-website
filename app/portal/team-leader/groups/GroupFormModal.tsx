'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { createGroupModal, updateGroupModal } from '@/modules/groups/modal-actions'
import type { GroupOperationalRow, GroupFormOptions, GroupStudentOption } from '@/modules/groups/operational'
import type { ActionResult } from '@/types/app'
import {
  getGroupAllocationsAction,
  addGroupAllocationAction,
  updateGroupAllocationAction,
  removeGroupAllocationAction,
  editGroupAllocationRangeAction,
} from '@/modules/groups/allocation-actions'
import type { AllocationRow, GroupAllocationContext } from '@/modules/groups/allocation-actions'

// ── Types ──────────────────────────────────────────────────────────────────────

interface StudentLink {
  _key:               string
  student_id:         string
  student_name:       string
  student_code:       string | null
  branch_name:        string
  age:                number | null
  phone:              string | null
  parent_phone:       string | null
  attendance_pct:     number | null
  sessions_remaining: number | null
}

interface Props {
  isOpen:          boolean
  mode:            'create' | 'edit'
  group?:          GroupOperationalRow
  options:         GroupFormOptions
  studentOptions:  GroupStudentOption[]
  defaultBranchId?: string
  onClose:         () => void
  onSuccess:       (id: string) => void
}

const DAYS = [
  { value: 'sunday',    label: 'Sunday'    },
  { value: 'monday',    label: 'Monday'    },
  { value: 'tuesday',   label: 'Tuesday'   },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday',  label: 'Thursday'  },
  { value: 'friday',    label: 'Friday'    },
  { value: 'saturday',  label: 'Saturday'  },
]

const TYPES = [
  { value: 'class',     label: 'Class'     },
  { value: 'workshop',  label: 'Workshop'  },
  { value: 'bootcamp',  label: 'Bootcamp'  },
  { value: 'trial',     label: 'Trial'     },
  { value: 'makeup',    label: 'Makeup'    },
]

const STATUSES = ['forming','active','completed','cancelled']

function normalizeEgyptianPhone(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.startsWith('002') && digits.length >= 13) return '0' + digits.slice(3)
  if (digits.startsWith('20')  && digits.length >= 12) return '0' + digits.slice(2)
  return digits
}

function phoneMatch(query: string, phone: string | null | undefined): boolean {
  if (!phone || !query) return false
  const qNorm = normalizeEgyptianPhone(query)
  const pNorm = normalizeEgyptianPhone(phone)
  return qNorm.length >= 4 && pNorm.includes(qNorm)
}

function attColor(pct: number | null): string {
  if (pct == null) return 'text-[#94A3B8]'
  return pct >= 75 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-500'
}

function sessColor(rem: number | null): string {
  if (rem == null) return 'text-[#64748B]'
  return rem <= 2 ? 'text-red-500' : 'text-[#64748B]'
}

// ── Allocation status chip ─────────────────────────────────────────────────────

function AllocStatusChip({ status }: { status: string }) {
  const cls =
    status === 'active'    ? 'bg-green-100 text-green-700'   :
    status === 'completed' ? 'bg-slate-100 text-slate-500'   :
    status === 'released'  ? 'bg-red-100 text-red-600'       :
                             'bg-gray-100 text-gray-500'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>
      {status}
    </span>
  )
}

// ── Timeline bar ───────────────────────────────────────────────────────────────

function AllocationTimeline({
  allocations,
  totalSessions,
}: {
  allocations:   AllocationRow[]
  totalSessions: number | null
}) {
  if (!allocations.length) return null

  const ceiling = totalSessions ?? Math.max(...allocations.map(a => a.to_session ?? a.from_session))
  if (ceiling <= 0) return null

  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-[10px] text-[#94A3B8]">
        <span>1</span>
        <span>Session {ceiling}</span>
      </div>
      <div className="relative h-5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
        {allocations.map(a => {
          const from   = a.from_session
          const to     = a.to_session ?? ceiling
          const left   = ((from - 1) / ceiling) * 100
          const width  = ((to - from + 1) / ceiling) * 100
          const bgCls  =
            a.allocation_status === 'active'    ? 'bg-green-400'  :
            a.allocation_status === 'completed' ? 'bg-slate-400'  :
            a.allocation_status === 'released'  ? 'bg-red-300'    :
                                                  'bg-blue-300'
          return (
            <div
              key={a.instructor_id}
              title={`${a.instructor_name}: sessions ${from}–${to}`}
              className={`absolute top-0 h-full ${bgCls} opacity-80`}
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          )
        })}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {allocations.map(a => {
          const dotCls =
            a.allocation_status === 'active'    ? 'bg-green-400'  :
            a.allocation_status === 'completed' ? 'bg-slate-400'  :
            a.allocation_status === 'released'  ? 'bg-red-300'    :
                                                  'bg-blue-300'
          return (
            <span key={a.instructor_id} className="flex items-center gap-1 text-[10px] text-[#64748B]">
              <span className={`inline-block h-2 w-2 rounded-full ${dotCls}`} />
              {a.instructor_name} ({a.from_session}–{a.to_session ?? '∞'})
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Lock state badge ───────────────────────────────────────────────────────────

function LockStateBadge({ alloc }: { alloc: AllocationRow }) {
  if (alloc.lock_state === 'unlocked') return null

  if (alloc.lock_state === 'fully_locked') {
    return (
      <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
        Fully Locked
      </span>
    )
  }

  // partially_locked
  const editableFrom = alloc.highest_consumed_session + 1
  const editableTo   = alloc.to_session ?? '∞'
  return (
    <span
      className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700"
      title={`Sessions ${alloc.from_session}–${alloc.highest_consumed_session} are immutable. Sessions ${editableFrom}–${editableTo} are editable.`}
    >
      Consumed through {alloc.highest_consumed_session} · Editable: {editableFrom}–{editableTo}
    </span>
  )
}

// ── Single allocation row ──────────────────────────────────────────────────────

function AllocationRowCard({
  alloc,
  groupId,
  totalSessions,
  onChanged,
}: {
  alloc:          AllocationRow
  groupId:        string
  totalSessions:  number | null
  onChanged:      () => void
}) {
  const [, start]       = useTransition()
  const [editing, setEditing]           = useState(false)
  const [editingRange, setEditingRange] = useState(false)
  const [status, setStatus]             = useState(alloc.allocation_status)
  const [notes, setNotes]               = useState(alloc.handoff_notes ?? '')
  const [rangeSessions, setRangeSessions] = useState(
    alloc.allocated_sessions != null ? String(alloc.allocated_sessions) : ''
  )
  const [error, setError]   = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  const rangeNum    = parseInt(rangeSessions, 10)
  const newToSess   = rangeSessions && !isNaN(rangeNum) && rangeNum > 0
    ? alloc.from_session + rangeNum - 1
    : null

  // Min sessions = enough to cover highest consumed (must not go below boundary)
  const minSessions = alloc.highest_consumed_session > 0
    ? alloc.highest_consumed_session - alloc.from_session + 1
    : 1

  const rangeOverTotal  = totalSessions !== null && newToSess !== null && newToSess > totalSessions
  const rangeBelowMin   = newToSess !== null && newToSess < alloc.highest_consumed_session
  const rangeInvalid    = rangeOverTotal || rangeBelowMin || (rangeSessions !== '' && (isNaN(rangeNum) || rangeNum < minSessions))

  function handleSave() {
    setError(null)
    start(async () => {
      const res = await updateGroupAllocationAction(groupId, alloc.instructor_id, status, notes || undefined)
      if (!res.success) { setError(res.error.message); return }
      setEditing(false)
      onChanged()
    })
  }

  function handleSaveRange() {
    if (!rangeSessions || isNaN(rangeNum) || rangeNum < minSessions) {
      setError(`Minimum ${minSessions} session${minSessions !== 1 ? 's' : ''} required (covers consumed sessions).`)
      return
    }
    setError(null)
    start(async () => {
      const res = await editGroupAllocationRangeAction(groupId, alloc.instructor_id, rangeNum)
      if (!res.success) { setError(res.error.message); return }
      setEditingRange(false)
      onChanged()
    })
  }

  function handleRemove() {
    setError(null)
    start(async () => {
      const res = await removeGroupAllocationAction(groupId, alloc.instructor_id)
      if (!res.success) { setError(res.error.message); setRemoving(false); return }
      onChanged()
    })
  }

  const range = alloc.to_session
    ? `Sessions ${alloc.from_session}–${alloc.to_session}`
    : `From session ${alloc.from_session}`

  const canEditRange = alloc.lock_state !== 'fully_locked'
    && alloc.allocation_status !== 'released'
    && alloc.allocation_status !== 'completed'

  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-[#0B1F3A]">{alloc.instructor_name}</span>
            <AllocStatusChip status={alloc.allocation_status} />
            <LockStateBadge alloc={alloc} />
          </div>
          <div className="text-[11px] text-[#64748B]">{range}</div>
          {alloc.sessions_completed > 0 && (
            <div className="text-[11px] text-[#94A3B8]">
              {alloc.sessions_completed} session{alloc.sessions_completed !== 1 ? 's' : ''} completed
            </div>
          )}
          {alloc.handoff_notes && !editing && (
            <div className="text-[11px] text-[#94A3B8] italic">{alloc.handoff_notes}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Edit range — available when not fully locked / released / completed */}
          {canEditRange && (
            <button
              type="button"
              onClick={() => { setEditingRange(prev => !prev); setEditing(false); setError(null) }}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#374151] transition"
              title="Edit session range"
            >
              Range
            </button>
          )}
          {/* Edit status / notes */}
          <button
            type="button"
            onClick={() => { setEditing(prev => !prev); setEditingRange(false); setError(null) }}
            className="rounded p-1 text-[#94A3B8] hover:bg-[#E2E8F0] hover:text-[#374151] transition"
            title="Edit status / notes"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l.581.564a1.75 1.75 0 0 1 0 2.474L5.944 12.59a.25.25 0 0 1-.177.073H3.25a.25.25 0 0 1-.25-.25V9.85a.25.25 0 0 1 .073-.177z" />
            </svg>
          </button>
          {/* Remove — only when fully unlocked */}
          {alloc.lock_state === 'unlocked' && (
            removing ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleRemove}
                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-50 transition"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setRemoving(false)}
                  className="rounded px-1.5 py-0.5 text-[10px] text-[#94A3B8] hover:bg-[#E2E8F0] transition"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setRemoving(true)}
                className="rounded p-1 text-[#94A3B8] hover:bg-red-50 hover:text-red-500 transition"
                title="Remove allocation"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Range-editing panel ─────────────────────────────────────── */}
      {editingRange && (
        <div className="mt-2 space-y-2 border-t border-[#E2E8F0] pt-2">
          <p className="text-[11px] font-semibold text-[#374151]">Edit Future Ownership</p>
          {alloc.lock_state === 'partially_locked' && (
            <p className="text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1">
              Sessions {alloc.from_session}–{alloc.highest_consumed_session} are immutable (already consumed).
              You are editing from session {alloc.highest_consumed_session + 1} onward.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#374151]">From Session</label>
              <div className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#0B1F3A]">
                {alloc.from_session}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#374151]">
                Sessions to Teach
                <span className="ml-1 text-[#94A3B8]">(min {minSessions})</span>
              </label>
              <input
                type="number"
                min={minSessions}
                max={totalSessions != null ? totalSessions - alloc.from_session + 1 : undefined}
                value={rangeSessions}
                onChange={e => { setRangeSessions(e.target.value); setError(null) }}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] outline-none focus:border-[#FF8A1F]"
              />
            </div>
          </div>
          {newToSess !== null && !rangeInvalid && (
            <p className="text-[11px] font-medium text-[#FF8A1F]">
              Will own: Sessions {alloc.from_session}–{newToSess}
              {alloc.to_session && newToSess < alloc.to_session && (
                <span className="ml-2 text-[#94A3B8]">(reduced from {alloc.to_session})</span>
              )}
              {alloc.to_session && newToSess > alloc.to_session && (
                <span className="ml-2 text-[#94A3B8]">(extended from {alloc.to_session})</span>
              )}
            </p>
          )}
          {rangeBelowMin && (
            <p className="text-[11px] text-red-600">
              Cannot reduce below consumed session {alloc.highest_consumed_session}.
            </p>
          )}
          {rangeOverTotal && totalSessions !== null && (
            <p className="text-[11px] text-red-600">
              Exceeds group planned sessions ({totalSessions}).
            </p>
          )}
          {error && <p className="text-[11px] text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveRange}
              disabled={!rangeSessions || rangeInvalid}
              className="rounded-lg bg-[#FF8A1F] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#e87c18] transition disabled:opacity-50"
            >
              Save Range
            </button>
            <button
              type="button"
              onClick={() => { setEditingRange(false); setRangeSessions(alloc.allocated_sessions != null ? String(alloc.allocated_sessions) : ''); setError(null) }}
              className="rounded-lg border border-[#E2E8F0] px-3 py-1 text-[11px] text-[#374151] hover:bg-[#F8FAFC] transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Status / notes editing panel ────────────────────────────── */}
      {editing && (
        <div className="mt-2 space-y-2 border-t border-[#E2E8F0] pt-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#374151]">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] outline-none focus:border-[#FF8A1F]"
            >
              <option value="active">active</option>
              <option value="completed">completed</option>
              <option value="released">released</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#374151]">Handoff notes</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional handoff note…"
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] outline-none focus:border-[#FF8A1F]"
            />
          </div>
          {error && <p className="text-[11px] text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-[#FF8A1F] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#e87c18] transition"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setStatus(alloc.allocation_status); setNotes(alloc.handoff_notes ?? ''); setError(null) }}
              className="rounded-lg border border-[#E2E8F0] px-3 py-1 text-[11px] text-[#374151] hover:bg-[#F8FAFC] transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Add allocation form ────────────────────────────────────────────────────────

function AddAllocationForm({
  groupId,
  ctx,
  instructors,
  onDone,
  onCancel,
}: {
  groupId:     string
  ctx:         GroupAllocationContext
  instructors: { id: string; name: string }[]
  onDone:      () => void
  onCancel:    () => void
}) {
  const [, start]           = useTransition()
  const [instrId, setInstrId]   = useState('')
  const [sessions, setSessions] = useState('')
  const [notes, setNotes]       = useState('')
  const [error, setError]       = useState<string | null>(null)

  const existing     = new Set(ctx.allocations.map(a => a.instructor_id))
  const available    = instructors.filter(i => !existing.has(i.id))
  const fromSession  = ctx.next_from_session
  const sessNum      = parseInt(sessions, 10)
  const toSession    = sessions && !isNaN(sessNum) && sessNum > 0 ? fromSession + sessNum - 1 : null
  const remaining    = !ctx.open_ended && ctx.total_sessions != null ? ctx.total_sessions - fromSession + 1 : null
  const overLimit    = !ctx.open_ended && remaining != null && toSession != null && toSession > (ctx.total_sessions ?? Infinity)

  function handleAdd() {
    if (!instrId) { setError('Select an instructor.'); return }
    setError(null)
    const numSess = sessions && !isNaN(parseInt(sessions, 10)) ? parseInt(sessions, 10) : null
    start(async () => {
      const res = await addGroupAllocationAction(groupId, instrId, numSess, notes || undefined)
      if (!res.success) { setError(res.error.message); return }
      onDone()
    })
  }

  return (
    <div className="rounded-lg border border-[#FF8A1F]/30 bg-[#FFF7ED] px-3 py-3 space-y-2.5">
      <p className="text-[11px] font-semibold text-[#FF8A1F]">New Instructor Allocation</p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-[#374151]">Instructor</label>
          {available.length === 0 ? (
            <p className="text-[11px] text-[#94A3B8]">All available instructors are already allocated.</p>
          ) : (
            <select
              value={instrId}
              onChange={e => setInstrId(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] outline-none focus:border-[#FF8A1F]"
            >
              <option value="">— Select instructor —</option>
              {available.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          )}
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#374151]">
            From Session
            <span className="ml-1 text-[#94A3B8]">(computed)</span>
          </label>
          <div className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#0B1F3A]">
            {fromSession}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#374151]">
            Sessions to Teach
            {remaining != null && (
              <span className="ml-1 text-[#94A3B8]">(max {remaining})</span>
            )}
            {ctx.open_ended && (
              <span className="ml-1 text-[#94A3B8]">(open-ended group)</span>
            )}
          </label>
          <input
            type="number"
            min={1}
            max={remaining ?? undefined}
            value={sessions}
            onChange={e => setSessions(e.target.value)}
            placeholder={ctx.open_ended ? 'Leave blank for unlimited' : (ctx.total_sessions != null ? `Max ${remaining}` : 'Leave blank for unlimited')}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] outline-none focus:border-[#FF8A1F]"
          />
        </div>
      </div>

      {toSession != null && (
        <p className={`text-[11px] font-medium ${overLimit ? 'text-red-500' : 'text-[#FF8A1F]'}`}>
          {overLimit
            ? `Exceeds planned sessions (${ctx.total_sessions}). Max ${remaining} session${remaining !== 1 ? 's' : ''}.`
            : `Will teach sessions ${fromSession}–${toSession}`
          }
        </p>
      )}

      <div>
        <label className="mb-1 block text-[11px] font-medium text-[#374151]">Handoff notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes for the next instructor…"
          className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[12px] text-[#0B1F3A] outline-none focus:border-[#FF8A1F]"
        />
      </div>

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!instrId || overLimit}
          className="rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#e87c18] transition disabled:opacity-50"
        >
          Add Allocation
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[11px] text-[#374151] hover:bg-white transition"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Instructor Allocations Section (edit mode only) ───────────────────────────

function InstructorAllocationsSection({
  groupId,
  instructors,
}: {
  groupId:     string
  instructors: { id: string; name: string }[]
}) {
  const [ctx, setCtx]             = useState<GroupAllocationContext | null>(null)
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    getGroupAllocationsAction(groupId).then(res => {
      if (res.success) setCtx(res.data)
      setLoading(false)
    })
  }, [groupId, refreshKey])

  function refresh() { setRefreshKey(k => k + 1); setShowAdd(false) }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-[12px] text-[#94A3B8]">
        <div className="h-3.5 w-3.5 animate-spin rounded-full border border-[#FF8A1F] border-t-transparent" />
        Loading allocations…
      </div>
    )
  }

  const allocs = ctx?.allocations ?? []

  return (
    <div className="space-y-2.5">
      {allocs.length === 0 && !showAdd && (
        <p className="rounded-lg bg-[#F8FAFC] px-3 py-2.5 text-[12px] text-[#94A3B8]">
          No instructor allocations yet. Add one below.
        </p>
      )}

      {allocs.map(a => (
        <AllocationRowCard
          key={a.instructor_id}
          alloc={a}
          groupId={groupId}
          totalSessions={ctx?.total_sessions ?? null}
          onChanged={refresh}
        />
      ))}

      {ctx && <AllocationTimeline allocations={allocs} totalSessions={ctx.total_sessions} />}

      {showAdd && ctx ? (
        <AddAllocationForm
          groupId={groupId}
          ctx={ctx}
          instructors={instructors}
          onDone={refresh}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-[#FF8A1F]/40 px-3 py-2 text-[12px] font-medium text-[#FF8A1F] hover:border-[#FF8A1F] hover:bg-[#FFF7ED] transition w-full"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Instructor Allocation
        </button>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function GroupFormModal({
  isOpen, mode, group, options, studentOptions, defaultBranchId, onClose, onSuccess,
}: Props) {
  const action = mode === 'create' ? createGroupModal : updateGroupModal
  const [state, dispatch, pending] = useActionState<ActionResult<{ id: string }> | null, FormData>(action as any, null)

  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [plannedSessions, setPlannedSessions]   = useState('')
  const [openEnded, setOpenEnded]               = useState(false)

  // Create-mode only: initial instructor (for first allocation)
  const [initInstrId, setInitInstrId] = useState('')

  // Student allocation state
  const [links, setLinks]           = useState<StudentLink[]>([])
  const [toRemove, setToRemove]     = useState<string[]>([])
  const [pickerQ, setPickerQ]       = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [pickerBranch, setPickerBranch]     = useState('')
  const [pickerHasGroup, setPickerHasGroup] = useState<'' | 'has' | 'none'>('')

  const pickerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setSelectedBranchId(group?.branch_id ?? defaultBranchId ?? options.branches[0]?.id ?? '')
    setSelectedCourseId(group?.course_id ?? '')
    setPlannedSessions(group?.planned_sessions != null ? String(group.planned_sessions) : '')
    setOpenEnded(group?.open_ended ?? false)
    setInitInstrId(group?.lead_instructor_id ?? '')

    if (mode === 'edit' && group) {
      const optMap = new Map(studentOptions.map(s => [s.student_id, s]))
      setLinks(
        (group.enrolled_students ?? []).map(s => {
          const opt = optMap.get(s.student_id)
          return {
            _key:               s.student_id,
            student_id:         s.student_id,
            student_name:       s.student_name,
            student_code:       s.student_code,
            branch_name:        opt?.branch_name ?? group.branch_name,
            age:                opt?.age          ?? null,
            phone:              opt?.phone         ?? null,
            parent_phone:       opt?.parent_phone  ?? null,
            attendance_pct:     opt?.attendance_pct     ?? null,
            sessions_remaining: opt?.sessions_remaining ?? null,
          }
        })
      )
    } else {
      setLinks([])
    }
    setToRemove([])
    setPickerQ('')
    setShowPicker(false)
    setPickerBranch('')
    setPickerHasGroup('')
  }, [isOpen, mode, group, studentOptions])

  useEffect(() => {
    if (state?.success) onSuccess(state.data.id)
  }, [state])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (showPicker) { setShowPicker(false); return }
      onClose()
    }
    if (isOpen) document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [isOpen, showPicker, onClose])

  if (!isOpen) return null

  const linkedIds  = new Set(links.map(l => l.student_id))
  const filtered   = studentOptions.filter(s => {
    if (linkedIds.has(s.student_id)) return false
    if (pickerBranch && s.branch_id !== pickerBranch) return false
    if (pickerHasGroup === 'has'  && !s.group_name) return false
    if (pickerHasGroup === 'none' &&  s.group_name) return false
    const q = pickerQ.toLowerCase().trim()
    if (!q) return true
    if (phoneMatch(pickerQ, s.phone))        return true
    if (phoneMatch(pickerQ, s.parent_phone)) return true
    return s.student_name.toLowerCase().includes(q) || (s.student_code ?? '').toLowerCase().includes(q)
  }).slice(0, 40)

  function addStudent(s: GroupStudentOption) {
    setLinks(prev => {
      if (prev.some(l => l.student_id === s.student_id)) return prev
      return [...prev, {
        _key: s.student_id, student_id: s.student_id,
        student_name: s.student_name, student_code: s.student_code,
        branch_name: s.branch_name, age: s.age, phone: s.phone,
        parent_phone: s.parent_phone, attendance_pct: s.attendance_pct,
        sessions_remaining: s.sessions_remaining,
      }]
    })
    setPickerQ('')
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  function removeLink(studentId: string) {
    setLinks(prev => prev.filter(l => l.student_id !== studentId))
    if (mode === 'edit' && group?.enrolled_students.some(s => s.student_id === studentId)) {
      setToRemove(prev => [...prev, studentId])
    }
  }

  const originalIds   = new Set((group?.enrolled_students ?? []).map(s => s.student_id))
  const studentsToAdd = links.filter(l => !originalIds.has(l.student_id)).map(l => l.student_id)
  const addJson       = JSON.stringify(studentsToAdd)
  const removeJson    = JSON.stringify(toRemove)

  const name        = group?.name                  ?? ''
  const type        = group?.type                  ?? 'class'
  const status      = group?.status                ?? 'forming'
  const capacity    = group?.capacity              ?? ''
  const dayOfWeek   = group?.day_of_week           ?? ''
  const startTime   = group?.start_time            ?? ''
  const durationMin = group?.duration_minutes      ?? ''
  const startDate   = group?.start_date            ?? ''
  const endDate     = group?.end_date              ?? ''
  const meetingLink = group?.meeting_link          ?? ''
  const notes       = group?.notes                 ?? ''
  const sharePercent = group?.robocode_share_percent ?? 100

  const selectedCourse       = options.courses.find(c => c.id === selectedCourseId)
  const courseRecommendation = selectedCourse?.recommended_sessions ?? null

  const title = mode === 'create' ? 'New Group' : `Edit: ${group?.name}`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E2E8F0] bg-white px-5 py-4">
          <h2 className="text-base font-semibold text-[#0B1F3A]">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0B1F3A] transition">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>

        <form action={dispatch} className="px-5 py-4 space-y-5">
          {mode === 'edit' && <input type="hidden" name="id" value={group?.group_id} />}
          <input type="hidden" name="students_to_add_json"    value={addJson} />
          <input type="hidden" name="students_to_remove_json" value={removeJson} />

          {/* ── Basic Info ─────────────────────────────────────────────────── */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Basic Info</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Name <span className="text-red-500">*</span></label>
                <input name="name" defaultValue={name} required
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
                  placeholder="e.g. Scratch Beginners – Batch 3" />
              </div>

              {options.branches.length === 1 ? (
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Branch</label>
                  <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#374151]">
                    {options.branches[0].name}
                  </div>
                  <input type="hidden" name="branch_id" value={options.branches[0].id} />
                </div>
              ) : (
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Branch <span className="text-red-500">*</span></label>
                  <select
                    name="branch_id"
                    value={selectedBranchId}
                    onChange={e => setSelectedBranchId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
                  >
                    <option value="">— Select branch —</option>
                    {options.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Type <span className="text-red-500">*</span></label>
                <select name="type" defaultValue={type}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20">
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Max Capacity</label>
                <input name="capacity" type="number" min={1} max={500} defaultValue={capacity as string}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
                  placeholder="Optional" />
              </div>

              {mode === 'edit' && (
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Status</label>
                  <select name="status" defaultValue={status}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20">
                    {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              )}

              <div className={mode === 'edit' ? '' : 'sm:col-span-2'}>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Notes</label>
                <textarea name="notes" defaultValue={notes} rows={2}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20 resize-none"
                  placeholder="Optional notes…" />
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">
                  Robocode Share %
                  <span className="ml-1.5 text-[11px] font-normal text-[#94A3B8]">0–100 · default 100</span>
                </label>
                <input
                  name="robocode_share_percent"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  defaultValue={sharePercent}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
                  placeholder="100"
                />
                <p className="mt-1 text-[11px] text-[#94A3B8]">
                  % of collected revenue that belongs to Robocode. Use 100 for standard groups; set lower for partnership groups.
                </p>
              </div>
            </div>
          </section>

          {/* ── Course & Instructor ───────────────────────────────────────── */}
          <section className="border-t border-[#F1F5F9] pt-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              {mode === 'create' ? 'Course & Instructor' : 'Course'}
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className={mode === 'edit' ? 'sm:col-span-2' : ''}>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Course</label>
                <select
                  name="course_id"
                  value={selectedCourseId}
                  onChange={e => setSelectedCourseId(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
                >
                  <option value="">— No course —</option>
                  {options.courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>

              {/* Create mode only: initial instructor picker */}
              {mode === 'create' && (
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Initial Instructor</label>
                  <select
                    name="instructor_id"
                    value={initInstrId}
                    onChange={e => setInitInstrId(e.target.value)}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
                  >
                    <option value="">— No instructor yet —</option>
                    {options.instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <p className="mt-1 text-[11px] text-[#94A3B8]">Creates the initial allocation. More can be added after saving.</p>
                </div>
              )}
            </div>
          </section>

          {/* ── Academic Plan ──────────────────────────────────────────────── */}
          <section className="border-t border-[#F1F5F9] pt-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Academic Plan</h3>

            {/* Open-ended toggle */}
            <div className="mb-4 flex items-start gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={openEnded}
                onClick={() => {
                  setOpenEnded(prev => !prev)
                  if (!openEnded) setPlannedSessions('')
                }}
                className={[
                  'relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                  openEnded ? 'bg-[#FF8A1F]' : 'bg-[#CBD5E1]',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200',
                    openEnded ? 'translate-x-4' : 'translate-x-0',
                  ].join(' ')}
                />
              </button>
              <div>
                <p className="text-[13px] font-medium text-[#374151]">Open-ended Group</p>
                <p className="text-[11px] text-[#94A3B8]">No fixed session count — for clubs, mentorship, or subscription groups. Allocations can extend freely.</p>
              </div>
            </div>

            {/* Planned sessions — hidden when open-ended */}
            {!openEnded && (
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">
                  Planned Sessions
                  {courseRecommendation != null && (
                    <span className="ml-2 text-[11px] font-normal text-[#94A3B8]">
                      · Course recommends {courseRecommendation}
                    </span>
                  )}
                </label>
                <input
                  name="planned_sessions"
                  type="number"
                  min={1}
                  max={9999}
                  value={plannedSessions}
                  onChange={e => setPlannedSessions(e.target.value)}
                  placeholder={courseRecommendation != null ? `e.g. ${courseRecommendation}` : 'e.g. 12 for bootcamp, 24 for standard'}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
                />
                <p className="mt-1 text-[11px] text-[#94A3B8]">
                  Leave blank to set later. Instructor allocations cannot exceed this count.
                </p>
                {courseRecommendation != null && plannedSessions && parseInt(plannedSessions, 10) !== courseRecommendation && (
                  <p className="mt-1 text-[11px] text-amber-600">
                    {parseInt(plannedSessions, 10) < courseRecommendation
                      ? `${courseRecommendation - parseInt(plannedSessions, 10)} fewer than the course recommendation — this group is a compressed track.`
                      : `${parseInt(plannedSessions, 10) - courseRecommendation} more than the course recommendation — extended track.`
                    }
                  </p>
                )}
              </div>
            )}

            {openEnded && (
              <p className="rounded-lg bg-[#FFF7ED] px-3 py-2 text-[12px] text-[#FF8A1F]">
                Open-ended mode — allocations will extend dynamically with no session ceiling.
              </p>
            )}

            <input type="hidden" name="open_ended" value={openEnded ? 'true' : 'false'} />
          </section>

          {/* ── Instructor Allocations (edit mode only) ────────────────────── */}
          {mode === 'edit' && group && (
            <section className="border-t border-[#F1F5F9] pt-5">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Instructor Allocations</h3>
              <InstructorAllocationsSection
                groupId={group.group_id}
                instructors={options.instructors}
              />
            </section>
          )}

          {/* ── Schedule ─────────────────────────────────────────────────── */}
          <section className="border-t border-[#F1F5F9] pt-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Schedule</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Day</label>
                <select name="day_of_week" defaultValue={dayOfWeek}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20">
                  <option value="">—</option>
                  {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Start Time</label>
                <input name="start_time" type="time" defaultValue={startTime}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20" />
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Duration (min)</label>
                <input name="duration_minutes" type="number" min={15} max={480} defaultValue={durationMin as string}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
                  placeholder="90" />
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Start Date</label>
                <input name="start_date" type="date" defaultValue={startDate}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20" />
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">End Date</label>
                <input name="end_date" type="date" defaultValue={endDate}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20" />
              </div>

              <div className="col-span-2 sm:col-span-3">
                <label className="mb-1.5 block text-[13px] font-medium text-[#374151]">Meeting Link</label>
                <input name="meeting_link" type="url" defaultValue={meetingLink}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
                  placeholder="https://meet.google.com/…" />
              </div>
            </div>
          </section>

          {/* ── Students ─────────────────────────────────────────────────── */}
          <section className="border-t border-[#F1F5F9] pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Students</h3>
              <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-semibold text-[#64748B]">
                {links.length} linked
              </span>
            </div>

            {links.length > 0 && (
              <div className="mb-3 overflow-hidden rounded-lg border border-[#E2E8F0]">
                {/* Header row */}
                <div className="flex items-center gap-2 border-b border-[#E2E8F0] bg-[#F1F5F9] px-2 py-1">
                  <span className="w-6 shrink-0 text-center text-[10px] font-semibold text-[#94A3B8]">#</span>
                  <span className="flex-1 text-[10px] font-semibold text-[#94A3B8]">Name · Code · Age</span>
                  <span className="hidden w-28 shrink-0 text-[10px] font-semibold text-[#94A3B8] sm:block">Phone</span>
                  <span className="hidden w-28 shrink-0 text-[10px] font-semibold text-[#94A3B8] sm:block">Parent</span>
                  <span className="w-14 shrink-0 text-right text-[10px] font-semibold text-[#94A3B8]">Sess.</span>
                  <span className="w-5 shrink-0" />
                </div>
                {links.map((l, idx) => (
                  <div key={l._key} className="flex items-center gap-2 border-b border-[#E2E8F0] bg-white px-2 py-1.5 last:border-0 hover:bg-[#F8FAFC]">
                    <span className="w-6 shrink-0 text-center text-[11px] font-semibold text-[#94A3B8]">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-[12px] font-semibold text-[#0B1F3A]">{l.student_name}</span>
                      {l.student_code && <span className="ml-1.5 font-mono text-[11px] text-[#94A3B8]">{l.student_code}</span>}
                      {l.age != null && <span className="ml-1 text-[11px] text-[#64748B]">· {l.age}y</span>}
                      {l.attendance_pct != null && (
                        <span className={`ml-1.5 text-[11px] ${attColor(l.attendance_pct)}`}>{l.attendance_pct}%</span>
                      )}
                    </div>
                    <span className="hidden w-28 shrink-0 font-mono text-[11px] text-[#374151] sm:block truncate">{l.phone ?? '—'}</span>
                    <span className="hidden w-28 shrink-0 font-mono text-[11px] text-[#64748B] sm:block truncate">{l.parent_phone ?? '—'}</span>
                    <span className={`w-14 shrink-0 text-right text-[11px] ${sessColor(l.sessions_remaining)}`}>
                      {l.sessions_remaining != null ? `${l.sessions_remaining} left` : '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLink(l.student_id)}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#E2E8F0] hover:text-[#374151] transition"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-2 flex flex-wrap gap-2">
              {options.branches.length > 1 && (
                <select
                  value={pickerBranch}
                  onChange={e => setPickerBranch(e.target.value)}
                  className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-[12px] text-[#374151] outline-none focus:border-[#FF8A1F]"
                >
                  <option value="">All Branches</option>
                  {options.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
              {(['', 'has', 'none'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPickerHasGroup(v)}
                  className={[
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                    pickerHasGroup === v
                      ? 'border-[#FF8A1F] bg-[#FF8A1F]/10 text-[#FF8A1F]'
                      : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]',
                  ].join(' ')}
                >
                  {v === '' ? 'All' : v === 'has' ? 'In a Group' : 'No Group'}
                </button>
              ))}
            </div>

            <div ref={pickerRef} className="relative">
              <input
                ref={searchRef}
                type="text"
                value={pickerQ}
                onChange={e => { setPickerQ(e.target.value); setShowPicker(true) }}
                onFocus={() => setShowPicker(true)}
                placeholder="Name, code, student phone, or parent phone…"
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] outline-none focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20"
              />
              {showPicker && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[#E2E8F0] bg-white shadow-lg">
                  {filtered.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-[#94A3B8]">{pickerQ ? 'No students found.' : 'Type to search…'}</p>
                  ) : filtered.map(s => (
                    <button
                      key={s.student_id}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); addStudent(s) }}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-[#FFF7ED] transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-medium text-[#0B1F3A]">{s.student_name}</span>
                          <span className="font-mono text-[11px] text-[#94A3B8]">{s.student_code ?? '—'}</span>
                          <span className="text-[11px] text-[#64748B]">· {s.age != null ? `${s.age}y` : '—'}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-[#64748B]">
                          <span>{s.branch_name}</span>
                          {s.group_name && <span className="rounded bg-amber-50 px-1 text-amber-700">in {s.group_name}</span>}
                          <span>· {s.phone ?? '—'}</span>
                          <span>· P: {s.parent_phone ?? '—'}</span>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-0.5">
                        {s.attendance_pct != null && (
                          <span className={`text-[11px] font-medium ${attColor(s.attendance_pct)}`}>
                            {s.attendance_pct}% att.
                          </span>
                        )}
                        <span className={`text-[11px] ${s.sessions_remaining != null ? sessColor(s.sessions_remaining) : 'text-[#94A3B8]'}`}>
                          {s.sessions_remaining != null ? `${s.sessions_remaining} sess. left` : '—'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {state && !state.success && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{state.error.message}</p>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-4">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F8FAFC] transition">
              Cancel
            </button>
            <button type="submit" disabled={pending}
              className="rounded-lg bg-[#FF8A1F] px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18] disabled:opacity-60">
              {pending ? 'Saving…' : mode === 'create' ? 'Create Group' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
