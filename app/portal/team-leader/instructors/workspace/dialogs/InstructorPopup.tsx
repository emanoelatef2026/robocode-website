'use client'

import { useState } from 'react'
import { buildWhatsAppUrl } from '@/lib/phone'
import type { InstructorOperationalRow, InstructorDetailData, InstructorGroupDetail } from '@/modules/instructors/types'
import { Avatar } from '../components/Avatar'
import { Spinner } from '../components/Spinner'
import { OverviewTab } from '../components/tabs/OverviewTab'
import { GroupsTab } from '../components/tabs/GroupsTab'
import { AttendanceTab } from '../components/tabs/AttendanceTab'
import { FinanceTab } from '../components/tabs/FinanceTab'
import { NotesTab } from '../components/tabs/NotesTab'
import { TABS, WA_PATH } from '../types'
import { displayName, initials, statusCls } from '../utils'
import type { TabKey } from '../types'

export function InstructorPopup({
  instructor, detail, loading, activeTab, onTabChange, canManage,
  onEdit, onAssignGroup, onArchive, onDelete, onRemoveGroup, onClose, onRefreshDetail,
}: {
  instructor:      InstructorOperationalRow
  detail:          InstructorDetailData | null
  loading:         boolean
  activeTab:       TabKey
  onTabChange:     (t: TabKey) => void
  canManage:       boolean
  onEdit:          () => void
  onAssignGroup:   () => void
  onArchive:       () => void
  onDelete:        () => void
  onRemoveGroup:   (g: InstructorGroupDetail) => void
  onClose:         () => void
  onRefreshDetail: () => void
}) {
  const [overflowOpen, setOverflowOpen] = useState(false)

  const name  = displayName(instructor.first_name, instructor.last_name, instructor.user_email)
  const phone = detail?.instructor.phone ?? instructor.phone
  const wa    = detail?.instructor.whatsapp_number ?? phone
  const waUrl = wa ? buildWhatsAppUrl(wa, null) : null

  function tabCount(key: TabKey): number | null {
    if (!detail) return null
    if (key === 'groups') return detail.groups.length
    if (key === 'notes')  return detail.notes.length
    return null
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />

      <div
        className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center md:p-4"
        onClick={onClose}
      >
        <div
          className="w-full flex flex-col bg-white shadow-2xl overflow-hidden rounded-t-2xl h-[95dvh] md:rounded-2xl md:h-[90vh] md:max-w-[1100px]"
          onClick={e => e.stopPropagation()}
        >
          {/* Mobile drag handle */}
          <div className="flex justify-center pt-2.5 pb-0.5 md:hidden shrink-0">
            <div className="h-1 w-10 rounded-full bg-[#E2E8F0]" />
          </div>

          {/* Header */}
          <div className="shrink-0 border-b border-[#E2E8F0] bg-white">

            {/* Mobile header */}
            <div className="md:hidden px-4 pt-2 pb-3 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold bg-[#0B1F3A] text-white">
                  {initials(instructor.first_name, instructor.last_name, instructor.user_email)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="text-[14px] font-bold text-[#0B1F3A] leading-tight">{name}</h2>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold capitalize ${statusCls(instructor.status)}`}>
                      {instructor.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    {instructor.instructor_code && (
                      <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-[9px] text-[#94A3B8]">{instructor.instructor_code}</span>
                    )}
                    {instructor.branch_names.map(b => (
                      <span key={b} className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] text-[#64748B]">{b}</span>
                    ))}
                    {phone && <a href={`tel:${phone}`} className="text-[9px] text-[#64748B]">{phone}</a>}
                  </div>
                </div>
                <button onClick={onClose} className="shrink-0 mt-0.5 rounded-full border border-[#E2E8F0] p-1.5 text-[#94A3B8] active:bg-[#F1F5F9] transition">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-2.5 text-[11px]">
                <span><strong className="text-[#0B1F3A]">{instructor.group_count}</strong> <span className="text-[#94A3B8]">groups</span></span>
                <span className="text-[#E2E8F0]">·</span>
                <span><strong className="text-[#0B1F3A]">{instructor.student_count}</strong> <span className="text-[#94A3B8]">students</span></span>
                {instructor.today_sessions_count > 0 && (
                  <>
                    <span className="text-[#E2E8F0]">·</span>
                    <span className="rounded bg-[#FFFBEB] px-1.5 py-0.5 text-[9px] font-bold text-[#B45309]">{instructor.today_sessions_count} today</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {waUrl && (
                  <a href={waUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg bg-[#10B981] px-2.5 py-1.5 text-[11px] font-medium text-white active:bg-[#059669] transition">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 shrink-0"><path d={WA_PATH}/></svg>
                    WA
                  </a>
                )}
                {canManage && (
                  <button onClick={onAssignGroup}
                    className="flex-1 rounded-lg bg-[#FF8A1F] px-2.5 py-1.5 text-[11px] font-semibold text-white active:bg-[#e87c18] transition text-center">
                    + Assign Group
                  </button>
                )}
                {canManage && (
                  <div className="relative">
                    <button
                      onClick={() => setOverflowOpen(v => !v)}
                      className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[11px] text-[#374151] active:bg-[#F8FAFC] transition flex items-center gap-1"
                    >
                      More
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 shrink-0">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                      </svg>
                    </button>
                    {overflowOpen && (
                      <>
                        <div className="fixed inset-0 z-[51]" onClick={() => setOverflowOpen(false)} />
                        <div className="absolute right-0 top-full mt-1 z-[52] w-36 ds-card shadow-xl overflow-hidden">
                          <button onClick={() => { setOverflowOpen(false); onEdit() }}
                            className="flex w-full items-center px-4 py-3 text-[12px] font-medium text-[#374151] active:bg-[#F8FAFC]">Edit</button>
                          <div className="h-px bg-[#F1F5F9]" />
                          <button onClick={() => { setOverflowOpen(false); onArchive() }}
                            className="flex w-full items-center px-4 py-3 text-[12px] font-medium text-[#F59E0B] active:bg-[#FFFBEB]">Archive</button>
                          <div className="h-px bg-[#F1F5F9]" />
                          <button onClick={() => { setOverflowOpen(false); onDelete() }}
                            className="flex w-full items-center px-4 py-3 text-[12px] font-medium text-[#EF4444] active:bg-[#FEE2E2]">Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {!canManage && (
                  <button onClick={onClose} className="ml-auto rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[11px] text-[#64748B] active:bg-[#F8FAFC] transition">
                    Close
                  </button>
                )}
              </div>
            </div>

            {/* Desktop header */}
            <div className="hidden md:block px-6 py-4">
              <div className="flex items-start gap-4">
                <Avatar first={instructor.first_name} last={instructor.last_name} email={instructor.user_email} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-[16px] font-bold text-[#0B1F3A]">{name}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusCls(instructor.status)}`}>
                      {instructor.status.replace('_', ' ')}
                    </span>
                    {instructor.instructor_code && (
                      <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-[10px] text-[#94A3B8]">{instructor.instructor_code}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {instructor.branch_names.map(b => (
                      <span key={b} className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] text-[#64748B]">{b}</span>
                    ))}
                  </div>
                  {phone && (
                    <p className="mt-0.5 text-[12px] text-[#64748B]">
                      <a href={`tel:${phone}`} className="hover:text-[#FF8A1F]">{phone}</a>
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-[11px]">
                    <span className="text-[#64748B]"><strong className="text-[#0B1F3A]">{instructor.group_count}</strong> groups</span>
                    <span className="text-[#64748B]"><strong className="text-[#0B1F3A]">{instructor.student_count}</strong> students</span>
                    {instructor.today_sessions_count > 0 && (
                      <span className="rounded bg-[#FFFBEB] px-1.5 py-0.5 text-[10px] font-semibold text-[#B45309]">
                        {instructor.today_sessions_count} today
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 flex-wrap justify-end">
                  {waUrl && (
                    <a href={waUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-lg bg-[#10B981] px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-[#059669] transition">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3"><path d={WA_PATH}/></svg>
                      WA
                    </a>
                  )}
                  {canManage && (
                    <>
                      <button onClick={onAssignGroup} className="rounded-lg bg-[#FF8A1F] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#e87c18] transition">Assign Group</button>
                      <button onClick={onEdit} className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[11px] text-[#374151] hover:bg-[#F8FAFC] transition">Edit</button>
                      <button onClick={onArchive} className="rounded-lg border border-[#FEE2E2] px-2.5 py-1.5 text-[11px] text-[#EF4444] hover:bg-[#FEE2E2] transition">Archive</button>
                      <button onClick={onDelete} className="rounded-lg border border-red-500 px-2.5 py-1.5 text-[11px] font-semibold text-[#EF4444] hover:bg-[#DC2626] hover:text-white transition">Delete</button>
                    </>
                  )}
                  <button onClick={onClose} className="rounded-lg border border-[#E2E8F0] p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] transition">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex shrink-0 border-b border-[#E2E8F0] bg-white">
            {TABS.map(tab => {
              const count = tabCount(tab.key)
              return (
                <button key={tab.key} onClick={() => onTabChange(tab.key)}
                  className={`flex flex-1 md:flex-none items-center justify-center gap-1 md:gap-1.5 whitespace-nowrap px-2 md:px-5 py-2.5 md:py-3 text-[11px] md:text-[12px] font-medium border-b-2 transition ${activeTab === tab.key ? 'border-[#FF8A1F] text-[#FF8A1F]' : 'border-transparent text-[#64748B] hover:text-[#0B1F3A]'}`}>
                  {tab.label}
                  {count !== null && count > 0 && (
                    <span className={`rounded-full px-1 py-0.5 text-[9px] font-bold ${activeTab === tab.key ? 'bg-[#FF8A1F] text-white' : 'bg-[#F1F5F9] text-[#64748B]'}`}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-5" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
            {loading ? <Spinner /> : !detail ? (
              <div className="flex items-center justify-center py-16 text-[12px] text-[#94A3B8]">Failed to load instructor data</div>
            ) : (
              <>
                {activeTab === 'overview'   && <OverviewTab detail={detail} />}
                {activeTab === 'groups'     && <GroupsTab groups={detail.groups} canManage={canManage} onAssignGroup={onAssignGroup} onRemoveGroup={onRemoveGroup} />}
                {activeTab === 'attendance' && <AttendanceTab stats={detail.attendance_stats} groups={detail.groups} />}
                {activeTab === 'finance'    && <FinanceTab detail={detail} />}
                {activeTab === 'notes'      && <NotesTab instructorId={detail.instructor.id} notes={detail.notes} onRefresh={onRefreshDetail} />}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
