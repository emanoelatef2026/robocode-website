"use client"

import PortalSidebar, { type PortalNavSection } from "@/components/shared/sidebar/PortalSidebar"
import { INSTRUCTOR_NAV, INSTRUCTOR_NAV_SECTIONS } from "@/modules/instructor-portal/navigation"

// ── Icons (20×20, fill="currentColor") ───────────────────────────────────────

const ICONS: Record<string, React.ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
  ),
  groups: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z" />
    </svg>
  ),
  homework: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
  ),
}

// ── Convert instructor nav config to shared format ────────────────────────────

const navByKey = Object.fromEntries(INSTRUCTOR_NAV.map(n => [n.key, n]))

const SECTIONS: PortalNavSection[] = INSTRUCTOR_NAV_SECTIONS.map(s => ({
  title: s.title,
  items: [...s.keys].map(key => {
    const item = navByKey[key]!
    return {
      label: item.label,
      href:  item.href,
      icon:  ICONS[key],
      exact: item.exact,
    }
  }),
}))

// ── InstructorSidebar ─────────────────────────────────────────────────────────

interface Props {
  isOpen:  boolean
  onClose: () => void
}

export default function InstructorSidebar({ isOpen, onClose }: Props) {
  return (
    <PortalSidebar
      sections={SECTIONS}
      roleLabel="Instructor"
      roleInitials="IN"
      accountSubtitle="Instructor Portal"
      isOpen={isOpen}
      onClose={onClose}
      mobileBottomOffset="calc(60px + max(8px, env(safe-area-inset-bottom)))"
    />
  )
}
