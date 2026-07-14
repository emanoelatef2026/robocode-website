'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { GroupOperationalRow } from '@/modules/groups/operational'
import { StatusChip } from './StatusChip'
import { GroupActionsDropdown } from './GroupActionsDropdown'
import { DAYS_FULL, fmt12, fmtDate } from '../utils'

export function GroupSummaryBar({
  group, sessionsCompleted, isTL, onEdit, onDelete, onRecordAttendance, onAddStudent, onIssueBulkCertificates,
  canArchive = false, canRecover = false, onArchive, onRecover,
  canGraduate = false, onGraduate,
}: {
  group:                     GroupOperationalRow
  sessionsCompleted:         number
  isTL:                      boolean
  onEdit:                    (g: GroupOperationalRow) => void
  onDelete:                  () => void
  onRecordAttendance:        () => void
  onAddStudent:              () => void
  onIssueBulkCertificates?:  () => void
  canArchive?: boolean
  canRecover?: boolean
  onArchive?:  () => void
  onRecover?:  () => void
  // Phase 2: Graduation Wizard
  canGraduate?: boolean
  onGraduate?:  () => void
}) {
  const [infoOpen, setInfoOpen] = useState(false)
  const [popupPos, setPopupPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [mounted, setMounted]   = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, []) // eslint-disable-line react-hooks/set-state-in-effect

  useEffect(() => {
    if (!infoOpen) return
    const close = () => { setInfoOpen(false); setPopupPos(null) }
    const onKey  = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [infoOpen])

  function handleToggle() {
    if (infoOpen) {
      setInfoOpen(false); setPopupPos(null)
    } else {
      const rect = barRef.current?.getBoundingClientRect()
      if (rect) setPopupPos({ top: rect.bottom + 2, left: rect.left, width: rect.width })
      setInfoOpen(true)
    }
  }

  const sched = [
    group.day_of_week ? DAYS_FULL[group.day_of_week] : null,
    fmt12(group.start_time),
    group.duration_minutes ? `${group.duration_minutes}m` : null,
  ].filter(Boolean).join(' · ')

  const attPct = group.attendance_avg || 0

  const activeAlloc = group.active_allocation
  const instrDisplay = activeAlloc
    ? `${activeAlloc.instructor_name} (Sessions ${activeAlloc.from_session}–${activeAlloc.to_session ?? '∞'})`
    : group.status === 'handoff_pending'
      ? 'Awaiting Instructor Handoff'
      : (group.lead_instructor_name ?? '—')

  const infoItems: { label: string; value: string; icon: React.ReactNode }[] = [
    {
      label: 'Course', value: group.course_name ?? '—',
      icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" /></svg>,
    },
    {
      label: 'Instructor', value: instrDisplay,
      icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>,
    },
    {
      label: 'Branch', value: group.branch_name,
      icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" /></svg>,
    },
    {
      label: 'Schedule', value: sched || '—',
      icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>,
    },
    {
      label: 'Start Date', value: fmtDate(group.start_date),
      icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>,
    },
    ...(group.end_date ? [{
      label: 'End Date', value: fmtDate(group.end_date),
      icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>,
    }] : []),
    {
      label: 'Capacity', value: group.capacity ? `${group.student_count} / ${group.capacity}` : `${group.student_count}`,
      icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z" /></svg>,
    },
    {
      label: 'Sessions', value: `${sessionsCompleted} done`,
      icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
    },
    {
      label: 'Avg Att.', value: attPct > 0 ? `${attPct}%` : '—',
      icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>,
    },
  ]

  return (
    <div ref={barRef} className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 shrink-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h2 className="text-[15px] font-bold text-[#0B1F3A] truncate">{group.name}</h2>
          {group.code && (
            <span className="font-mono text-[11px] text-[#94A3B8] shrink-0 hidden sm:inline">{group.code}</span>
          )}
          <StatusChip group={group} />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {group.meeting_link && (
            <a
              href={group.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 ds-card px-2.5 py-1.5 text-[11px] font-medium text-[#374151] hover:bg-[#F1F5F9] transition"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[#FF8A1F]">
                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
              </svg>
              Meeting
            </a>
          )}

          <button
            onClick={handleToggle}
            aria-label={infoOpen ? 'Close group details' : 'View group details'}
            className={[
              'flex h-9 items-center gap-1.5 rounded-lg px-2.5 transition-colors duration-150',
              infoOpen
                ? 'bg-[#FF8A1F]/10 text-[#FF8A1F] hover:bg-[#FF8A1F]/20'
                : 'text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#1E293B]',
            ].join(' ')}
          >
            <span className="text-[12px] font-medium">Group details</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-4 w-4 transition-transform duration-200 ${infoOpen ? 'rotate-180' : ''}`}
            >
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isTL && (
            <GroupActionsDropdown
              onRecordAttendance={onRecordAttendance}
              onAddStudent={onAddStudent}
              onEdit={() => onEdit(group)}
              onDelete={onDelete}
              onIssueBulkCertificates={onIssueBulkCertificates}
              isArchived={group.status === 'archived'}
              canArchive={canArchive}
              canRecover={canRecover}
              onArchive={onArchive}
              onRecover={onRecover}
              canGraduate={canGraduate}
              alreadyGraduated={!!group.graduated_at}
              onGraduate={onGraduate}
            />
          )}
        </div>
      </div>

      {mounted && infoOpen && popupPos && createPortal(
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => { setInfoOpen(false); setPopupPos(null) }}
          />
          <div
            style={{ position: 'fixed', top: popupPos.top, left: popupPos.left, width: popupPos.width, zIndex: 50 }}
            className="rounded-b-xl border border-t-0 border-[#E2E8F0] bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-3 grid grid-cols-2 lg:grid-cols-3 gap-2">
              {infoItems.map(item => (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
                >
                  <span className="shrink-0 text-[#94A3B8]">{item.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8] leading-none mb-0.5">{item.label}</p>
                    <p className="text-[12px] font-semibold text-[#374151] truncate">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}
