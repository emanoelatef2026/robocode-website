"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

// ── Icons ─────────────────────────────────────────────────────────────────────

const I = {
  dashboard: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
  ),
  leads: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
    </svg>
  ),
  students: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838l-2.727 1.17 1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
      <path d="M3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zm5.99 7.176A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
    </svg>
  ),
  parents: (
    // Two overlapping ovals — distinct from groups
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  ),
  instructors: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
  ),
  groups: (
    // 6-person grid — distinct from parents
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z" />
    </svg>
  ),
  courses: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
    </svg>
  ),
  certificates: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  ),
  satisfaction: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
    </svg>
  ),
  password: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
    </svg>
  ),
  payroll: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
    </svg>
  ),
}

// ── Nav config ────────────────────────────────────────────────────────────────

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  exact?: boolean
  /** Extra pathname prefixes that also activate this item (e.g. for query-param hrefs) */
  matchPatterns?: string[]
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/portal/team-leader", icon: I.dashboard, exact: true },
    ],
  },
  {
    title: "People",
    items: [
      { label: "Leads",       href: "/portal/team-leader/leads",       icon: I.leads },
      { label: "Students",    href: "/portal/team-leader/students",    icon: I.students },
      { label: "Parents",     href: "/portal/team-leader/parents",     icon: I.parents },
      { label: "Instructors", href: "/portal/team-leader/instructors", icon: I.instructors },
    ],
  },
  {
    title: "Academy",
    items: [
      { label: "Groups",       href: "/portal/team-leader/groups",       icon: I.groups },
      { label: "Courses",      href: "/portal/team-leader/courses",      icon: I.courses },
      { label: "Certificates", href: "/portal/team-leader/certificates", icon: I.certificates },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Payroll", href: "/portal/team-leader/instructor-payroll", icon: I.payroll },
    ],
  },
  {
    title: "Engagement",
    items: [
      {
        label: "Satisfaction",
        href: "/portal/team-leader/parent-feedback?tab=reviews",
        icon: I.satisfaction,
        matchPatterns: [
          "/portal/team-leader/parent-feedback",
          "/portal/team-leader/parent-satisfaction",
        ],
      },
      { label: "Analytics", href: "/portal/team-leader/analytics", icon: I.analytics },
    ],
  },
]

// ── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({
  href, label, icon, active, onClose,
}: {
  href: string; label: string; icon: React.ReactNode; active: boolean; onClose?: () => void
}) {
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
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#FF8A1F]" />}
    </Link>
  )
}

// ── NavContent ────────────────────────────────────────────────────────────────

function NavContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [accountOpen, setAccountOpen] = useState(false)

  const isActive = (item: NavItem): boolean => {
    const hrefPath = item.href.split("?")[0]
    if (item.exact) return pathname === hrefPath
    if (item.matchPatterns?.length) {
      return item.matchPatterns.some(p => pathname === p || pathname.startsWith(p + "/"))
    }
    return pathname === hrefPath || pathname.startsWith(hrefPath + "/")
  }

  const handleLogout = async () => {
    await fetch("/api/lms/auth/signout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center border-b border-white/8 px-5">
        <Image src="/logo.png" alt="Robocode" width={120} height={52} className="h-auto w-24 brightness-0 invert" />
      </div>

      {/* Role badge */}
      <div className="shrink-0 px-5 pt-4 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">Team Leader</p>
      </div>

      {/* Grouped nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-2">
        {NAV_SECTIONS.map((section, idx) => (
          <div key={section.title ?? "__top"} className={idx === 0 ? "mb-1" : "mt-5"}>
            {section.title && (
              <p className="mb-1.5 px-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={isActive(item)}
                  onClose={onClose}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/8 p-3 shrink-0">
        {/* My Account toggle */}
        <button
          onClick={() => setAccountOpen(v => !v)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-white/35 transition-all duration-150 hover:bg-white/5 hover:text-white/70"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
          </svg>
          <span className="flex-1 text-left">My Account</span>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-3 w-3 shrink-0 transition-transform duration-200 ${accountOpen ? "rotate-180" : ""}`}
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Sub-items */}
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
              <div className="mt-0.5 space-y-0.5 pl-3">
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
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[12px] font-medium text-red-400/60 transition-all duration-150 hover:bg-white/5 hover:text-red-400"
                >
                  {I.logout}
                  Logout
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── TLSidebar ─────────────────────────────────────────────────────────────────

interface Props {
  isOpen:  boolean
  onClose: () => void
}

export default function TLSidebar({ isOpen, onClose }: Props) {
  return (
    <>
      <aside className="hidden w-56 shrink-0 bg-[#0B1F3A] md:flex md:flex-col">
        <NavContent />
      </aside>

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            key="tl-mobile-sidebar"
            initial={{ x: -224 }}
            animate={{ x: 0 }}
            exit={{ x: -224 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-0 left-0 z-30 w-56 bg-[#0B1F3A] md:hidden"
            style={{ bottom: "calc(60px + max(8px, env(safe-area-inset-bottom)))" }}
          >
            <NavContent onClose={onClose} />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
