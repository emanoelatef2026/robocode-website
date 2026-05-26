"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface Props {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
}

export default function Pagination({ page, totalPages, total, perPage }: Props) {
  const router     = useRouter();
  const pathname   = usePathname();
  const searchParams = useSearchParams();

  const go = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`${pathname}?${params.toString()}`);
  };

  if (totalPages <= 1) return null;

  const from = (page - 1) * perPage + 1;
  const to   = Math.min(page * perPage, total);

  return (
    <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 py-3">
      <p className="text-xs text-[#64748B]">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-medium text-[#64748B] transition hover:border-[#CBD5E1] hover:text-[#0B1F3A] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Prev
        </button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          const p = i + 1;
          return (
            <button
              key={p}
              onClick={() => go(p)}
              className={[
                "rounded-md border px-2.5 py-1.5 text-xs font-medium transition",
                p === page
                  ? "border-[#FF8A1F] bg-[#FF8A1F] text-white"
                  : "border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0B1F3A]",
              ].join(" ")}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className="rounded-md border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-medium text-[#64748B] transition hover:border-[#CBD5E1] hover:text-[#0B1F3A] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
