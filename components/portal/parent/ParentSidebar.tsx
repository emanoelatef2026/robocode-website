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
}: {
  linkedChildren: ParentChildSummary[]
  email?: string | null
  onClose?: () => void
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
    <div className="flex h-full flex-col">
      <PortalLogo />

      <div className="px-5 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">Parent Portal</p>
      </div>

      {/* Children switcher */}
      <div className="px-3 pt-2 pb-1">
        <p className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-white/25">Children</p>
        {linkedChildren.length === 0 ? (
          <p className="px-2 text-[12px] text-white/50">No children linked</p>
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
                  'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-all duration-150',
                  active ? 'bg-[#FF8A1F]/15 text-[#FF8A1F]' : 'text-white/50 hover:bg-white/5 hover:text-white/80',
                ].join(' ')}
              >
                <span className={[
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  active ? 'bg-[#FF8A1F] text-white' : 'bg-white/10 text-white/50',
                ].join(' ')}>
                  {initial}
                </span>
                <span className="truncate">{child.student_name}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF8A1F]" />}
              </Link>
            )
          })
        )}
      </div>

      <div className="mx-3 my-1 border-t border-white/8" />

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {PARENT_NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={navHref(item.href)}
              onClick={onClose}
              className={[
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150',
                active ? 'bg-[#FF8A1F]/15 text-[#FF8A1F]' : 'text-white/50 hover:bg-white/5 hover:text-white/80',
              ].join(' ')}
            >
              <span className={active ? 'text-[#FF8A1F]' : 'text-white/35'}>{parentIcon(item.key)}</span>
              {item.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#FF8A1F]" />}
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
      <aside className="hidden w-(--sidebar-width) shrink-0 bg-[#0B1F3A] md:flex md:flex-col">
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
            className="drawer-safe-bottom fixed top-0 left-0 z-(--z-drawer) w-(--drawer-width) bg-[#0B1F3A] md:hidden"
          >
            <Suspense fallback={<div className="flex-1" />}>
              <NavContent linkedChildren={linkedChildren} email={email} onClose={onClose} />
            </Suspense>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
