'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import type { ParentChildSummary } from '@/modules/parents/parent-portal-queries'
import { PortalLogo } from '@/components/shared/layout/PortalLogo'
import { PortalUserMenu } from '@/components/shared/layout/PortalUserMenu'
import { PARENT_NAV_ITEMS, parentIcon } from '@/modules/parents/navigation'

// ── Inner nav — uses useSearchParams (wrapped in Suspense by caller) ───────────

function NavContent({
  linkedChildren,
  email,
  onClose,
  pinFooter = true,
}: {
  linkedChildren: ParentChildSummary[]
  email?: string | null
  onClose?: () => void
  /** Desktop: footer pinned. Mobile drawer: whole rail scrolls as one. */
  pinFooter?: boolean
}) {
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const currentChildId = searchParams.get('child') ?? linkedChildren[0]?.student_id ?? ''
  const activeChild     = linkedChildren.find((c) => c.student_id === currentChildId)

  const switchChildHref = (studentId: string) => `${pathname}?child=${studentId}`
  const navHref = (path: string) => (currentChildId ? `${path}?child=${currentChildId}` : path)

  const isActive = (path: string, exact?: boolean) =>
    exact ? pathname === path : pathname === path || pathname.startsWith(path + '/')

  return (
    <div className={`flex h-full flex-col ${pinFooter ? "" : "overflow-y-auto"}`}>
      <PortalLogo />

      <div className="px-5 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">Parent Portal</p>
      </div>

      {/* Children switcher */}
      <div className="px-3 pt-2 pb-1">
        <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">Children</p>
        {linkedChildren.length === 0 ? (
          <p className="px-2 text-[13px] text-white/50">No children linked</p>
        ) : (
          linkedChildren.map((child) => {
            const active  = currentChildId === child.student_id
            const initial = child.student_name.charAt(0).toUpperCase() || '?'
            return (
              <Link
                key={child.student_id}
                href={switchChildHref(child.student_id)}
                onClick={onClose}
                className={[
                  'flex min-h-9 items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150',
                  active ? 'bg-[#302B2D] text-[#FF9A36]' : 'text-white/72 hover:bg-white/6 hover:text-white',
                ].join(' ')}
              >
                <span className={[
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                  active ? 'bg-[#FF9A36] text-[#07182D]' : 'bg-white/10 text-white/60',
                ].join(' ')}>
                  {initial}
                </span>
                <span className="truncate">{child.student_name}</span>
                {active && <span className="ml-auto h-[5px] w-[5px] shrink-0 rounded-full bg-[#FF9A36]" />}
              </Link>
            )
          })
        )}
      </div>

      <div className="mx-3 my-1 border-t border-white/8" />

      <nav className={`space-y-0.5 px-3 ${pinFooter ? "flex-1 overflow-y-auto" : ""}`}>
        {PARENT_NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={navHref(item.href)}
              onClick={onClose}
              className={[
                'flex min-h-10 items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-medium transition-colors duration-150',
                active ? 'bg-[#302B2D] text-[#FF9A36]' : 'text-white/72 hover:bg-white/6 hover:text-white',
              ].join(' ')}
            >
              <span className={active ? 'text-[#FF9A36]' : 'text-white/55'}>{parentIcon(item.key)}</span>
              {item.label}
              {active && <span className="ml-auto h-[5px] w-[5px] rounded-full bg-[#FF9A36]" />}
            </Link>
          )
        })}
      </nav>

      <PortalUserMenu
        role="parent"
        name={email}
        subtitle={activeChild?.student_name}
        onNavigate={onClose}
      />
    </div>
  )
}

// ── Sidebar shell ──────────────────────────────────────────────────────────────

interface Props {
  isOpen:         boolean
  onClose:        () => void
  linkedChildren: ParentChildSummary[]
  email?:         string | null
}

export default function ParentSidebar({ isOpen, onClose, linkedChildren, email }: Props) {
  return (
    <>
      <aside className="hidden w-(--sidebar-width) shrink-0 bg-[#07182D] md:flex md:flex-col">
        <Suspense fallback={<div className="flex-1" />}>
          <NavContent linkedChildren={linkedChildren} email={email} />
        </Suspense>
      </aside>

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            key="parent-mobile-sidebar"
            initial={{ x: -224 }}
            animate={{ x: 0 }}
            exit={{ x: -224 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="drawer-safe-bottom fixed top-0 left-0 z-(--z-drawer) w-(--drawer-width) bg-[#07182D] md:hidden"
          >
            <Suspense fallback={<div className="flex-1" />}>
              <NavContent linkedChildren={linkedChildren} email={email} onClose={onClose} pinFooter={false} />
            </Suspense>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
