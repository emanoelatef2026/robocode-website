"use client";

// ── Component ─────────────────────────────────────────────────────────────────

interface EmptyStateCardProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Use "tall" when the card spans a full list area */
  size?: "default" | "tall";
}

export default function EmptyStateCard({
  icon,
  title,
  description,
  action,
  className = "",
  size = "default",
}: EmptyStateCardProps) {
  const py = size === "tall" ? "py-24" : "py-14";

  return (
    <div
      className={`col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] bg-white text-center ${py} px-6 ${className}`}
    >
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F5F9] text-[#94A3B8]">
          {icon}
        </div>
      ) : (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F5F9]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-[#CBD5E1]">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      <p className="text-[14px] font-semibold text-[#0B1F3A]">{title}</p>

      {description && (
        <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-[#94A3B8]">{description}</p>
      )}

      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
