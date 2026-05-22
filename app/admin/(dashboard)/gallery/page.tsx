"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";

interface GalleryItem {
  id: string;
  title: string | null;
  image_url: string;
  category: string | null;
  created_at: string;
}

export default function GalleryPage() {
  const [items, setItems]         = useState<GalleryItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [form, setForm]           = useState({ title: "", category: "" });
  const [file, setFile]           = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/gallery")
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

    const res = await fetch("/api/admin/gallery", { method: "POST", body: fd });
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
    await fetch(`/api/admin/gallery/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  };

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-[14px] font-semibold text-[#0B132B]">Upload New Image</h2>
        <form onSubmit={handleUpload} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Image *</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-[13px] text-gray-500 file:mr-2 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-gray-600 hover:file:bg-gray-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Optional title"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-[#0B132B] outline-none focus:border-[#19C6F4] focus:ring-2 focus:ring-[#19C6F4]/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Category</label>
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="e.g. Robotics, Coding"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-[#0B132B] outline-none focus:border-[#19C6F4] focus:ring-2 focus:ring-[#19C6F4]/20"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={uploading || !file}
              className="w-full rounded-lg bg-[#0B132B] py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#19C6F4] disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>
        </form>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#19C6F4] border-t-transparent" />
        </div>
      ) : (
        <>
          <p className="text-[13px] text-gray-400">{items.length} images</p>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <div key={item.id} className="group relative overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="relative h-40 w-full overflow-hidden bg-gray-100">
                  <Image
                    src={item.image_url}
                    alt={item.title ?? "Gallery image"}
                    fill
                    className="object-cover transition group-hover:scale-105"
                  />
                </div>
                <div className="p-3">
                  {item.title && (
                    <p className="truncate text-[13px] font-medium text-[#0B132B]">{item.title}</p>
                  )}
                  {item.category && (
                    <p className="text-[11px] text-gray-400">{item.category}</p>
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deleting === item.id}
                    className="mt-2 w-full rounded-lg border border-gray-200 py-1 text-[11px] font-semibold text-red-400 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleting === item.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
                No images yet — upload your first one above
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
