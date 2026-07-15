"use client"

import { usePathname } from "next/navigation"
import { useTopbarAction } from "./TopbarActionContext"
import { derivePageTitle } from "./getPageTitle"
import { MenuIcon } from "./icons"
import { ROLE_LABELS, type PortalRole } from "./roles"
import type { PortalNavSection } from "@/components/shared/sidebar/PortalSidebar"

export interface TopHeaderProps {
  onMenuClick: () => void
  role:        PortalRole
  sections:    PortalNavSection[]
  branchName?: string
  /** Replaces the default title/date block — used by Student for its gamified greeting header. */
  centerSlot?: React.ReactNode
  /** Optional portal-specific controls shown before the notification bell — e.g. Student's streak/rank chips. */
  quickActions?: React.ReactNode
  notificationSlot?: React.ReactNode
}

/** The one desktop/mobile header bar used by every portal. */
export default function TopHeader({ onMenuClick, role, sections, branchName, centerSlot, quickActions, notificationSlot }: TopHeaderProps) {
  const pathname = usePathname()
  const { action, titleOverride } = useTopbarAction()

  const pageTitle = titleOverride?.title ?? derivePageTitle(pathname, sections)
  const roleLabel = ROLE_LABELS[role]
  const formattedDate = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
  const subtitle = titleOverride?.subtitle ?? `${formattedDate} · ${roleLabel}`

  return (
    <header
      className="flex shrink-0 items-center gap-3 border-b border-[#E2E8F0] bg-white px-4 md:px-6"
      style={{ height: "var(--header-height)" }}
    >
      <button
        onClick={onMenuClick}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white transition hover:border-[#94A3B8] md:hidden"
        aria-label="Open menu"
      >
        <MenuIcon className="h-4.5 w-4.5 text-[#64748B]" />
      </button>

      {centerSlot ?? (
        <>
          <div className="hidden md:block">
            <h1 className="text-[17px] font-extrabold leading-tight tracking-tight text-[#0B1F3A]">{pageTitle}</h1>
            <p className="mt-0.5 text-[11px] leading-none text-[#94A3B8]">{subtitle}</p>
          </div>
          <div className="block md:hidden">
            <h1 className="text-[16px] font-extrabold text-[#0B1F3A]">{pageTitle}</h1>
          </div>
        </>
      )}

      <div className="flex-1" />

      {quickActions}

      {branchName && (
        <div className="hidden items-center gap-1.5 rounded-[10px] border border-[#e4e9f0] bg-white px-3 py-1.5 md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF8A1F]" />
          <span className="text-[12px] font-semibold text-[#0B1F3A]">{branchName}</span>
        </div>
      )}

      {action && <div className="shrink-0">{action}</div>}

      {notificationSlot}
    </header>
  )
}
