'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import ScheduleTrialModal from './ScheduleTrialModal'
import type { LeadListItem } from '@/modules/leads/types'
import { LEAD_STATUS_COLORS, LEAD_SOURCE_LABELS, AGING_THRESHOLDS } from '@/modules/leads/types'

interface Props {
  leads:       LeadListItem[]
  instructors: { id: string; name: string }[]
  branches:    { id: string; name: string }[]
  basePath:    string
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${LEAD_STATUS_COLORS[status as keyof typeof LEAD_STATUS_COLORS] ?? 'bg-[#F1F5F9] text-[#334155]'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function DaysBadge({ days, status }: { days: number; status: string }) {
  const threshold = AGING_THRESHOLDS[status as keyof typeof AGING_THRESHOLDS]
  const isAging   = threshold != null && days > threshold
  const cls = isAging
    ? 'bg-[#FEE2E2] text-[#DC2626] font-semibold'
    : days > 0
      ? 'bg-[#F8FAFC] text-[#64748B]'
      : 'text-[#94A3B8]'
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] ${cls}`}>
      {days}d
    </span>
  )
}

export default function LeadsTableClient({ leads, instructors, branches, basePath }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)

  const toggleAll = useCallback(() => {
    setSelected(prev =>
      prev.size === leads.length
        ? new Set()
        : new Set(leads.map(l => l.id))
    )
  }, [leads])

  const toggleOne = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const selectedLeads = leads
    .filter(l => selected.has(l.id))
    .map(l => ({ id: l.id, name: l.child_name }))

  const defaultBranchId = selectedLeads.length > 0
    ? (leads.find(l => l.id === selectedLeads[0].id)?.branch_id ?? branches[0]?.id)
    : branches[0]?.id

  return (
    <>
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5">
          <span className="text-[12px] font-semibold text-purple-700">
            {selected.size} lead{selected.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-purple-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm-2 8a1 1 0 011-1h8a1 1 0 110 2H5a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 110 2H5a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            Schedule Trial Session
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-[11px] text-purple-500 hover:text-purple-700"
          >
            Clear
          </button>
        </div>
      )}

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-[#E2E8F0]">
        {leads.map(lead => {
          const followUpDate    = lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null
          const followUpOverdue = followUpDate && followUpDate < new Date()
          const isSelected      = selected.has(lead.id)

          return (
            <div
              key={lead.id}
              className={`px-4 py-4 transition ${isSelected ? 'bg-purple-50' : ''}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleOne(lead.id)}
                  className="mt-1 h-4 w-4 rounded border-[#E2E8F0] accent-purple-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`${basePath}/${lead.id}`}
                        className="block text-[15px] font-semibold text-[#0B1F3A] leading-tight"
                      >
                        {lead.child_name}
                      </Link>
                      {lead.parent_name && (
                        <p className="mt-0.5 text-[12px] text-[#64748B]">{lead.parent_name}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <DaysBadge days={lead.days_in_stage} status={lead.status} />
                      <StatusBadge status={lead.status} />
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#64748B]">
                    {lead.phone && <a href={`tel:${lead.phone}`} className="font-medium text-[#0B1F3A]">{lead.phone}</a>}
                    <span>{LEAD_SOURCE_LABELS[lead.source] ?? lead.source}</span>
                    {lead.assigned_name && <span>{lead.assigned_name}</span>}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    {followUpDate ? (
                      <span className={`text-[11px] font-medium ${followUpOverdue ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>
                        Follow-up: {followUpDate.toLocaleDateString('en-GB')}
                        {followUpOverdue && ' ⚠'}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#94A3B8]">No follow-up</span>
                    )}
                    <div className="ml-auto flex gap-2">
                      {!['CONVERTED', 'LOST'].includes(lead.status) && (
                        <Link
                          href={`${basePath}/${lead.id}?tab=trial`}
                          className="rounded-lg bg-purple-100 px-2.5 py-1.5 text-[11px] font-semibold text-purple-700 hover:bg-purple-200 transition"
                        >
                          Trial
                        </Link>
                      )}
                      <Link
                        href={`${basePath}/${lead.id}`}
                        className="rounded-lg bg-[#FF8A1F]/10 px-3 py-1.5 text-[12px] font-semibold text-[#FF8A1F] min-h-9 flex items-center"
                      >
                        Manage →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="w-8 px-4 py-3">
                <input
                  type="checkbox"
                  checked={leads.length > 0 && selected.size === leads.length}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-[#E2E8F0] accent-purple-600"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Child</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Owner</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">In Stage</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Source</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Follow-Up</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {leads.map(lead => {
              const followUpDate    = lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null
              const followUpOverdue = followUpDate && followUpDate < new Date()
              const isSelected      = selected.has(lead.id)

              return (
                <tr
                  key={lead.id}
                  className={`border-b border-[#F1F5F9] transition hover:bg-[#F8FAFC] ${isSelected ? 'bg-purple-50 hover:bg-purple-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(lead.id)}
                      className="h-4 w-4 rounded border-[#E2E8F0] accent-purple-600"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                    {lead.child_name}
                    {lead.parent_name && (
                      <p className="text-[11px] font-normal text-[#94A3B8]">{lead.parent_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">{lead.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    {lead.assigned_name
                      ? <span className="text-sm text-[#0B1F3A]">{lead.assigned_name}</span>
                      : <span className="text-[11px] text-[#94A3B8]">Unassigned</span>
                    }
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                  <td className="px-4 py-3">
                    <DaysBadge days={lead.days_in_stage} status={lead.status} />
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">{LEAD_SOURCE_LABELS[lead.source] ?? lead.source}</td>
                  <td className="px-4 py-3">
                    {followUpDate ? (
                      <span className={`text-xs font-medium ${followUpOverdue ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>
                        {followUpDate.toLocaleDateString('en-GB')}
                        {followUpOverdue && ' ⚠'}
                      </span>
                    ) : <span className="text-[#94A3B8]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-[#94A3B8]">
                    {new Date(lead.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!['CONVERTED', 'LOST'].includes(lead.status) && (
                        <Link
                          href={`${basePath}/${lead.id}?tab=trial`}
                          className="rounded px-2 py-1 text-[11px] font-semibold text-purple-600 hover:bg-purple-50 transition"
                        >
                          Trial
                        </Link>
                      )}
                      <Link
                        href={`${basePath}/${lead.id}`}
                        className="text-xs font-medium text-[#FF8A1F] hover:underline"
                      >
                        Manage
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Schedule Trial Modal */}
      <ScheduleTrialModal
        leads={selectedLeads}
        instructors={instructors}
        branches={branches}
        defaultBranchId={defaultBranchId ?? undefined}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}
