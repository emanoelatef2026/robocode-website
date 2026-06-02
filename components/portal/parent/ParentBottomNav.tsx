"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense } from "react"

const NAV = [
  {
    label: "Home",
    href: "/portal/parent",
    exact: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
        <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
      </svg>
    ),
  },
  {
    label: "Assignments",
    href: "/portal/parent/assignments",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75-6.75a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clipRule="evenodd" />
        <path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z" />
      </svg>
    ),
  },
  {
    label: "Attendance",
    href: "/portal/parent/attendance",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: "Progress",
    href: "/portal/parent/progress",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75ZM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 0 1-1.875-1.875V8.625ZM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 0 1 3 19.875v-6.75Z" />
      </svg>
    ),
  },
  {
    label: "More",
    href: "/portal/parent/portfolio",
    moreRoutes: ["/portal/parent/portfolio", "/portal/parent/certificates", "/portal/parent/feedback", "/portal/parent/semesters"],
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path fillRule="evenodd" d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
      </svg>
    ),
  },
]

function NavInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const child = searchParams.get("child")

  const buildHref = (href: string) => child ? `${href}?child=${child}` : href

  const isActive = (item: (typeof NAV)[number]) => {
    if (item.exact) return pathname === item.href
    if (item.moreRoutes) return item.moreRoutes.some(r => pathname.startsWith(r))
    return pathname.startsWith(item.href)
  }

  return (
    <div className="grid grid-cols-5">
      {NAV.map((item) => {
        const active = isActive(item)
        return (
          <Link
            key={item.href}
            href={buildHref(item.href)}
            className={[
              "relative flex flex-col items-center justify-center gap-1 py-2 min-h-[60px] transition-colors",
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
    </div>
  )
}

export default function ParentBottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white border-t border-[#E2E8F0] bottom-nav-safe"
      aria-label="Mobile navigation"
    >
      <Suspense fallback={
        <div className="grid grid-cols-5 min-h-[60px]" />
      }>
        <NavInner />
      </Suspense>
    </nav>
  )
}
