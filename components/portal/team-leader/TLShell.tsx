"use client"

import { useState } from "react"
import TLSidebar from "./TLSidebar"
import TLBottomNav from "./TLBottomNav"
import AdminTopbar from "@/components/admin/AdminTopbar"
import { TopbarActionProvider } from "@/components/admin/TopbarActionContext"

export default function TLShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <TopbarActionProvider>
      <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
        <TLSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          <AdminTopbar
            onMenuClick={() => setSidebarOpen(true)}
            role="team_leader"
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-7 pb-bottom-nav md:pb-7 scroll-smooth-mobile">
            {children}
          </main>
        </div>

        <TLBottomNav />
      </div>
    </TopbarActionProvider>
  )
}
