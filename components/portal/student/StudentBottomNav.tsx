"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

// ── Main (always visible) ─────────────────────────────────────────────────────

const MAIN_ITEMS = [
  {
    label:       "Home",
    href:        "/portal/student",
    exact:       true,
    colorIdle:   "bg-orange-50 text-orange-500",
    colorActive: "bg-orange-500 text-white shadow-md shadow-orange-200",
    labelActive: "text-orange-500",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
      </svg>
    ),
  },
  {
    label:       "Tasks",
    href:        "/portal/student/assignments",
    exact:       false,
    colorIdle:   "bg-[#FFFBEB] text-[#F59E0B]",
    colorActive: "bg-[#FFFBEB]0 text-white shadow-md shadow-amber-200",
    labelActive: "text-[#F59E0B]",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label:       "Portfolio",
    href:        "/portal/student/portfolio",
    exact:       false,
    colorIdle:   "bg-purple-50 text-purple-500",
    colorActive: "bg-purple-500 text-white shadow-md shadow-purple-200",
    labelActive: "text-purple-500",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label:       "Rank",
    href:        "/portal/student/leaderboard",
    exact:       false,
    colorIdle:   "bg-[#EFF6FF] text-[#3B82F6]",
    colorActive: "bg-[#EFF6FF]0 text-white shadow-md shadow-blue-200",
    labelActive: "text-[#3B82F6]",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
      </svg>
    ),
  },
]

// ── More sheet items ──────────────────────────────────────────────────────────

const MORE_ITEMS = [
  {
    label: "Sessions",
    href:  "/portal/student/history",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.5 2.5a1 1 0 001.414-1.414L11 9.586V6z" clipRule="evenodd" />
      </svg>
    ),
    color: "bg-[#EFF6FF] text-[#2563EB]",
  },
  {
    label: "Attendance",
    href:  "/portal/student/attendance",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    color: "bg-[#E7F8EE] text-[#10B981]",
  },
  {
    label: "Certificates",
    href:  "/portal/student/certificates",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ),
    color: "bg-[#FFFBEB] text-[#F59E0B]",
  },
  {
    label: "My Videos",
    href:  "/portal/student/videos",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
      </svg>
    ),
    color: "bg-purple-50 text-purple-600",
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudentBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const pathname = usePathname()

  // Close more sheet on navigation
  useEffect(() => { setMoreOpen(false) }, [pathname])

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")

  const isMoreActive = MORE_ITEMS.some(item => isActive(item.href))

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setMoreOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* More pop-up sheet */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            className="fixed inset-x-3 z-50 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl md:hidden"
            style={{ bottom: "calc(58px + max(8px, env(safe-area-inset-bottom)))" }}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="px-4 pb-1 pt-3 text-[9.5px] font-bold uppercase tracking-widest text-[#94A3B8]">
              More
            </p>
            <div className="grid grid-cols-4 gap-1 px-3 pb-4 pt-1">
              {MORE_ITEMS.map(item => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex flex-col items-center gap-[7px] rounded-xl p-2 transition active:scale-95"
                  >
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl transition
                      ${active ? 'bg-[#FF8A1F] text-white shadow-md shadow-orange-200' : item.color}`}
                    >
                      {item.icon}
                    </div>
                    <span className={`text-center text-[10px] font-semibold leading-tight
                      ${active ? 'text-[#FF8A1F]' : 'text-[#475569]'}`}
                    >
                      {item.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom nav bar ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e9edf3] bg-white/95 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-sm md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-5">
          {MAIN_ITEMS.map(item => {
            const active = isActive(item.href, item.exact)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-[3px] min-h-[48px] py-1 transition-colors"
                aria-current={active ? "page" : undefined}
              >
                <div className={[
                  "flex h-[28px] w-[28px] items-center justify-center rounded-[9px] transition-all",
                  active ? item.colorActive : item.colorIdle,
                ].join(" ")}>
                  {item.icon}
                </div>
                <span className={[
                  "text-[9.5px] font-semibold leading-none transition-colors",
                  active ? item.labelActive : "text-[#94A3B8]",
                ].join(" ")}>
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(v => !v)}
            className="flex flex-col items-center justify-center gap-[3px] min-h-[48px] py-1"
            aria-expanded={moreOpen}
          >
            <div className={[
              "flex h-[28px] w-[28px] items-center justify-center rounded-[9px] transition-all",
              (isMoreActive || moreOpen)
                ? "bg-slate-600 text-white shadow-md shadow-slate-300"
                : "bg-[#F1F5F9] text-[#64748B]",
            ].join(" ")}>
              {moreOpen ? (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              )}
            </div>
            <span className={[
              "text-[9.5px] font-semibold leading-none transition-colors",
              (isMoreActive || moreOpen) ? "text-[#475569]" : "text-[#94A3B8]",
            ].join(" ")}>
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
