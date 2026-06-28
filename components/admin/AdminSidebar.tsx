"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "sidebar_collapsed";

// ── Icons ─────────────────────────────────────────────────────────────────────

const I = {
  assignments: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>,
  dashboard:   <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>,
  students:    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838l-2.727 1.17 1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" /><path d="M3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zm5.99 7.176A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" /></svg>,
  parents:     <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>,
  instructors: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>,
  teamLeaders: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" /></svg>,
  staff:       <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>,
  groups:      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z" /></svg>,
  courses:     <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" /></svg>,
  certs:       <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>,
  schedules:   <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>,
  attendance:  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
  leads:       <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" /></svg>,
  comms:       <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" /><path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" /></svg>,
  payroll:     <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" /></svg>,
  collections: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>,
  financeCenter: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>,
  analytics:   <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>,
  reports:     <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>,
  branches:    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>,
  readiness:   <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
  health:      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>,
  settings:    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>,
  password:    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>,
  logout:      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" /></svg>,
}

// ── Nav definition ─────────────────────────────────────────────────────────────

interface NavItem {
  label:           string
  href:            string
  icon:            React.ReactNode
  permission?:     string
  superAdminOnly?: boolean
}

interface NavSection {
  title: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: '',
    items: [
      { label: 'Dashboard', href: '/admin', icon: I.dashboard },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Leads',        href: '/admin/leads',         icon: I.leads                                           },
      { label: 'Students',     href: '/admin/students',      icon: I.students,     permission: 'manage_students'    },
      { label: 'Parents',      href: '/admin/parents',       icon: I.parents,      permission: 'manage_parents'     },
      { label: 'Instructors',  href: '/admin/instructors',   icon: I.instructors,  permission: 'manage_instructors' },
      { label: 'Team Leaders', href: '/admin/team-leaders',  icon: I.teamLeaders,  superAdminOnly: true             },
      { label: 'Staff',        href: '/admin/staff',         icon: I.staff,        superAdminOnly: true             },
    ],
  },
  {
    title: 'Academics',
    items: [
      { label: 'Groups',       href: '/admin/groups',        icon: I.groups,  permission: 'manage_groups'       },
      { label: 'Courses',      href: '/admin/courses',       icon: I.courses, permission: 'manage_courses'      },
      { label: 'Certificates', href: '/admin/certificates',  icon: I.certs,   permission: 'manage_certificates' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Payroll',        href: '/admin/payroll',        icon: I.payroll,       permission: 'manage_financials' },
      { label: 'Collections',   href: '/admin/finance',        icon: I.collections,  permission: 'manage_financials' },
      { label: 'Finance Center', href: '/admin/finance-center', icon: I.financeCenter, superAdminOnly: true            },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Attendance',  href: '/admin/attendance',     icon: I.attendance,   permission: 'manage_attendance' },
      { label: 'Assignments', href: '/admin/assignments',    icon: I.assignments                                    },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Analytics', href: '/admin/analytics', icon: I.analytics                    },
      { label: 'Reports',   href: '/admin/executive', icon: I.reports,  superAdminOnly: true },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Branches',             href: '/admin/branches',             icon: I.branches,  superAdminOnly: true },
      { label: 'System Health',        href: '/admin/system-health',        icon: I.health,    superAdminOnly: true },
      { label: 'Production Readiness', href: '/admin/production-readiness', icon: I.readiness, superAdminOnly: true },
    ],
  },
]

// ── Chevron icons ──────────────────────────────────────────────────────────────

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

// ── NavLink ────────────────────────────────────────────────────────────────────

interface NavLinkProps {
  href:           string
  label:          string
  icon:           React.ReactNode
  active:         boolean
  onClose?:       () => void
  collapsed:      boolean
  onShowTooltip:  (label: string, y: number) => void
  onHideTooltip:  () => void
}

function NavLink({ href, label, icon, active, onClose, collapsed, onShowTooltip, onHideTooltip }: NavLinkProps) {
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

// ── NavContent ─────────────────────────────────────────────────────────────────

interface NavContentProps {
  onClose?:         () => void
  role:             string
  permissions:      string[]
  collapsed:        boolean
  onToggleCollapse: () => void
}

function NavContent({ onClose, role, permissions, collapsed, onToggleCollapse }: NavContentProps) {
  const pathname     = usePathname()
  const router       = useRouter()
  const isSuperAdmin = role === 'super_admin'
  const [accountOpen, setAccountOpen] = useState(false)
  const [mounted, setMounted]         = useState(false)
  const [tooltip, setTooltip]         = useState<{ label: string; y: number } | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  const handleLogout = async () => {
    await fetch('/api/lms/auth/signout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Super Admin',
    team_leader: 'Team Leader',
    instructor:  'Instructor',
    student:     'Student',
    parent:      'Parent',
  }

  const ROLE_INITIALS: Record<string, string> = {
    super_admin: 'SA',
    team_leader: 'TL',
    instructor:  'IN',
    student:     'ST',
    parent:      'PA',
  }

  const visibleSections = NAV_SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (item.superAdminOnly) return isSuperAdmin
        if (item.permission)     return permissions.includes(item.permission)
        return true
      }),
    }))
    .filter(section => section.items.length > 0)

  const tooltipProps = {
    onShowTooltip: (label: string, y: number) => collapsed && setTooltip({ label, y }),
    onHideTooltip: () => setTooltip(null),
  }

  // Account icon ref for collapsed tooltip
  const accountBtnRef = useRef<HTMLButtonElement>(null)
  const [accountTooltipY, setAccountTooltipY] = useState(0)
  const [showAccountTooltip, setShowAccountTooltip] = useState(false)

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
            {ROLE_LABELS[role] ?? role}
          </p>
        </div>
      )}

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {visibleSections.map((section, idx) => (
          <div key={section.title || '__top'} className={idx === 0 ? "mb-1" : "mt-4"}>
            {section.title && !collapsed && (
              <p className="mb-1.5 px-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25">
                {section.title}
              </p>
            )}
            {section.title && collapsed && (
              <div className="my-2 mx-1.5 h-px bg-white/8" />
            )}
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={isActive(item.href)}
                  onClose={onClose}
                  collapsed={collapsed}
                  {...tooltipProps}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer — User */}
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
              {ROLE_INITIALS[role] ?? 'SA'}
            </div>
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
              <div
                className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#FF8A1F,#163560)' }}
              >
                {ROLE_INITIALS[role] ?? 'SA'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-white/80 truncate">{ROLE_LABELS[role] ?? role}</p>
                <p className="text-[10px] text-white/30 truncate">Admin Account</p>
              </div>
              <button
                onClick={() => setAccountOpen(v => !v)}
                title="Account settings"
                className={[
                  "shrink-0 transition-colors",
                  accountOpen ? "text-white/60" : "text-white/25 hover:text-white/60",
                ].join(" ")}
              >
                {I.settings}
              </button>
            </div>

            <AnimatePresence initial={false}>
              {accountOpen && (
                <motion.div
                  key="account-items"
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
                      {I.password}
                      Change Password
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[12px] font-medium text-[#F87171]/60 transition-all duration-150 hover:bg-white/5 hover:text-[#F87171]"
                    >
                      {I.logout}
                      Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Portal tooltip for collapsed nav items */}
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

      {/* Portal tooltip for account button */}
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
    </div>
  )
}

// ── AdminSidebar ───────────────────────────────────────────────────────────────

interface SidebarProps {
  isOpen:      boolean
  onClose:     () => void
  role:        string
  permissions: string[]
}

export default function AdminSidebar({ isOpen, onClose, role, permissions }: SidebarProps) {
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

  return (
    <>
      {/* Desktop sidebar — always visible, width controlled by collapsed state */}
      <aside className={[
        "hidden shrink-0 bg-[#0B1F3A] transition-[width] duration-200 ease-in-out md:flex md:flex-col",
        collapsed ? "w-14" : "w-56",
      ].join(" ")}>
        <NavContent
          role={role}
          permissions={permissions}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
      </aside>

      {/* Mobile slide-in sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            key="mobile-sidebar"
            initial={{ x: -224 }}
            animate={{ x: 0 }}
            exit={{ x: -224 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 left-0 z-30 w-56 bg-[#0B1F3A] md:hidden"
          >
            <NavContent
              onClose={onClose}
              role={role}
              permissions={permissions}
              collapsed={false}
              onToggleCollapse={() => {}}
            />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
