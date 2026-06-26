'use client'

import { useState } from 'react'
export function GroupActionsDropdown({
  onRecordAttendance, onAddStudent, onEdit, onDelete,
}: {
  onRecordAttendance: () => void
  onAddStudent:       () => void
  onEdit:             () => void
  onDelete:           () => void
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
          </div>
        </>
      )}
    </div>
  )
}
