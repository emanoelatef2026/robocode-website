"use client"

import AdminSidebar from "./AdminSidebar"
import AdminBottomNav from "./AdminBottomNav"
import { AppLayout } from "@/components/shared/layout/AppLayout"
import TopHeader from "@/components/shared/layout/TopHeader"
import { TopbarActionProvider } from "@/components/shared/layout/TopbarActionContext"
import NotificationBell from "@/components/portal/shared/NotificationBell"
import { ADMIN_SECTIONS } from "@/modules/admin/navigation"
import type { PortalRole } from "@/components/shared/layout/roles"

interface Props {
  children:             React.ReactNode
  role:                 PortalRole
  permissions:          string[]
  email?:               string | null
  unreadNotifications?: number
}

export default function AdminShell({ children, role, permissions, email, unreadNotifications = 0 }: Props) {
  return (
    <TopbarActionProvider>
      <AppLayout
        renderSidebar={({ isOpen, onClose }) => (
          <AdminSidebar isOpen={isOpen} onClose={onClose} role={role} permissions={permissions} email={email} />
        )}
        renderHeader={({ onMenuClick }) => (
          <TopHeader
            onMenuClick={onMenuClick}
            role={role}
            sections={ADMIN_SECTIONS}
            notificationSlot={<NotificationBell initialUnreadCount={unreadNotifications} />}
          />
        )}
        bottomNav={<AdminBottomNav role={role} permissions={permissions} />}
      >
        {children}
      </AppLayout>
    </TopbarActionProvider>
  )
}
