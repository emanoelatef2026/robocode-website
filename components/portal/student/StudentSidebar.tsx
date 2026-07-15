"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"

// ── Icons (20×20 Heroicons solid) ───────────────────────────────────────────

const IC = {
  dashboard: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
  ),
  sessions: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.5 2.5a1 1 0 001.414-1.414L11 9.586V6z" clipRule="evenodd" />
    </svg>
  ),
  assignments: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
    </svg>
  ),
  attendance: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  certificates: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  ),
  portfolio: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
    </svg>
  ),
  videos: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
    </svg>
  ),
  leaderboard: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
    </svg>
  ),
  journey: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
    </svg>
  ),
  achievements: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  ),
  evaluations: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
      <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
    </svg>
  ),
  competitions: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M6 3a1 1 0 00-1 1v1a1 1 0 001 1h.01A5.002 5.002 0 004 10c0 1.7.83 3.207 2.106 4.138A3.995 3.995 0 004 17.5V18a1 1 0 001 1h10a1 1 0 001-1v-.5a3.995 3.995 0 00-2.106-3.362A4.998 4.998 0 0016 10a5.002 5.002 0 00-3.01-4H14a1 1 0 001-1V4a1 1 0 00-1-1H6zm2 6a2 2 0 104 0 2 2 0 00-4 0z" clipRule="evenodd" />
    </svg>
  ),
  notes: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 8a1 1 0 100 2h6a1 1 0 100-2H7zm0-3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
  ),
  password: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
    </svg>
  ),
  chevron: (active: boolean) => (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-3 w-3 shrink-0 transition-transform duration-200 ${active ? "rotate-180" : ""}`}
    >
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  ),
}

// ── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Dashboard",    href: "/portal/student",             icon: IC.dashboard,    exact: true  },
  { label: "Journey",      href: "/portal/student/journey",     icon: IC.journey,      exact: false },
  { label: "Achievements", href: "/portal/student/achievements",icon: IC.achievements, exact: false },
  { label: "Evaluations",  href: "/portal/student/evaluations", icon: IC.evaluations,  exact: false },
  { label: "Competitions", href: "/portal/student/competitions",icon: IC.competitions, exact: false },
  { label: "Notes",        href: "/portal/student/notes",       icon: IC.notes,        exact: false },
  { label: "Sessions",     href: "/portal/student/history",     icon: IC.sessions,     exact: false },
  { label: "Assignments",  href: "/portal/student/assignments", icon: IC.assignments,  exact: false },
  { label: "Attendance",   href: "/portal/student/attendance",  icon: IC.attendance,   exact: false },
  { label: "Certificates", href: "/portal/student/certificates",icon: IC.certificates, exact: false },
  { label: "Portfolio",    href: "/portal/student/portfolio",   icon: IC.portfolio,    exact: false },
  { label: "My Videos",    href: "/portal/student/videos",      icon: IC.videos,       exact: false },
  { label: "Leaderboard",  href: "/portal/student/leaderboard", icon: IC.leaderboard,  exact: false },
]

// ── Nav link ─────────────────────────────────────────────────────────────────

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
        "flex items-center gap-[10px] rounded-[9px] px-[10px] py-[9px] text-[12.5px] transition-all duration-150",
        active
          ? "bg-[rgba(255,138,31,.15)] font-bold text-[#FF8A1F]"
          : "font-medium text-white/52 hover:bg-white/5 hover:text-white/80",
      ].join(" ")}
    >
      <span className={active ? "text-[#FF8A1F]" : "text-white/35"}>{icon}</span>
      <span className="flex-1 leading-none">{label}</span>
      {active && (
        <span className="ms-auto h-1.5 w-1.5 rounded-full bg-[#FF8A1F]" />
      )}
    </Link>
  )
}

// ── Nav content (shared between desktop and mobile drawer) ───────────────────

interface NavContentProps {
  onClose?:       () => void
  studentName?:   string
  groupName?:     string
  currentLevel?:  number
  totalXp?:       number
  xpProgressPct?: number
  xpToNextLevel?: number
}

function NavContent({
  onClose,
  studentName,
  groupName,
  currentLevel = 1,
  totalXp = 0,
  xpProgressPct = 0,
  xpToNextLevel = 500,
}: NavContentProps) {
  const pathname     = usePathname()
  const router       = useRouter()
  const [accountOpen, setAccountOpen] = useState(false)

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")

  const handleLogout = async () => {
    await fetch("/api/lms/auth/signout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  const initials = studentName
    ? studentName.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
    : "S"

  return (
    <div className="flex h-full min-h-0 flex-col">

      {/* Logo */}
      <div className="flex shrink-0 items-center gap-[9px] px-2 pb-5 pt-[18px]">
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-white">
          <Image src="/logo.png" alt="Robocode" width={23} height={23} className="h-[23px] w-[23px] object-contain" />
        </div>
        <span
          className="text-[12px] font-bold tracking-[.04em] text-white"
          style={{ fontFamily: "var(--font-orbitron)" }}
        >
          ROBOCODE
        </span>
      </div>

      {/* Section label */}
      <p className="shrink-0 px-[8px] pb-[7px] text-[8.5px] font-bold uppercase tracking-[.2em] text-white/25">
        Menu
      </p>

      {/* Nav items */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        {NAV_ITEMS.map(({ label, href, icon, exact }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={isActive(href, exact)}
            onClose={onClose}
          />
        ))}
      </nav>

      {/* XP widget + user footer */}
      <div className="shrink-0 border-t border-white/8 px-3 pb-[18px] pt-3">

        {/* XP mini-widget */}
        <div className="mb-[10px] rounded-[10px] bg-white/5 px-[10px] py-[10px]">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px]">⭐</span>
              <span className="text-[10px] font-bold text-[#FFB15A]">LV.{currentLevel}</span>
            </div>
            <span
              className="text-[10px] font-bold text-[#FFB15A]"
              style={{ fontFamily: "var(--font-orbitron)" }}
            >
              {totalXp.toLocaleString()} XP
            </span>
          </div>
          <div className="h-[5px] overflow-hidden rounded-sm bg-white/10">
            <div
              className="h-full rounded-sm"
              style={{
                width: `${xpProgressPct}%`,
                background: "linear-gradient(90deg, #FF8A1F, #FFD166, #FF8A1F)",
                backgroundSize: "200%",
                animation: "xpglow 3s ease infinite",
              }}
            />
          </div>
          <p className="mt-1 text-[9px] text-white/30">{xpToNextLevel.toLocaleString()} XP to next level</p>
        </div>

        {/* User row */}
        <div className="flex items-center gap-[9px] px-1 py-1">
          <div
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, #FF8A1F, #0B1F3A)" }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] font-semibold text-white">
              {studentName ?? "Student"}
            </p>
            <p className="text-[9.5px] text-white/40">{groupName ?? "Student"}</p>
          </div>
        </div>

        {/* Account collapsible */}
        <button
          onClick={() => setAccountOpen((v) => !v)}
          className="mt-1.5 flex w-full items-center gap-2 rounded-[9px] px-[10px] py-2 text-[11.5px] font-medium text-white/30 transition hover:bg-white/5 hover:text-white/60"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
          </svg>
          <span className="flex-1 text-start">My Account</span>
          {IC.chevron(accountOpen)}
        </button>

        <AnimatePresence initial={false}>
          {accountOpen && (
            <motion.div
              key="account"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="mt-0.5 space-y-0.5 ps-3">
                <Link
                  href="/account/password"
                  onClick={onClose}
                  className="flex w-full items-center gap-2 rounded-[9px] px-[10px] py-2 text-[11.5px] font-medium text-white/30 transition hover:bg-white/5 hover:text-white/60"
                >
                  {IC.password}
                  Change Password
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-[9px] px-[10px] py-2 text-[11.5px] font-medium text-[#F87171]/60 transition hover:bg-white/5 hover:text-[#F87171]"
                >
                  {IC.logout}
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

// ── Main export ──────────────────────────────────────────────────────────────

interface Props {
  isOpen:          boolean
  onClose:         () => void
  studentName?:    string
  groupName?:      string
  currentLevel?:   number
  totalXp?:        number
  xpProgressPct?:  number
  xpToNextLevel?:  number
}

export default function StudentSidebar({
  isOpen,
  onClose,
  studentName,
  groupName,
  currentLevel,
  totalXp,
  xpProgressPct,
  xpToNextLevel,
}: Props) {
  const xpProps = { currentLevel, totalXp, xpProgressPct, xpToNextLevel }
  return (
    <>
      {/* Desktop permanent sidebar — fixed, 200px */}
      <aside className="fixed bottom-0 start-0 top-0 z-30 hidden w-[200px] flex-col bg-[#0B1F3A] md:flex">
        <NavContent studentName={studentName} groupName={groupName} {...xpProps} />
      </aside>

      {/* Mobile animated drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            key="student-mobile-sidebar"
            initial={{ x: -200 }}
            animate={{ x: 0 }}
            exit={{ x: -200 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed start-0 top-0 z-30 w-[200px] bg-[#0B1F3A] md:hidden"
            style={{ bottom: "calc(56px + max(8px, env(safe-area-inset-bottom)))" }}
          >
            <NavContent onClose={onClose} studentName={studentName} groupName={groupName} {...xpProps} />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
