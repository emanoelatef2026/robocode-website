"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/studio":                "Dashboard",
  "/studio/bookings":       "Trial Bookings",
  "/studio/projects":       "Student Projects",
  "/studio/gallery":        "Gallery",
  "/studio/homepage":       "Homepage Sections",
  "/studio/learning-journey": "Learning Journey",
  "/studio/students":       "Meet Our Students",
  "/studio/site-media":     "Site Media",
  "/studio/branches":       "Branches",
  "/studio/reviews":        "Reviews",
  "/studio/partners":       "Partners",
  "/studio/accreditations": "Accreditations",
  "/studio/faq":            "FAQ",
  "/studio/blog":           "Blog",
};

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const title    = TITLES[pathname] ?? "Studio";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9CA3AF] transition hover:bg-[#F3F4F6] hover:text-[#4B5563] md:hidden"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>

        <h1 className="text-[15px] font-semibold text-[#0B132B]">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#19C6F4] text-[11px] font-bold text-white">
          S
        </div>
        <span className="hidden text-[13px] font-medium text-[#6B7280] sm:block">
          Studio
        </span>
      </div>
    </header>
  );
}
