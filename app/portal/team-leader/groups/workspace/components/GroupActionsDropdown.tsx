'use client'

import { useState } from 'react'
export function GroupActionsDropdown({
  onRecordAttendance, onAddStudent, onEdit, onDelete, onIssueBulkCertificates,
  isArchived = false, canArchive = false, canRecover = false, onArchive, onRecover,
  canGraduate = false, alreadyGraduated = false, onGraduate,
}: {
  onRecordAttendance:        () => void
  onAddStudent:              () => void
  onEdit:                    () => void
  onDelete:                  () => void
  onIssueBulkCertificates?:  () => void
  // Phase 1: Cohort Lifecycle — Archived cohorts are structurally read-only
  // (DB-trigger-enforced); the edit affordances below are hidden here as a
  // UI courtesy, not the real enforcement layer.
  isArchived?: boolean
  canArchive?: boolean
  canRecover?: boolean
  onArchive?:  () => void
  onRecover?:  () => void
  // Phase 2: Graduation Wizard — canGraduate is a client-side UX hint only;
  // real enforcement is requirePermission('graduate_cohort', ...) server-side.
  canGraduate?:      boolean
  alreadyGraduated?: boolean
  onGraduate?:       () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#e87c18] transition"
      >
        Actions
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-52 ds-card py-1 shadow-xl">

            {isArchived ? (
              canRecover && onRecover && (
                <button
                  onClick={() => { setOpen(false); onRecover() }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-semibold text-[#1D4ED8] hover:bg-[#EFF6FF] transition"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  Recover Cohort
                </button>
              )
            ) : (
              <>
                <button
                  onClick={() => { setOpen(false); onRecordAttendance() }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-semibold text-[#FF8A1F] hover:bg-[#FFF7ED] transition"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  Record Attendance
                </button>

                <div className="my-1 border-t border-[#F1F5F9]" />

                <button
                  onClick={() => { setOpen(false); onAddStudent() }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium text-[#374151] hover:bg-[#F8FAFC] transition"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#94A3B8] shrink-0">
                    <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                  </svg>
                  Add Student
                </button>

                <div className="my-1 border-t border-[#F1F5F9]" />

                <button
                  onClick={() => { setOpen(false); onEdit() }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium text-[#374151] hover:bg-[#F8FAFC] transition"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#94A3B8] shrink-0">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Edit Group
                </button>

                <button
                  onClick={() => { setOpen(false); onDelete() }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium text-[#EF4444] hover:bg-[#FEE2E2] transition"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Delete Group
                </button>

                {onIssueBulkCertificates && (
                  <>
                    <div className="my-1 border-t border-[#F1F5F9]" />
                    <button
                      onClick={() => { setOpen(false); onIssueBulkCertificates() }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium text-[#374151] hover:bg-[#F8FAFC] transition"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#FF8A1F] shrink-0">
                        <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V8z" clipRule="evenodd" />
                      </svg>
                      Issue Group Certificates
                    </button>
                  </>
                )}

                {canArchive && onArchive && (
                  <>
                    <div className="my-1 border-t border-[#F1F5F9]" />
                    <button
                      onClick={() => { setOpen(false); onArchive() }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium text-[#64748B] hover:bg-[#F8FAFC] transition"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#94A3B8] shrink-0">
                        <path d="M4 3a2 2 0 00-2 2v1a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zM3 9v6a2 2 0 002 2h10a2 2 0 002-2V9H3zm5 2h4a1 1 0 010 2H8a1 1 0 010-2z" />
                      </svg>
                      Archive Cohort
                    </button>
                  </>
                )}

                {(canGraduate || alreadyGraduated) && onGraduate && (
                  <>
                    <div className="my-1 border-t border-[#F1F5F9]" />
                    <button
                      onClick={() => { setOpen(false); onGraduate() }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[12px] font-medium text-[#15803D] hover:bg-[#E7F8EE] transition"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                        <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z" />
                      </svg>
                      {alreadyGraduated ? 'View Next Cohort →' : 'Start Graduation'}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
