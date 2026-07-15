"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { PortalLogo } from "@/components/shared/layout/PortalLogo"
import { PortalUserMenu } from "@/components/shared/layout/PortalUserMenu"
import { Icons } from "@/components/shared/layout/icons"
import type { PortalRole } from "@/components/shared/layout/roles"

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

// ── PortalSidebarContent ───────────────────────────────────────────────────────

interface PortalSidebarContentProps {
  sections:         PortalNavSection[]
  role:             PortalRole
  name?:            string | null
  subtitle?:        string | null
  onClose?:         () => void
  collapsed:        boolean
  onToggleCollapse: () => void
  /** Portal-specific content rendered above "My Account" — e.g. Student's XP widget. Hidden while collapsed. */
  footerExtra?:     React.ReactNode
}

function PortalSidebarContent({
  sections, role, name, subtitle,
  onClose, collapsed, onToggleCollapse, footerExtra,
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
        "flex shrink-0 items-center border-b border-white/8",
        collapsed ? "justify-center px-2 py-2" : "justify-between pe-2",
      ].join(" ")}>
        {!collapsed && <PortalLogo />}
        <button
          onClick={onToggleCollapse}
          className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/10 hover:text-white/60 md:flex"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <Icons.chevronRight className="h-3.5 w-3.5" /> : <Icons.chevronLeft className="h-3.5 w-3.5" />}
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

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-2 pt-2 pb-2">
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

      {!collapsed && footerExtra && (
        <div className="shrink-0 border-t border-white/8 px-3 pt-3">{footerExtra}</div>
      )}

      {/* Footer / My Account */}
      <PortalUserMenu
        role={role}
        name={name}
        subtitle={subtitle}
        collapsed={collapsed}
        mounted={mounted}
        onNavigate={onClose}
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
  sections:  PortalNavSection[]
  role:      PortalRole
  /** Real display identity (name or email) — falls back to the role label when omitted. */
  name?:     string | null
  /** Third line under the identity — e.g. a group/branch name. */
  subtitle?:    string | null
  isOpen:       boolean
  onClose:      () => void
  /** Portal-specific content above "My Account" — e.g. Student's XP widget. */
  footerExtra?: React.ReactNode
}

export default function PortalSidebar({
  sections,
  role,
  name,
  subtitle,
  isOpen,
  onClose,
  footerExtra,
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

  const contentProps = { sections, role, name, subtitle, footerExtra }

  return (
    <>
      {/* Desktop sidebar — width animated on collapse */}
      <aside className={[
        "hidden shrink-0 bg-[#0B1F3A] transition-[width] duration-200 ease-in-out md:flex md:flex-col",
        collapsed ? "w-(--sidebar-width-collapsed)" : "w-(--sidebar-width)",
      ].join(" ")}>
        <PortalSidebarContent
          {...contentProps}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
      </aside>

      {/* Mobile slide-in sidebar — always stops above the fixed bottom nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            key="portal-mobile-sidebar"
            initial={{ x: -224 }}
            animate={{ x: 0 }}
            exit={{ x: -224 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="drawer-safe-bottom fixed top-0 left-0 z-(--z-drawer) w-(--drawer-width) bg-[#0B1F3A] md:hidden"
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
