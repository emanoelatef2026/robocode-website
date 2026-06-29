'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

const ACTIONS = [
  {
    label: 'Homework',
    href:  '/portal/instructor/homework',
    bg:    'bg-[#F59E0B]',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75-6.75a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clipRule="evenodd" />
        <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
      </svg>
    ),
  },
  {
    label: 'Continue Session',
    href:  '/portal/instructor/groups',
    bg:    'bg-[#FF8A1F]',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: 'Start Session',
    href:  '/portal/instructor/groups',
    bg:    'bg-[#10B981]',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 9a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V15a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V9Z" clipRule="evenodd" />
      </svg>
    ),
  },
] as const

export default function InstructorFAB() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div
      ref={ref}
      className="fixed bottom-20 right-4 z-50 flex flex-col-reverse items-end gap-2 md:hidden"
      aria-label="Quick actions"
    >
      {/* Speed-dial items */}
      {open && ACTIONS.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          onClick={() => setOpen(false)}
          className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-white shadow-md transition active:opacity-80 ${a.bg}`}
        >
          {a.icon}
          <span>{a.label}</span>
        </Link>
      ))}

      {/* Main FAB button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition active:scale-95 ${
          open ? 'bg-[#64748B]' : 'bg-[#FF8A1F]'
        }`}
        aria-label={open ? 'Close quick actions' : 'Quick actions'}
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`h-5 w-5 text-white transition-transform duration-200 ${open ? 'rotate-45' : ''}`}
        >
          <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}
