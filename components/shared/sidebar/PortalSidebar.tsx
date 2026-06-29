"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

const STORAGE_KEY = "sidebar_collapsed"

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PortalNavItem {
  label:           string
  href:            string
  icon:            React.ReactNode
  exact?:          boolean
  matchPatterns?:  string[]
}

export interface PortalNavSection {
  title?: string
  items:  PortalNavItem[]
}

// ── Shared icons ──────────────────────────────────────────────────────────────

const ChevronLeft = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
)

const ChevronRight = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
  </svg>
)

const IPassword = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
  </svg>
)

const ILogout = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
  </svg>
)

const ISettings = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
)

// ── SidebarNavLink ─────────────────────────────────────────────────────────────

interface SidebarNavLinkProps {
  href:          string
  label:         string
  icon:          React.ReactNode
  active:        boolean
  onClose?:      () => void
  collapsed:     boolean
  onShowTooltip: (label: string, y: number) => void
  onHideTooltip: () => void
}

export function SidebarNavLink({
  href, label, icon, active, onClose, collapsed, onShowTooltip, onHideTooltip,
}: SidebarNavLinkProps) {
  const linkRef = useRef<HTMLAnchorElement>(null)

  if (collapsed) {
    return (
      <Link
        ref={linkRef}
        href={href}
        onClick={onClose}
        onMouseEnter={() => {
          if (linkRef.current) {
            const rect = linkRef.current.getBoundingClientRect()
            onShowTooltip(label, rect.top + rect.height / 2)
          }
        }}
        onMouseLeave={onHideTooltip}
        className={[
          "flex items-center justify-center rounded-lg p-2.5 transition-all duration-150",
          active
            ? "bg-[#FF8A1F]/15 text-[#FF8A1F]"
            : "text-white/50 hover:bg-white/5 hover:text-white/80",
        ].join(" ")}
      >
        <span className={active ? "text-[#FF8A1F]" : "text-white/35"}>{icon}</span>
      </Link>
    )
  }

  return (
    <Link
      href={href}
      onClick={onClose}
      className={[
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150",
        active
          ? "bg-[#FF8A1F]/15 text-[#FF8A1F]"
          : "text-white/50 hover:bg-white/5 hover:text-white/80",
      ].join(" ")}
    >
      <span className={active ? "text-[#FF8A1F]" : "text-white/35"}>{icon}</span>
      {label}
      {active && <span className="ms-auto h-[5px] w-[5px] shrink-0 rounded-full bg-[#FF8A1F]" />}
    </Link>
  )
}

// ── SidebarSection ─────────────────────────────────────────────────────────────

interface SidebarSectionProps {
  title?:    string
  first?:    boolean
  collapsed: boolean
  children:  React.ReactNode
}

export function SidebarSection({ title, first, collapsed, children }: SidebarSectionProps) {
  return (
    <div className={first ? "mb-1" : "mt-4"}>
      {title && !collapsed && (
        <p className="mb-1.5 px-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25">
          {title}
        </p>
      )}
      {title && collapsed && (
        <div className="my-2 mx-1.5 h-px bg-white/8" />
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

// ── SidebarFooter ──────────────────────────────────────────────────────────────

interface SidebarFooterProps {
  roleLabel:       string
  roleInitials:    string
  accountSubtitle: string
  onClose?:        () => void
  collapsed:       boolean
  mounted:         boolean
}

export function SidebarFooter({
  roleLabel, roleInitials, accountSubtitle, onClose, collapsed, mounted,
}: SidebarFooterProps) {
  const router = useRouter()
  const [accountOpen, setAccountOpen] = useState(false)
  const accountBtnRef = useRef<HTMLButtonElement>(null)
  const [accountTooltipY, setAccountTooltipY] = useState(0)
  const [showAccountTooltip, setShowAccountTooltip] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/lms/auth/signout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <div className="shrink-0 border-t border-white/8 p-2">
        {collapsed ? (
          <button
            ref={accountBtnRef}
            onMouseEnter={() => {
              if (accountBtnRef.current) {
                const rect = accountBtnRef.current.getBoundingClientRect()
                setAccountTooltipY(rect.top + rect.height / 2)
              }
              setShowAccountTooltip(true)
            }}
            onMouseLeave={() => setShowAccountTooltip(false)}
            onClick={() => setAccountOpen(v => !v)}
            className="flex w-full items-center justify-center rounded-lg p-2"
          >
            <div
              className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#FF8A1F,#163560)' }}
            >
              {roleInitials}
            </div>
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
              <div
                className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#FF8A1F,#163560)' }}
              >
                {roleInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-white/80 truncate">{roleLabel}</p>
                <p className="text-[10px] text-white/30 truncate">{accountSubtitle}</p>
              </div>
              <button
                onClick={() => setAccountOpen(v => !v)}
                title="Account settings"
                className={[
                  "shrink-0 transition-colors",
                  accountOpen ? "text-white/60" : "text-white/25 hover:text-white/60",
                ].join(" ")}
              >
                <ISettings />
              </button>
            </div>

            <AnimatePresence initial={false}>
              {accountOpen && (
                <motion.div
                  key="sidebar-account-dropdown"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="mt-0.5 space-y-0.5 ps-2">
                    <Link
                      href="/account/password"
                      onClick={onClose}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[12px] font-medium text-white/30 transition-all duration-150 hover:bg-white/5 hover:text-white/60"
                    >
                      <IPassword />
                      Change Password
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[12px] font-medium text-[#F87171]/60 transition-all duration-150 hover:bg-white/5 hover:text-[#F87171]"
                    >
                      <ILogout />
                      Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Tooltip for collapsed account button */}
      {collapsed && mounted && showAccountTooltip && createPortal(
        <div
          style={{
            position: 'fixed',
            left: '64px',
            top: `${accountTooltipY}px`,
            transform: 'translateY(-50%)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
          className="rounded-lg bg-[#0B1F3A] border border-white/10 px-2.5 py-1.5 text-[12px] font-medium text-white shadow-xl whitespace-nowrap"
        >
          Account
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-[#0B1F3A]" />
        </div>,
        document.body
      )}
    </>
  )
}

// ── PortalSidebarContent ───────────────────────────────────────────────────────

interface PortalSidebarContentProps {
  sections:         PortalNavSection[]
  roleLabel:        string
  roleInitials:     string
  accountSubtitle:  string
  onClose?:         () => void
  collapsed:        boolean
  onToggleCollapse: () => void
}

function PortalSidebarContent({
  sections, roleLabel, roleInitials, accountSubtitle,
  onClose, collapsed, onToggleCollapse,
}: PortalSidebarContentProps) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [tooltip, setTooltip] = useState<{ label: string; y: number } | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const isActive = (item: PortalNavItem): boolean => {
    const hrefPath = item.href.split('?')[0]
    if (item.exact) return pathname === hrefPath
    if (item.matchPatterns?.length) {
      return item.matchPatterns.some(p => pathname === p || pathname.startsWith(p + '/'))
    }
    return pathname === hrefPath || pathname.startsWith(hrefPath + '/')
  }

  const tooltipProps = {
    onShowTooltip: (label: string, y: number) => collapsed && setTooltip({ label, y }),
    onHideTooltip: () => setTooltip(null),
  }

  return (
    <div className="flex h-full min-h-0 flex-col">

      {/* Logo + collapse toggle */}
      <div className={[
        "flex h-16 shrink-0 items-center border-b border-white/8",
        collapsed ? "justify-center px-2" : "justify-between px-4",
      ].join(" ")}>
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white">
              <Image src="/logo.png" alt="Robocode" width={24} height={24} className="h-6 w-6 object-contain" />
            </div>
            <span className="font-orbitron text-[12px] font-bold tracking-[.04em] text-white">ROBOCODE</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/30 hover:bg-white/10 hover:text-white/60 transition"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </div>

      {/* System status pulse */}
      <div className={[
        "shrink-0 flex items-center border-b border-white/6",
        collapsed ? "justify-center px-2 py-1.5" : "gap-1.5 px-4 py-1.5",
      ].join(" ")}>
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#10B981]"
          style={{ animation: 'rcpulse 2s infinite' }}
        />
        {!collapsed && (
          <span className="text-[9px] font-medium text-white/35">All Systems Operational</span>
        )}
      </div>

      {/* Role label */}
      {!collapsed && (
        <div className="shrink-0 px-5 pt-4 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">
            {roleLabel}
          </p>
        </div>
      )}

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {sections.map((section, idx) => (
          <SidebarSection
            key={section.title ?? '__top'}
            title={section.title}
            first={idx === 0}
            collapsed={collapsed}
          >
            {section.items.map(item => (
              <SidebarNavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={isActive(item)}
                onClose={onClose}
                collapsed={collapsed}
                {...tooltipProps}
              />
            ))}
          </SidebarSection>
        ))}
      </nav>

      {/* Footer */}
      <SidebarFooter
        roleLabel={roleLabel}
        roleInitials={roleInitials}
        accountSubtitle={accountSubtitle}
        onClose={onClose}
        collapsed={collapsed}
        mounted={mounted}
      />

      {/* Tooltip portal for collapsed nav items */}
      {collapsed && mounted && tooltip && createPortal(
        <div
          style={{
            position: 'fixed',
            left: '64px',
            top: `${tooltip.y}px`,
            transform: 'translateY(-50%)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
          className="rounded-lg bg-[#0B1F3A] border border-white/10 px-2.5 py-1.5 text-[12px] font-medium text-white shadow-xl whitespace-nowrap"
        >
          {tooltip.label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-[#0B1F3A]" />
        </div>,
        document.body
      )}

    </div>
  )
}

// ── PortalSidebar (public component) ──────────────────────────────────────────

export interface PortalSidebarProps {
  sections:            PortalNavSection[]
  roleLabel:           string
  roleInitials:        string
  accountSubtitle?:    string
  isOpen:              boolean
  onClose:             () => void
  /** Bottom offset for mobile — use when a bottom nav bar sits above the safe area. */
  mobileBottomOffset?: string
}

export default function PortalSidebar({
  sections,
  roleLabel,
  roleInitials,
  accountSubtitle = 'Portal Account',
  isOpen,
  onClose,
  mobileBottomOffset,
}: PortalSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  const contentProps = { sections, roleLabel, roleInitials, accountSubtitle }

  return (
    <>
      {/* Desktop sidebar — width animated on collapse */}
      <aside className={[
        "hidden shrink-0 bg-[#0B1F3A] transition-[width] duration-200 ease-in-out md:flex md:flex-col",
        collapsed ? "w-14" : "w-56",
      ].join(" ")}>
        <PortalSidebarContent
          {...contentProps}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
      </aside>

      {/* Mobile slide-in sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            key="portal-mobile-sidebar"
            initial={{ x: -224 }}
            animate={{ x: 0 }}
            exit={{ x: -224 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-0 left-0 z-30 w-56 bg-[#0B1F3A] md:hidden"
            style={mobileBottomOffset ? { bottom: mobileBottomOffset } : { bottom: 0 }}
          >
            <PortalSidebarContent
              {...contentProps}
              onClose={onClose}
              collapsed={false}
              onToggleCollapse={() => {}}
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
