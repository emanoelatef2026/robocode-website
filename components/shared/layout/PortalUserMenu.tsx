"use client"

import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Icons } from "./icons"
import { ROLE_LABELS, ROLE_PORTAL_LABELS, getInitials, type PortalRole } from "./roles"

export interface PortalUserMenuProps {
  role: PortalRole
  /** Real display identity (name or email) when the caller has it available. */
  name?: string | null
  /** Third line — e.g. a group/branch name. Falls back to the generic portal label. */
  subtitle?: string | null
  /** Icon-only rail mode for a collapsed desktop sidebar. */
  collapsed?: boolean
  /** Whether the flyout portal is safe to render (mounted on client). */
  mounted?: boolean
  onNavigate?: () => void
}

const MENU_LINK_CLASS =
  "flex w-full items-center gap-2 rounded-[9px] px-[10px] py-2 text-[11.5px] font-medium text-white/30 transition hover:bg-white/5 hover:text-white/60"

function AccountLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <Link href="/account/profile" onClick={onNavigate} className={MENU_LINK_CLASS}>
        <Icons.profile className="h-4 w-4 shrink-0" />
        Profile
      </Link>
      <Link href="/account/password" onClick={onNavigate} className={MENU_LINK_CLASS}>
        <Icons.password className="h-4 w-4 shrink-0" />
        Change Password
      </Link>
      <div className="flex w-full cursor-not-allowed items-center gap-2 rounded-[9px] px-[10px] py-2 text-[11.5px] font-medium text-white/15">
        <Icons.settings className="h-4 w-4 shrink-0" />
        Settings
        <span className="ms-auto rounded-full bg-white/5 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wide text-white/25">
          Soon
        </span>
      </div>
    </>
  )
}

export function PortalUserMenu({
  role, name, subtitle, collapsed = false, mounted = false, onNavigate,
}: PortalUserMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [flyoutY, setFlyoutY] = useState(0)
  const [showFlyout, setShowFlyout] = useState(false)

  const initials = getInitials(name, role)
  const displayName = name?.trim() || ROLE_LABELS[role]
  const displaySubtitle = subtitle?.trim() || ROLE_PORTAL_LABELS[role]

  async function handleLogout() {
    await fetch("/api/lms/auth/signout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  if (collapsed) {
    return (
      <div className="shrink-0 border-t border-white/8 p-2">
        <button
          ref={btnRef}
          onMouseEnter={() => {
            if (btnRef.current) {
              const rect = btnRef.current.getBoundingClientRect()
              setFlyoutY(rect.top + rect.height / 2)
            }
            setShowFlyout(true)
          }}
          onMouseLeave={() => setShowFlyout(false)}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-center rounded-lg p-2"
        >
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: "linear-gradient(135deg,#FF8A1F,#0B1F3A)" }}
          >
            {initials}
          </div>
        </button>

        {mounted && showFlyout && !open && createPortal(
          <div
            style={{ position: "fixed", left: "64px", top: `${flyoutY}px`, transform: "translateY(-50%)", zIndex: 9999, pointerEvents: "none" }}
            className="whitespace-nowrap rounded-lg border border-white/10 bg-[#0B1F3A] px-2.5 py-1.5 text-[12px] font-medium text-white shadow-xl"
          >
            My Account
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-[#0B1F3A]" />
          </div>,
          document.body
        )}

        {mounted && open && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
            <div
              style={{ position: "fixed", left: "64px", top: `${flyoutY}px`, transform: "translateY(-50%)", zIndex: 9999 }}
              className="w-48 rounded-[10px] border border-white/10 bg-[#0B1F3A] p-1.5 shadow-2xl"
            >
              <AccountLinks onNavigate={() => { setOpen(false); onNavigate?.() }} />
              <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-[9px] px-[10px] py-2 text-[11.5px] font-medium text-[#F87171]/70 transition hover:bg-white/5 hover:text-[#F87171]">
                <Icons.logout className="h-4 w-4 shrink-0" />
                Logout
              </button>
            </div>
          </>,
          document.body
        )}
      </div>
    )
  }

  return (
    <div className="shrink-0 border-t border-white/8 px-3 pb-[18px] pt-3">
      <div className="flex items-center gap-[9px] px-1 py-1">
        <div
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: "linear-gradient(135deg,#FF8A1F,#0B1F3A)" }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11.5px] font-semibold text-white">{displayName}</p>
          <p className="truncate text-[9.5px] text-white/40">{displaySubtitle}</p>
        </div>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-1.5 flex w-full items-center gap-2 rounded-[9px] px-[10px] py-2 text-[11.5px] font-medium text-white/30 transition hover:bg-white/5 hover:text-white/60"
      >
        <Icons.settings className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-start">My Account</span>
        <svg viewBox="0 0 20 20" fill="currentColor" className={`h-3 w-3 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <path fillRule="evenodd" clipRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="account-dropdown"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-0.5 space-y-0.5 ps-3">
              <AccountLinks onNavigate={onNavigate} />
              <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-[9px] px-[10px] py-2 text-[11.5px] font-medium text-[#F87171]/60 transition hover:bg-white/5 hover:text-[#F87171]">
                <Icons.logout className="h-4 w-4 shrink-0" />
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
