"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"

// ── Icons ──────────────────────────────────────────────────────────────────────

const I = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
      <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
    </svg>
  ),
  leads: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path fillRule="evenodd" d="M3 2.25a.75.75 0 0 0 0 1.5v16.5h-.75a.75.75 0 0 0 0 1.5H15v-18a.75.75 0 0 0 0-1.5H3ZM6.75 19.5v-2.25a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-.75.75h-3a.75.75 0 0 1-.75-.75ZM6 6.75A.75.75 0 0 1 6.75 6h.75a.75.75 0 0 1 0 1.5h-.75A.75.75 0 0 1 6 6.75ZM6.75 9a.75.75 0 0 0 0 1.5h.75a.75.75 0 0 0 0-1.5h-.75ZM6 12.75a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 0 1.5h-.75a.75.75 0 0 1-.75-.75ZM10.5 6a.75.75 0 0 0 0 1.5h.75a.75.75 0 0 0 0-1.5h-.75Zm-.75 3.75A.75.75 0 0 1 10.5 9h.75a.75.75 0 0 1 0 1.5h-.75a.75.75 0 0 1-.75-.75ZM10.5 12a.75.75 0 0 0 0 1.5h.75a.75.75 0 0 0 0-1.5h-.75ZM16.5 6.75v15h5.25a.75.75 0 0 0 0-1.5H21v-12a.75.75 0 0 0 0-1.5h-4.5Zm1.5 4.5a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 0 1.5H18.75a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h.008a.75.75 0 0 0 0-1.5H18.75Z" clipRule="evenodd" />
    </svg>
  ),
  groups: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z" clipRule="evenodd" />
      <path d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.567.2-1.156.349-1.764.441Z" />
    </svg>
  ),
  instructors: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path fillRule="evenodd" d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
    </svg>
  ),
  password: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 0 0 6 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V15a.75.75 0 0 1 1.5 0v3.75a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V5.25a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V9A.75.75 0 0 1 15 9V5.25a1.5 1.5 0 0 0-1.5-1.5h-6Zm10.72 4.72a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06l1.72-1.72H9a.75.75 0 0 1 0-1.5h10.94l-1.72-1.72a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
  ),
}

// ── Config ─────────────────────────────────────────────────────────────────────

const PRIMARY = [
  { label: "Home",        href: "/portal/team-leader",             exact: true,  icon: I.dashboard   },
  { label: "Leads",       href: "/portal/team-leader/leads",       exact: false, icon: I.leads       },
  { label: "Groups",      href: "/portal/team-leader/groups",      exact: false, icon: I.groups      },
  { label: "Instructors", href: "/portal/team-leader/instructors", exact: false, icon: I.instructors },
] as const

const MORE_ITEMS = [
  { label: "Students",     href: "/portal/team-leader/students",                    emoji: "👨‍🎓" },
  { label: "Parents",      href: "/portal/team-leader/parents",                     emoji: "👨‍👧" },
  { label: "Courses",      href: "/portal/team-leader/courses",                     emoji: "📚" },
  { label: "Certificates", href: "/portal/team-leader/certificates",                emoji: "🏆" },
  { label: "Satisfaction", href: "/portal/team-leader/parent-feedback?tab=reviews", emoji: "⭐" },
] as const

// Routes that light up the "More" tab when active
const MORE_ACTIVE_PREFIXES = [
  "/portal/team-leader/students",
  "/portal/team-leader/parents",
  "/portal/team-leader/courses",
  "/portal/team-leader/certificates",
  "/portal/team-leader/parent-feedback",
  "/portal/team-leader/parent-satisfaction",
  "/portal/team-leader/analytics",
  "/portal/team-leader/assignments",
  "/portal/team-leader/finance",
  "/portal/team-leader/collections",
]

// ── Component ──────────────────────────────────────────────────────────────────

export default function TLBottomNav() {
  const pathname = usePathname()
  const router   = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + "/")
  }

  const moreActive =
    !PRIMARY.some(item => isActive(item.href, item.exact)) &&
    MORE_ACTIVE_PREFIXES.some(p => pathname === p || pathname.startsWith(p + "/"))

  async function handleLogout() {
    setMoreOpen(false)
    await fetch("/api/lms/auth/signout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <>
      {/* ── Primary tab bar ────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white border-t border-[#E2E8F0] bottom-nav-safe"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-5">
          {PRIMARY.map(item => {
            const active = isActive(item.href, item.exact)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "relative flex flex-col items-center justify-center gap-1 py-2 min-h-15 transition-colors",
                  active ? "text-[#FF8A1F]" : "text-[#94A3B8] active:text-[#64748B]",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-[#FF8A1F]" />
                )}
                {item.icon}
                <span className={`text-[10px] font-semibold leading-none ${active ? "text-[#FF8A1F]" : "text-[#94A3B8]"}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* More tab */}
          <button
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className={[
              "relative flex flex-col items-center justify-center gap-1 py-2 min-h-15 transition-colors",
              moreActive ? "text-[#FF8A1F]" : "text-[#94A3B8] active:text-[#64748B]",
            ].join(" ")}
          >
            {moreActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-[#FF8A1F]" />
            )}
            {I.more}
            <span className={`text-[10px] font-semibold leading-none ${moreActive ? "text-[#FF8A1F]" : "text-[#94A3B8]"}`}>
              More
            </span>
          </button>
        </div>
      </nav>

      {/* ── More bottom sheet ───────────────────────────────────────── */}
      <AnimatePresence>
        {moreOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="more-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/40 md:hidden"
              onClick={() => setMoreOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              key="more-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="More navigation"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white rounded-t-2xl shadow-2xl"
              style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-[#E2E8F0]" />
              </div>

              {/* Section label */}
              <div className="px-5 pb-2 pt-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#94A3B8]">More</p>
              </div>

              {/* Secondary nav grid */}
              <div className="grid grid-cols-5 px-3 pb-1">
                {MORE_ITEMS.map(item => {
                  const hrefBase = item.href.split("?")[0]
                  const active   = pathname === hrefBase || pathname.startsWith(hrefBase + "/")
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={[
                        "flex flex-col items-center gap-1.5 rounded-xl p-2.5 text-center transition",
                        active ? "bg-[#FFF7ED]" : "active:bg-[#F8FAFC]",
                      ].join(" ")}
                    >
                      <span className="text-[22px] leading-none">{item.emoji}</span>
                      <span className={`text-[10px] font-semibold leading-tight ${active ? "text-[#FF8A1F]" : "text-[#374151]"}`}>
                        {item.label}
                      </span>
                    </Link>
                  )
                })}
              </div>

              {/* Account actions */}
              <div className="mx-3 mb-1 mt-1 border-t border-[#F1F5F9] pt-1">
                <Link
                  href="/account/password"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-[#374151] active:bg-[#F8FAFC] transition"
                >
                  {I.password}
                  Change Password
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-red-500 active:bg-red-50 transition"
                >
                  {I.logout}
                  Logout
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
