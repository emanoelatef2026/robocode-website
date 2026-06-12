"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { INSTRUCTOR_NAV, INSTRUCTOR_NAV_SECTIONS } from "@/modules/instructor-portal/navigation"

// ── Icons (16 px, fill="currentColor") ────────────────────────────────────────

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

const I = {
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
}

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

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")

  const handleLogout = async () => {
    await fetch("/api/lms/auth/signout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  // Build a lookup for quick access
  const navByKey = Object.fromEntries(INSTRUCTOR_NAV.map((n) => [n.key, n]))

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-white/8 px-5">
        <Image src="/logo.png" alt="Robocode" width={120} height={52} className="h-auto w-24 brightness-0 invert" />
      </div>

      {/* Role badge */}
      <div className="px-5 pt-4 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">Instructor</p>
      </div>

      {/* Grouped nav — derived from canonical config */}
      <nav className="flex-1 overflow-y-auto px-3 pb-2">
        {INSTRUCTOR_NAV_SECTIONS.map((section, idx) => (
          <div key={section.title ?? "__top"} className={idx === 0 ? "mb-1" : "mt-5"}>
            {section.title && (
              <p className="mb-1.5 px-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.keys.map((key) => {
                const item = navByKey[key]
                if (!item) return null
                return (
                  <NavLink
                    key={key}
                    href={item.href}
                    label={item.label}
                    icon={ICONS[key]}
                    active={isActive(item.href, item.exact)}
                    onClose={onClose}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/8 p-4 space-y-1">
        <Link
          href="/account/password"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-white/35 transition-all duration-150 hover:bg-white/5 hover:text-white/70"
        >
          {I.password}
          Change Password
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-white/35 transition-all duration-150 hover:bg-white/5 hover:text-white/70"
        >
          {I.logout}
          Logout
        </button>
      </div>
    </div>
  )
}

// ── InstructorSidebar ─────────────────────────────────────────────────────────

interface Props {
  isOpen:  boolean
  onClose: () => void
}

export default function InstructorSidebar({ isOpen, onClose }: Props) {
  return (
    <>
      <aside className="hidden w-56 shrink-0 bg-[#0B1F3A] md:flex md:flex-col">
        <NavContent />
      </aside>

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            key="instr-mobile-sidebar"
            initial={{ x: -224 }}
            animate={{ x: 0 }}
            exit={{ x: -224 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 left-0 z-30 w-56 bg-[#0B1F3A] md:hidden"
          >
            <NavContent onClose={onClose} />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
