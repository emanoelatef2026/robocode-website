"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import InstructorSidebar from "./InstructorSidebar"

export default function InstructorShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery]  = useState("")
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    router.push(`/portal/instructor/students/search?q=${encodeURIComponent(q)}`)
    setSearchQuery("")
    inputRef.current?.blur()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <InstructorSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#E2E8F0] bg-white px-5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-[#64748B] hover:bg-[#F1F5F9] md:hidden"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Global student search */}
          <form onSubmit={handleSearch} className="flex flex-1 max-w-sm items-center gap-2">
            <div className="relative flex-1">
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
              >
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              <input
                ref={inputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students…"
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] py-1.5 pl-8 pr-3 text-sm text-[#0B1F3A] placeholder-[#94A3B8] outline-none focus:border-[#FF8A1F] focus:bg-white focus:ring-2 focus:ring-[#FF8A1F]/15"
              />
            </div>
          </form>

          <div className="flex-1" />
        </header>
        <main className="flex-1 overflow-y-auto p-5 md:p-7">{children}</main>
      </div>
    </div>
  )
}
