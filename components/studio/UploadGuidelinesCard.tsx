"use client";

// ── Types ─────────────────────────────────────────────────────────────────────

type MediaType = "image" | "gif" | "video";

interface Guideline {
  icon: string;
  label: string;
  value: string;
  ok: boolean;
}

// ── Guideline sets ────────────────────────────────────────────────────────────

const IMAGE_GUIDELINES: Guideline[] = [
  { icon: "📐", label: "Aspect ratio",  value: "16:9 preferred",            ok: true  },
  { icon: "🖼️", label: "Format",        value: "WebP preferred, PNG / JPG", ok: true  },
  { icon: "📦", label: "Max file size", value: "300 KB",                    ok: true  },
  { icon: "📏", label: "Min resolution", value: "1200 × 675 px",            ok: true  },
  { icon: "✂️", label: "Text near edges", value: "Avoid — may get clipped",  ok: false },
];

const GIF_GUIDELINES: Guideline[] = [
  { icon: "🎞️", label: "Format",        value: "MP4 / WebM preferred over GIF", ok: true  },
  { icon: "📦", label: "Max file size", value: "Under 5 MB",                     ok: true  },
  { icon: "🔄", label: "Loop",          value: "Short loops only (3–6 s)",       ok: true  },
  { icon: "🎬", label: "GIF files",     value: "Accepted but larger on disk",    ok: false },
];

const VIDEO_GUIDELINES: Guideline[] = [
  { icon: "🎬", label: "Format",        value: "MP4 (H.264) or WebM",   ok: true  },
  { icon: "📦", label: "Max file size", value: "Under 10 MB",           ok: true  },
  { icon: "📐", label: "Aspect ratio",  value: "16:9 or 9:16 (shorts)", ok: true  },
  { icon: "🔇", label: "Autoplay",      value: "Muted by default",      ok: true  },
];

const GUIDELINES: Record<MediaType, Guideline[]> = {
  image: IMAGE_GUIDELINES,
  gif:   GIF_GUIDELINES,
  video: VIDEO_GUIDELINES,
};

const TITLES: Record<MediaType, string> = {
  image: "Image Upload Guidelines",
  gif:   "GIF / Animation Guidelines",
  video: "Video Upload Guidelines",
};

// ── Component ─────────────────────────────────────────────────────────────────

interface UploadGuidelinesCardProps {
  type?:    MediaType;
  compact?: boolean;
}

export default function UploadGuidelinesCard({
  type    = "image",
  compact = false,
}: UploadGuidelinesCardProps) {
  const items = GUIDELINES[type];

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0B1F3A]/8 text-xs">
          💡
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#64748B]">
          {TITLES[type]}
        </p>
      </div>

      <ul className="space-y-2">
        {items.map(({ icon, label, value, ok }) => (
          <li key={label} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]">
              {ok ? (
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-emerald-500">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-[#F59E0B]">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 5v3M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </span>
            {!compact && (
              <span className="shrink-0 w-24 text-[11px] font-medium text-[#64748B]">
                {label}
              </span>
            )}
            <span className="text-[11px] text-[#334155]">{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
