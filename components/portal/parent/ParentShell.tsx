'use client'

import ParentSidebar from './ParentSidebar'
import ParentBottomNav from './ParentBottomNav'
import { AppLayout } from '@/components/shared/layout/AppLayout'
import TopHeader from '@/components/shared/layout/TopHeader'
import { TopbarActionProvider } from '@/components/shared/layout/TopbarActionContext'
import NotificationBell from '@/components/portal/shared/NotificationBell'
import { PARENT_NAV_ITEMS } from '@/modules/parents/navigation'
import type { ParentChildSummary } from '@/modules/parents/parent-portal-queries'

const PARENT_SECTIONS = [{ items: PARENT_NAV_ITEMS.map(({ label, href, exact }) => ({ label, href, exact, icon: null })) }]

interface Props {
  children:             React.ReactNode
  linkedChildren:       ParentChildSummary[]
  unreadNotifications?: number
  email?:               string | null
}

export default function ParentShell({ children, linkedChildren, unreadNotifications = 0, email }: Props) {
  return (
    <TopbarActionProvider>
      <AppLayout
        renderSidebar={({ isOpen, onClose }) => (
          <ParentSidebar isOpen={isOpen} onClose={onClose} linkedChildren={linkedChildren} email={email} />
        )}
        renderHeader={({ onMenuClick }) => (
          <TopHeader
            onMenuClick={onMenuClick}
            role="parent"
            sections={PARENT_SECTIONS}
            notificationSlot={<NotificationBell initialUnreadCount={unreadNotifications} />}
          />
        )}
        bottomNav={<ParentBottomNav />}
      >
        {children}
      </AppLayout>
    </TopbarActionProvider>
  )
}
