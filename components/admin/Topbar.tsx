"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/admin":          "Dashboard",
  "/admin/bookings": "Trial Bookings",
  "/admin/projects": "Projects",
  "/admin/gallery":  "Gallery",
};

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const title    = TITLES[pathname] ?? "Admin";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-5">
      {/* Left — mobile hamburger + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 md:hidden"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>

        <h1 className="text-[15px] font-semibold text-[#0B132B]">{title}</h1>
      </div>

      {/* Right — admin badge */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#19C6F4] text-[11px] font-bold text-white">
          A
        </div>
        <span className="hidden text-[13px] font-medium text-gray-500 sm:block">
          Admin
        </span>
      </div>
    </header>
  );
}
