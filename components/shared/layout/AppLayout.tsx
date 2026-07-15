"use client"

import { useState } from "react"

export interface AppLayoutRenderProps {
  isOpen:  boolean
  onClose: () => void
}

export interface AppLayoutProps {
  /** Receives the mobile-drawer open state so sidebar and overlay stay in sync. */
  renderSidebar: (props: AppLayoutRenderProps) => React.ReactNode
  /** Receives onMenuClick to wire the hamburger button to the same drawer state. */
  renderHeader:  (props: { onMenuClick: () => void }) => React.ReactNode
  bottomNav?:    React.ReactNode
  fab?:          React.ReactNode
  children:      React.ReactNode
}

/**
 * The one page shell every portal renders through. Sidebar is `md:sticky` (not
 * `fixed`) so it stays a flex sibling of the content column — collapse/expand
 * reflows the content automatically with no extra state to lift — while the
 * outer container uses `min-h-screen` (page scrolls) instead of the old
 * `h-screen overflow-hidden` app-shell model, matching the Student portal
 * reference and avoiding its class of iOS scroll-trapping bugs.
 */
export function AppLayout({ renderSidebar, renderHeader, bottomNav, fab, children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const close = () => setSidebarOpen(false)

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <div className="md:sticky md:top-0 md:h-screen md:shrink-0">
        {renderSidebar({ isOpen: sidebarOpen, onClose: close })}
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-(--z-overlay) bg-black/40 md:hidden"
          onClick={close}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-(--z-header)">
          {renderHeader({ onMenuClick: () => setSidebarOpen(true) })}
        </div>
        <main className="pb-bottom-nav scroll-smooth-mobile flex-1 px-4 pt-4 md:px-7 md:pb-7 md:pt-6">
          {children}
        </main>
      </div>

      {bottomNav}
      {fab}
    </div>
  )
}
