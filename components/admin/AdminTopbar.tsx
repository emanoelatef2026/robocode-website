"use client";

import { useRouter } from "next/navigation";

interface Props {
  onMenuClick: () => void;
}

export default function AdminTopbar({ onMenuClick }: Props) {
  const router = useRouter();

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-[#E2E8F0] bg-white px-5">
      <button
        onClick={onMenuClick}
        className="rounded-md p-1.5 text-[#64748B] hover:bg-[#F1F5F9] md:hidden"
        aria-label="Open menu"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      </button>

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
    </header>
  );
}
