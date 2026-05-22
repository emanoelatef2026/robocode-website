"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const NAV = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4.5 w-4.5">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
      </svg>
    ),
  },
  {
    label: "Bookings",
    href: "/admin/bookings",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4.5 w-4.5">
        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: "Projects",
    href: "/admin/projects",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4.5 w-4.5">
        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    label: "Gallery",
    href: "/admin/gallery",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4.5 w-4.5">
        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
      </svg>
    ),
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function NavContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-white/8 px-5">
        <Image
          src="/logo.png"
          alt="Robocode"
          width={120}
          height={52}
          className="h-auto w-24 brightness-0 invert"
        />
      </div>

      {/* Section label */}
      <div className="px-5 pt-6 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">
          Admin Panel
        </p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ label, href, icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150",
                active
                  ? "bg-[#19C6F4]/12 text-[#19C6F4]"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80",
              ].join(" ")}
            >
              <span className={active ? "text-[#19C6F4]" : "text-white/35"}>
                {icon}
              </span>
              {label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#19C6F4]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom — logout */}
      <div className="border-t border-white/8 p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-white/35 transition-all duration-150 hover:bg-white/5 hover:text-white/70"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
          </svg>
          Logout
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop — always visible */}
      <aside className="hidden w-56 shrink-0 bg-[#0B132B] md:flex md:flex-col">
        <NavContent />
      </aside>

      {/* Mobile — slide-in drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            key="mobile-sidebar"
            initial={{ x: -224 }}
            animate={{ x: 0 }}
            exit={{ x: -224 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 left-0 z-30 w-56 bg-[#0B132B] md:hidden"
          >
            <NavContent onClose={onClose} />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
