"use client"

import { useState } from "react"
import Image from "next/image"
import StudentSidebar from "./StudentSidebar"
import StudentBottomNav from "./StudentBottomNav"

export default function StudentShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <StudentSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-11 shrink-0 items-center border-b border-[#E2E8F0] bg-white px-3 md:h-14 md:px-5">
          <div className="flex items-center gap-2 md:hidden">
            <Image src="/logo.png" alt="Robocode" width={80} height={34} className="h-6 w-auto" />
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9] active:bg-[#E2E8F0] md:hidden"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </header>

        {/* Main content — pad bottom on mobile for bottom nav */}
        <main className="flex-1 overflow-y-auto p-3 md:p-7 pb-bottom-nav md:pb-7 scroll-smooth-mobile">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <StudentBottomNav />
    </div>
  )
}
