"use client"

import { useState } from "react"
import StudentSidebar from "./StudentSidebar"
import StudentBottomNav from "./StudentBottomNav"

interface Props {
  children:     React.ReactNode
  studentName?: string
  groupName?:   string
}

// Static placeholder values — wire to DB when gamification is built
const STREAK = 12
const RANK   = 3

function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="#475569" className="h-[17px] w-[17px]">
      <path d="M10 2a6 6 0 00-6 6c0 1.886-.454 3.665-1.257 5.234a.75.75 0 00.515 1.076 32.9 32.9 0 003.256.508 3.5 3.5 0 006.972 0 32.9 32.9 0 003.256-.508.75.75 0 00.515-1.076A11.448 11.448 0 0116 8a6 6 0 00-6-6z" />
    </svg>
  )
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  )
}

export default function StudentShell({ children, studentName, groupName }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const firstName = studentName?.split(" ")[0] ?? "Student"

  return (
    <div className="min-h-screen bg-[#F0F4F8]">

      {/* Fixed sidebar */}
      <StudentSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        studentName={studentName}
        groupName={groupName}
      />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Content column — offset by sidebar on desktop */}
      <div className="flex min-h-screen flex-col md:ms-[200px]">

        {/* ── Header ── */}
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-[#e9edf3] bg-white px-4 py-[14px] md:px-7">

          {/* Mobile: hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#F1F5F9] text-[#475569] transition hover:bg-[#E2E8F0] active:bg-[#CBD5E1] md:hidden"
            aria-label="Open menu"
          >
            <HamburgerIcon />
          </button>

          {/* Desktop: greeting */}
          <div className="hidden md:block">
            <p className="text-[17px] font-extrabold leading-tight text-[#0B1F3A]">
              Hey, {firstName} 👋
            </p>
            <p className="mt-0.5 text-[11.5px] text-[#64748B]" suppressHydrationWarning>
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              {groupName ? ` · ${groupName}` : ""}
            </p>
          </div>

          <div className="flex-1" />

          {/* Streak chip — always visible */}
          <div className="flex items-center gap-[7px] rounded-[10px] border border-[#f6e3c4] bg-[#FFF7E6] px-3 py-[7px]">
            <span className="text-[15px]" aria-hidden>🔥</span>
            <div>
              <div
                className="text-[14px] font-bold leading-none text-[#B45309]"
                style={{ fontFamily: "var(--font-orbitron)" }}
              >
                {STREAK}
              </div>
              <div className="text-[9px] font-semibold tracking-[.05em] text-[#B45309]">
                DAY STREAK
              </div>
            </div>
          </div>

          {/* Rank chip — desktop only */}
          <div className="hidden items-center gap-[7px] rounded-[10px] bg-[#0B1F3A] px-3 py-[7px] md:flex">
            <span className="text-[14px]" aria-hidden>🏆</span>
            <div>
              <div
                className="text-[14px] font-bold leading-none text-[#FFB15A]"
                style={{ fontFamily: "var(--font-orbitron)" }}
              >
                #{RANK}
              </div>
              <div className="text-[9px] font-semibold text-white/50">IN GROUP</div>
            </div>
          </div>

          {/* Bell — desktop only */}
          <button
            className="relative hidden h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-[#e4e9f0] bg-white transition hover:bg-[#F8FAFC] md:flex"
            aria-label="Notifications"
          >
            <BellIcon />
            <span className="absolute end-[8px] top-[7px] h-[7px] w-[7px] rounded-full border-[1.5px] border-white bg-[#DC2626]" />
          </button>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 px-4 pb-[calc(72px+env(safe-area-inset-bottom,0px))] pt-4 md:px-7 md:pb-10 md:pt-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <StudentBottomNav />
    </div>
  )
}
