"use client"

import InstructorSidebar from "./InstructorSidebar"
import InstructorBottomNav from "./InstructorBottomNav"
import InstructorFAB from "./InstructorFAB"
import { AppLayout } from "@/components/shared/layout/AppLayout"
import TopHeader from "@/components/shared/layout/TopHeader"
import { TopbarActionProvider } from "@/components/shared/layout/TopbarActionContext"
import NotificationBell from "@/components/portal/shared/NotificationBell"
import { INSTRUCTOR_SECTIONS } from "@/modules/instructor-portal/navigation"

interface Props {
  children:             React.ReactNode
  unreadNotifications?: number
  email?:               string | null
}

export default function InstructorShell({ children, unreadNotifications = 0, email }: Props) {
  return (
    <TopbarActionProvider>
      <AppLayout
        renderSidebar={({ isOpen, onClose }) => (
          <InstructorSidebar isOpen={isOpen} onClose={onClose} email={email} />
        )}
        renderHeader={({ onMenuClick }) => (
          <TopHeader
            onMenuClick={onMenuClick}
            role="instructor"
            sections={INSTRUCTOR_SECTIONS}
            notificationSlot={<NotificationBell initialUnreadCount={unreadNotifications} />}
          />
        )}
        bottomNav={<InstructorBottomNav />}
        fab={<InstructorFAB />}
      >
        {children}
      </AppLayout>
    </TopbarActionProvider>
  )
}
