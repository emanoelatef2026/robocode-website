"use client"

import TLSidebar from "./TLSidebar"
import TLBottomNav from "./TLBottomNav"
import { AppLayout } from "@/components/shared/layout/AppLayout"
import TopHeader from "@/components/shared/layout/TopHeader"
import { TopbarActionProvider } from "@/components/shared/layout/TopbarActionContext"
import NotificationBell from "@/components/portal/shared/NotificationBell"
import { TL_SECTIONS } from "@/modules/team-leader/navigation"

interface Props {
  children:             React.ReactNode
  email?:               string | null
  unreadNotifications?: number
}

export default function TLShell({ children, email, unreadNotifications = 0 }: Props) {
  return (
    <TopbarActionProvider>
      <AppLayout
        renderSidebar={({ isOpen, onClose }) => (
          <TLSidebar isOpen={isOpen} onClose={onClose} email={email} />
        )}
        renderHeader={({ onMenuClick }) => (
          <TopHeader
            onMenuClick={onMenuClick}
            role="team_leader"
            sections={TL_SECTIONS}
            notificationSlot={<NotificationBell initialUnreadCount={unreadNotifications} />}
          />
        )}
        bottomNav={<TLBottomNav />}
      >
        {children}
      </AppLayout>
    </TopbarActionProvider>
  )
}
