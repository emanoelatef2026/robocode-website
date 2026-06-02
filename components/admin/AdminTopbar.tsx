"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

interface Props {
  onMenuClick: () => void;
}

export default function AdminTopbar({ onMenuClick }: Props) {
  const router = useRouter();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#E2E8F0] bg-white px-4 md:px-5">
      {/* Mobile logo */}
      <div className="flex items-center md:hidden">
        <Image src="/logo.png" alt="Robocode" width={100} height={44} className="h-7 w-auto" />
      </div>

      <div className="flex-1" />

      <button
        onClick={() => router.push("/studio")}
        className="flex items-center gap-1.5 rounded-md border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#64748B] transition hover:border-[#CBD5E1] hover:text-[#0B1F3A]"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
        Studio
      </button>

      <button
        onClick={onMenuClick}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9] active:bg-[#E2E8F0] md:hidden"
        aria-label="Open menu"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>
    </header>
  );
}
