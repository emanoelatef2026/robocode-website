"use client";

import Image from "next/image";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function sizeStatus(bytes: number, type: "image" | "gif" | "video"): "ok" | "warn" | "error" {
  const limits = { image: 300_000, gif: 5_000_000, video: 10_000_000 };
  const limit = limits[type];
  if (bytes <= limit * 0.8) return "ok";
  if (bytes <= limit)       return "warn";
  return "error";
}

// ── Component ─────────────────────────────────────────────────────────────────

interface MediaPreviewCardProps {
  src:       string;
  alt?:      string;
  fileSize?: number;
  width?:    number;
  height?:   number;
  type?:     "image" | "gif" | "video";
  onRemove?: () => void;
}

export default function MediaPreviewCard({
  src,
  alt      = "Media preview",
  fileSize,
  width,
  height,
  type     = "image",
  onRemove,
}: MediaPreviewCardProps) {
  const status = fileSize ? sizeStatus(fileSize, type) : null;

  const statusConfig = {
    ok:    { color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", label: "Size OK" },
    warn:  { color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200",   label: "Near limit" },
    error: { color: "text-red-600",     bg: "bg-red-50",     border: "border-red-200",     label: "Too large" },
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">

      {/* Preview area */}
      <div className="relative bg-[#F1F5F9]" style={{ aspectRatio: "16/9" }}>
        {type === "video" ? (
          <video
            src={src}
            controls
            muted
            className="h-full w-full object-contain"
          />
        ) : (
          <Image
            src={src}
            alt={alt}
            fill
            className="object-contain"
            unoptimized={type === "gif"}
          />
        )}

        {/* Remove button */}
        {onRemove && (
          <button
            onClick={onRemove}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#64748B] shadow-sm transition hover:bg-white hover:text-red-500"
            aria-label="Remove media"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Meta row */}
      {(fileSize || width || height) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[#E2E8F0] px-3 py-2">

          {(width && height) && (
            <span className="text-[11px] text-[#64748B]">
              {width} × {height}
            </span>
          )}

          {fileSize !== undefined && (
            <>
              <span className="text-[#CBD5E1]">·</span>
              <span className="text-[11px] text-[#64748B]">
                {formatBytes(fileSize)}
              </span>
              {status && (
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusConfig[status].color} ${statusConfig[status].bg} ${statusConfig[status].border}`}>
                  {statusConfig[status].label}
                </span>
              )}
            </>
          )}

        </div>
      )}
    </div>
  );
}
