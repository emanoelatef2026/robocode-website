'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import type { ParentChildSummary } from '@/modules/parents/parent-portal-queries'

// ── Icons ──────────────────────────────────────────────────────────────────────

const Icons = {
  dashboard: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
  ),
  attendance: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  ),
  assignments: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
    </svg>
  ),
  portfolio: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
    </svg>
  ),
  certificates: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
  ),
  feedback: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
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
}

const NAV_ITEMS = [
  { label: 'Dashboard',    path: '/portal/parent',                icon: Icons.dashboard,    exact: true  },
  { label: 'Attendance',   path: '/portal/parent/attendance',     icon: Icons.attendance,   exact: false },
  { label: 'Assignments',  path: '/portal/parent/assignments',    icon: Icons.assignments,  exact: false },
  { label: 'Portfolio',    path: '/portal/parent/portfolio',      icon: Icons.portfolio,    exact: false },
  { label: 'Certificates', path: '/portal/parent/certificates',   icon: Icons.certificates, exact: false },
  { label: 'History',      path: '/portal/parent/semesters',      icon: Icons.history,      exact: false },
  { label: 'Finance',      path: '/portal/parent/finance',        icon: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
    </svg>
  ), exact: false },
  { label: 'Feedback',     path: '/portal/parent/feedback',       icon: Icons.feedback,     exact: false },
]

// ── Inner nav — uses useSearchParams (wrapped in Suspense by caller) ───────────

function NavContent({
  linkedChildren,
  onClose,
}: {
  linkedChildren: ParentChildSummary[]
  onClose?: () => void
}) {
  const pathname    = usePathname()
  const searchParams = useSearchParams()
  const router      = useRouter()

  const currentChildId = searchParams.get('child') ?? linkedChildren[0]?.student_id ?? ''

  // Child switcher: keep current section, just swap child param
  const switchChildHref = (studentId: string) =>
    currentChildId ? `${pathname}?child=${studentId}` : `${pathname}?child=${studentId}`

  // Nav href: preserve current child
  const navHref = (path: string) =>
    currentChildId ? `${path}?child=${currentChildId}` : path

  const isActive = (path: string, exact: boolean) =>
    exact ? pathname === path : pathname === path || pathname.startsWith(path + '/')

  const handleLogout = async () => {
    await fetch('/api/lms/auth/signout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-white/8 px-5">
        <Image src="/logo.png" alt="Robocode" width={120} height={52} className="h-auto w-24 brightness-0 invert" />
      </div>

      {/* Portal label */}
      <div className="px-5 pt-5 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">Parent Portal</p>
      </div>

      {/* Children switcher */}
      <div className="px-3 pt-2 pb-1">
        <p className="mb-1 px-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-white/20">
          Children
        </p>
        {linkedChildren.length === 0 ? (
          <p className="px-2 text-[12px] text-white/25">No children linked</p>
        ) : (
          linkedChildren.map(child => {
            const active  = currentChildId === child.student_id
            const initial = child.student_name.charAt(0).toUpperCase() || '?'
            return (
              <Link
                key={child.student_id}
                href={switchChildHref(child.student_id)}
                onClick={onClose}
                className={[
                  'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-all duration-150',
                  active
                    ? 'bg-[#FF8A1F]/15 text-[#FF8A1F]'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/80',
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

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV_ITEMS.map(({ label, path, icon, exact }) => {
          const active = isActive(path, exact)
          return (
            <Link
              key={path}
              href={navHref(path)}
              onClick={onClose}
              className={[
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150',
                active
                  ? 'bg-[#FF8A1F]/15 text-[#FF8A1F]'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80',
              ].join(' ')}
            >
              <span className={active ? 'text-[#FF8A1F]' : 'text-white/35'}>{icon}</span>
              {label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#FF8A1F]" />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/8 p-4 space-y-1">
        <Link
          href="/account/password"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-white/35 transition-all duration-150 hover:bg-white/5 hover:text-white/70"
        >
          {Icons.password}
          Change Password
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-white/35 transition-all duration-150 hover:bg-white/5 hover:text-white/70"
        >
          {Icons.logout}
          Logout
        </button>
      </div>
    </div>
  )
}

// ── Sidebar shell ──────────────────────────────────────────────────────────────

interface Props {
  isOpen:         boolean
  onClose:        () => void
  linkedChildren: ParentChildSummary[]
}

export default function ParentSidebar({ isOpen, onClose, linkedChildren }: Props) {
  return (
    <>
      <aside className="hidden w-56 shrink-0 bg-[#0B1F3A] md:flex md:flex-col">
        <Suspense fallback={<div className="flex-1" />}>
          <NavContent linkedChildren={linkedChildren} />
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
            className="fixed inset-y-0 left-0 z-30 w-56 bg-[#0B1F3A] md:hidden"
          >
            <Suspense fallback={<div className="flex-1" />}>
              <NavContent linkedChildren={linkedChildren} onClose={onClose} />
            </Suspense>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
