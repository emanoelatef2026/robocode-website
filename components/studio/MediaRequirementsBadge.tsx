"use client";

// ── Types ─────────────────────────────────────────────────────────────────────

type MediaType = "image" | "gif" | "video";

interface Requirement {
  label: string;
  value: string;
}

const REQUIREMENTS: Record<MediaType, Requirement[]> = {
  image: [
    { label: "Format",   value: "WebP / PNG / JPG" },
    { label: "Max size", value: "300 KB" },
    { label: "Ratio",    value: "16:9 preferred" },
    { label: "Min",      value: "1200 × 675 px" },
  ],
  gif: [
    { label: "Format",   value: "MP4 / WebM preferred" },
    { label: "Max size", value: "5 MB" },
    { label: "Loop",     value: "3–6 s" },
  ],
  video: [
    { label: "Format",   value: "MP4 / WebM" },
    { label: "Max size", value: "10 MB" },
    { label: "Ratio",    value: "16:9 or 9:16" },
  ],
};

// ── Component ─────────────────────────────────────────────────────────────────

interface MediaRequirementsBadgeProps {
  type?: MediaType;
  /** Show only the most important badges (format + size) */
  compact?: boolean;
}

export default function MediaRequirementsBadge({
  type    = "image",
  compact = false,
}: MediaRequirementsBadgeProps) {
  const reqs = compact ? REQUIREMENTS[type].slice(0, 2) : REQUIREMENTS[type];

  return (
    <div className="flex flex-wrap gap-1.5">
      {reqs.map(({ label, value }) => (
        <span
          key={label}
          className="inline-flex items-center gap-1 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-0.5 text-[11px] font-medium text-[#64748B]"
          title={label}
        >
          {value}
        </span>
      ))}
    </div>
  );
}
