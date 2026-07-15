"use client"

import { useState } from "react"
import InstructorSidebar from "./InstructorSidebar"
import InstructorBottomNav from "./InstructorBottomNav"
import AdminTopbar from "@/components/admin/AdminTopbar"
import { TopbarActionProvider } from "@/components/admin/TopbarActionContext"
import NotificationBell from "@/components/portal/shared/NotificationBell"
import InstructorFAB    from "./InstructorFAB"

interface Props {
  children:           React.ReactNode
  unreadNotifications?: number
}

export default function InstructorShell({ children, unreadNotifications = 0 }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <TopbarActionProvider>
      <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
        <InstructorSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          <AdminTopbar
            onMenuClick={() => setSidebarOpen(true)}
            role="instructor"
            bellSlot={<NotificationBell initialUnreadCount={unreadNotifications} />}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-7 pb-bottom-nav md:pb-7 scroll-smooth-mobile">
            {children}
          </main>
        </div>

        <InstructorBottomNav />
        <InstructorFAB />
      </div>
    </TopbarActionProvider>
  )
}
