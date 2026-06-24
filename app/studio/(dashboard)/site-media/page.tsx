"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MediaItem {
  key:        string;
  image_url:  string;
  updated_at: string;
}

// ── Upload card ───────────────────────────────────────────────────────────────

const SLOTS = [
  {
    key:         "hero_image",
    label:       "Hero Section Image",
    description: "Displayed on the right side of the homepage hero section.",
  },
  {
    key:         "why_robocode_image",
    label:       "Why Robocode Image",
    description: "Displayed in the 'Built For Future Innovators' section image panel.",
  },
] as const;

function UploadCard({
  slot,
  current,
  onUploaded,
}: {
  slot:       typeof SLOTS[number];
  current:    MediaItem | undefined;
  onUploaded: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [status,    setStatus]    = useState<"idle" | "success" | "error">("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatus("idle");

    const fd = new FormData();
    fd.append("key",   slot.key);
    fd.append("image", file);

    const res = await fetch("/api/studio/site-media", { method: "PUT", body: fd });
    setUploading(false);

    if (res.ok) {
      setStatus("success");
      if (fileRef.current) fileRef.current.value = "";
      onUploaded();
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("error");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#F1F5F9] bg-white shadow-sm">

      {/* Current image preview */}
      <div className="relative h-52 w-full overflow-hidden bg-[#F8FAFC]">
        {current?.image_url ? (
          <Image
            src={current.image_url}
            alt={slot.label}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[#CBD5E1]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M3 16l5-5 4 4 3-3 6 4" />
              <circle cx="8.5" cy="8.5" r="1.5" />
            </svg>
            <p className="text-[12px] font-medium">No image uploaded</p>
          </div>
        )}

        {/* Key badge */}
        <span className="absolute left-3 top-3 rounded-lg bg-black/50 px-2.5 py-1 font-mono text-[10px] font-semibold text-white backdrop-blur-sm">
          {slot.key}
        </span>
      </div>

      <div className="p-5">
        <h3 className="text-[14px] font-semibold text-[#0B1F3A]">{slot.label}</h3>
        <p className="mt-0.5 text-[12px] text-[#64748B]">{slot.description}</p>

        {current?.updated_at && (
          <p className="mt-1 text-[11px] text-[#94A3B8]">
            Last updated: {new Date(current.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}

        {/* Upload guidelines */}
        <div className="mt-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Upload Guidelines</p>
          <ul className="space-y-1">
            {[
              "Recommended: 1600 × 900 px",
              "WebP preferred for best performance",
              "Keep file size under 400 KB",
              "Avoid text near image edges",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-1.5 text-[11px] text-[#64748B]">
                <svg viewBox="0 0 16 16" fill="currentColor" className="mt-0.5 h-3 w-3 shrink-0 text-[#38BDF8]">
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.53 5.47l-4 4a.75.75 0 01-1.06 0l-2-2a.75.75 0 011.06-1.06L7 8.94l3.47-3.47a.75.75 0 011.06 1.06z" />
                </svg>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={handleUpload} className="mt-4 flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            required
            className="block flex-1 text-[12px] text-[#6B7280] file:mr-2 file:rounded-lg file:border-0 file:bg-[#F1F5F9] file:px-3 file:py-2 file:text-[11px] file:font-semibold file:text-[#334155] hover:file:bg-[#E2E8F0]"
          />
          <button
            type="submit"
            disabled={uploading}
            className="shrink-0 rounded-lg bg-[#0B1F3A] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#38BDF8] disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>

        {status === "success" && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-[#10B981]">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Image updated successfully
          </p>
        )}
        {status === "error" && (
          <p className="mt-2 text-[12px] font-semibold text-[#EF4444]">Upload failed — check storage bucket and table exist.</p>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SiteMediaPage() {
  const [items,   setItems]   = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/studio/site-media")
      .then((r) => r.json())
      .then((d) => { setItems(Array.isArray(d) ? d : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const getItem = (key: string) => items.find((i) => i.key === key);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-[16px] font-bold text-[#0B132B]">Site Media</h1>
        <p className="mt-0.5 text-[13px] text-[#9CA3AF]">
          Manage hero and section images displayed on the public website.
        </p>
      </div>

      {/* Setup hint */}
      <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-[12px] text-[#B45309]">
        <strong>One-time setup:</strong> Create a <code className="rounded bg-[#FFFBEB] px-1 font-mono">site_media</code> table
        (columns: <code className="rounded bg-[#FFFBEB] px-1 font-mono">id uuid pk</code>, <code className="rounded bg-[#FFFBEB] px-1 font-mono">key text unique</code>, <code className="rounded bg-[#FFFBEB] px-1 font-mono">image_url text</code>, <code className="rounded bg-[#FFFBEB] px-1 font-mono">updated_at timestamptz</code>)
        and a <code className="rounded bg-[#FFFBEB] px-1 font-mono">site-media</code> storage bucket (public) in Supabase.
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#38BDF8] border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {SLOTS.map((slot) => (
            <UploadCard
              key={slot.key}
              slot={slot}
              current={getItem(slot.key)}
              onUploaded={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
