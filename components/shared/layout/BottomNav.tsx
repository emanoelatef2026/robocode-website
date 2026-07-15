"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Icons, CloseIcon } from "./icons"

export interface BottomNavItem {
  label:          string
  href:           string
  icon:           React.ReactNode
  exact?:         boolean
  matchPatterns?: string[]
}

export interface PortalBottomNavProps {
  /** Up to 4 items shown directly in the bar; a 5th "More" button opens the sheet. */
  items:      BottomNavItem[]
  /** Extra destinations shown in the "More" bottom sheet. */
  moreItems?: BottomNavItem[]
  /** Transforms each item's href before rendering — e.g. to preserve a `?child=` query param. */
  getHref?:   (href: string) => string
}

function isActive(item: BottomNavItem, pathname: string): boolean {
  const hrefPath = item.href.split("?")[0]
  if (item.exact) return pathname === hrefPath
  if (item.matchPatterns?.length) {
    return item.matchPatterns.some((p) => pathname === p || pathname.startsWith(p + "/"))
  }
  return pathname === hrefPath || pathname.startsWith(hrefPath + "/")
}

function TabLink({ item, active, href }: { item: BottomNavItem; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-center"
    >
      <span className={active ? "text-[#FF8A1F]" : "text-[#94A3B8]"}>{item.icon}</span>
      <span className={`text-[10px] font-medium leading-none ${active ? "text-[#FF8A1F]" : "text-[#64748B]"}`}>
        {item.label}
      </span>
      {active && <span className="absolute top-0 h-0.5 w-6 rounded-full bg-[#FF8A1F]" />}
    </Link>
  )
}

export function BottomNav({ items, moreItems = [], getHref = (href) => href }: PortalBottomNavProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const hasMore = moreItems.length > 0

  return (
    <>
      <nav
        className="bottom-nav-safe fixed inset-x-0 bottom-0 z-(--z-bottom-nav) grid border-t border-[#E2E8F0] bg-white/95 pt-1.5 backdrop-blur-sm md:hidden"
        style={{ gridTemplateColumns: `repeat(${items.length + (hasMore ? 1 : 0)}, minmax(0, 1fr))`, height: "var(--bottom-nav-height)" }}
      >
        {items.map((item) => (
          <div key={item.href} className="relative">
            <TabLink item={item} active={isActive(item, pathname)} href={getHref(item.href)} />
          </div>
        ))}
        {hasMore && (
          <button
            onClick={() => setMoreOpen(true)}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-center text-[#64748B]"
          >
            <Icons.more className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        )}
      </nav>

      <AnimatePresence>
        {hasMore && moreOpen && (
          <>
            <motion.div
              key="more-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-(--z-sheet-backdrop) bg-black/40 md:hidden"
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              key="more-sheet"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="drawer-safe-bottom fixed inset-x-3 z-(--z-sheet-panel) max-h-[70vh] overflow-y-auto rounded-2xl bg-white shadow-2xl md:hidden"
            >
              <div className="flex items-center justify-between border-b border-[#F1F5F9] px-4 py-3">
                <span className="text-[13px] font-bold text-[#0B1F3A]">More</span>
                <button onClick={() => setMoreOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9]" aria-label="Close">
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1 p-3">
                {moreItems.map((item) => (
                  <Link
                    key={item.href}
                    href={getHref(item.href)}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-1.5 rounded-xl py-3 text-center active:bg-[#F8FAFC]"
                  >
                    <span className={isActive(item, pathname) ? "text-[#FF8A1F]" : "text-[#475569]"}>{item.icon}</span>
                    <span className="text-[10.5px] font-medium leading-tight text-[#334155]">{item.label}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
