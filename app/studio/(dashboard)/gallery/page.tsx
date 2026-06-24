"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import EmptyStateCard from "@/components/studio/EmptyStateCard";
import MediaRequirementsBadge from "@/components/studio/MediaRequirementsBadge";

interface GalleryItem {
  id:         string;
  title:      string | null;
  image_url:  string;
  category:   string | null;
  created_at: string;
}

const INPUT = "w-full rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] px-3 py-2.5 text-[13px] text-[#0B1F3A] outline-none transition focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/20";
const LABEL = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]";

export default function GalleryPage() {
  const [items,     setItems]     = useState<GalleryItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [form,      setForm]      = useState({ title: "", category: "" });
  const [file,      setFile]      = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/studio/gallery")
      .then((r) => r.json())
      .then((d) => { setItems(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);

    const fd = new FormData();
    fd.append("image",    file);
    fd.append("title",    form.title);
    fd.append("category", form.category);

    const res = await fetch("/api/studio/gallery", { method: "POST", body: fd });
    setUploading(false);

    if (res.ok) {
      setForm({ title: "", category: "" });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      load();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this image?")) return;
    setDeleting(id);
    await fetch(`/api/studio/gallery/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  };

  return (
    <div className="space-y-6">

      {/* Upload form */}
      <div className="rounded-xl border border-[#F1F5F9] bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-[14px] font-semibold text-[#0B1F3A]">Upload New Image</h2>
        <div className="mb-4">
          <MediaRequirementsBadge type="image" />
        </div>

        <form onSubmit={handleUpload} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <label className={LABEL}>Image *</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-[13px] text-[#6B7280] file:mr-2 file:rounded-lg file:border-0 file:bg-[#F3F4F6] file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-[#4B5563] hover:file:bg-gray-200"
            />
          </div>
          <div>
            <label className={LABEL}>Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Optional title"
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>Category</label>
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="e.g. Robotics, Coding"
              className={INPUT}
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={uploading || !file}
              className="w-full rounded-lg bg-[#0B1F3A] py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#38BDF8] disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>
        </form>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#38BDF8] border-t-transparent" />
        </div>
      ) : (
        <>
          <p className="text-[13px] text-[#9CA3AF]">{items.length} images</p>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <div key={item.id} className="group relative overflow-hidden rounded-xl border border-[#F1F5F9] bg-white shadow-sm">
                <div className="relative h-40 w-full overflow-hidden bg-[#F3F4F6]">
                  <Image
                    src={item.image_url}
                    alt={item.title ?? "Gallery image"}
                    fill
                    className="object-cover transition group-hover:scale-105"
                  />
                </div>
                <div className="p-3">
                  {item.title && (
                    <p className="truncate text-[13px] font-medium text-[#0B1F3A]">{item.title}</p>
                  )}
                  {item.category && (
                    <p className="text-[11px] text-[#9CA3AF]">{item.category}</p>
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deleting === item.id}
                    className="mt-2 w-full rounded-lg border border-[#E2E8F0] py-1 text-[11px] font-semibold text-[#F87171] transition hover:border-[#FCA5A5] hover:bg-[#FEE2E2] disabled:opacity-50"
                  >
                    {deleting === item.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <EmptyStateCard
                title="No images yet"
                description="Upload your first gallery image above."
                size="tall"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
