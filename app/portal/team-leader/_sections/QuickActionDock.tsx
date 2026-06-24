'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Action {
  label:  string
  icon:   string
  href:   string
  color:  string
}

const ACTIONS: Action[] = [
  { label: 'Add Student',     icon: '👤', href: '/portal/team-leader/students/new',         color: 'bg-[#0B1F3A]' },
  { label: 'Enroll/Collect',  icon: '💰', href: '/portal/team-leader/finance',              color: 'bg-[#FF8A1F]' },
  { label: 'Create Group',    icon: '📚', href: '/portal/team-leader/groups?action=create', color: 'bg-indigo-600' },
  { label: 'Add Payment',     icon: '💳', href: '/portal/team-leader/finance?mode=payment',      color: 'bg-[#047857]' },
  { label: 'Announcement',    icon: '📢', href: '/portal/team-leader/announcements/new',         color: 'bg-blue-600' },
  { label: 'Move Student',    icon: '↔️', href: '/portal/team-leader/students?action=move',     color: 'bg-purple-600' },
]

export default function QuickActionDock() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop: floating bottom-right */}
      <div className="fixed bottom-6 right-6 z-50 hidden md:flex flex-col items-end gap-2">
        {/* Action items */}
        {open && (
          <div className="flex flex-col items-end gap-2 animate-in slide-in-from-bottom-2 duration-200">
            {ACTIONS.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-xl ${action.color} px-4 py-2.5 text-[12px] font-semibold text-white shadow-lg hover:opacity-90 transition`}
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </Link>
            ))}
          </div>
        )}

        {/* FAB button */}
        <button
          onClick={() => setOpen(v => !v)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FF8A1F] text-white shadow-xl hover:bg-[#e87c18] transition active:scale-95"
          aria-label="Quick actions"
          aria-expanded={open}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            className={`h-6 w-6 transition-transform duration-200 ${open ? 'rotate-45' : ''}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M4 12h16" />
          </svg>
        </button>
      </div>

      {/* Mobile: bottom sticky bar (above bottom nav) */}
      <div className="fixed bottom-16 left-0 right-0 z-40 md:hidden">
        {open && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/30"
              onClick={() => setOpen(false)}
            />
            {/* Sheet */}
            <div className="relative mx-auto max-w-lg rounded-t-2xl bg-white shadow-2xl px-4 pt-4 pb-safe animate-in slide-in-from-bottom-4 duration-200">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[14px] font-bold text-[#0B1F3A]">Quick Actions</p>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9]"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 pb-4">
                {ACTIONS.map(action => (
                  <Link
                    key={action.label}
                    href={action.href}
                    onClick={() => setOpen(false)}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-center transition active:scale-95"
                  >
                    <span className="text-[22px]">{action.icon}</span>
                    <span className="text-[9px] font-semibold text-[#64748B] leading-tight">{action.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Mobile trigger */}
        {!open && (
          <div className="mx-4">
            <button
              onClick={() => setOpen(true)}
              className="w-full rounded-xl bg-[#FF8A1F] py-3 text-[13px] font-bold text-white shadow-lg hover:bg-[#e87c18] active:scale-[0.98] transition"
            >
              + Quick Action
            </button>
          </div>
        )}
      </div>
    </>
  )
}
