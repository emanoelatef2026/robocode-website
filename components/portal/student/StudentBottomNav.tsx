"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

// ── Nav items: Dashboard / Sessions / Assignments / Attendance / Certificates ──

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href:  "/portal/student",
    exact: true,
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
      </svg>
    ),
  },
  {
    label: "Sessions",
    href:  "/portal/student/history",
    exact: false,
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.5 2.5a1 1 0 001.414-1.414L11 9.586V6z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: "Assignments",
    href:  "/portal/student/assignments",
    exact: false,
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: "Attendance",
    href:  "/portal/student/attendance",
    exact: false,
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: "Certificates",
    href:  "/portal/student/certificates",
    exact: false,
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ),
  },
]

export default function StudentBottomNav() {
  const pathname = usePathname()

  const isActive = (item: (typeof NAV_ITEMS)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e9edf3] bg-white pb-[max(8px,env(safe-area-inset-bottom))] pt-2 md:hidden"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-0.5 py-1 min-h-[48px] transition-colors"
              aria-current={active ? "page" : undefined}
            >
              {/* Icon container */}
              <div
                className={[
                  "flex h-[26px] w-[26px] items-center justify-center rounded-[8px] transition-colors",
                  active ? "bg-[#FFF1E2] text-[#FF8A1F]" : "text-[#94A3B8]",
                ].join(" ")}
              >
                {item.icon}
              </div>
              {/* Label */}
              <span
                className={[
                  "text-[9.5px] font-semibold leading-none",
                  active ? "text-[#FF8A1F]" : "text-[#94A3B8]",
                ].join(" ")}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
