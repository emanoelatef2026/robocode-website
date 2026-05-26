"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import SectionEmptyState from "@/components/ui/SectionEmptyState";

interface Review {
  id:         string;
  name:       string;
  role:       string | null;
  review:     string;
  image_url:  string | null;
  rating:     number | null;
  branch:     string | null;
  active:     boolean;
  sort_order: number;
}

const INPUT = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-[#0B1F3A] outline-none transition focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/20";
const LABEL = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400";

const blank = { name: "", role: "", review: "", branch: "", rating: "5", sort_order: "0" };

export default function ReviewsPage() {
  const [items,    setItems]    = useState<Review[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [editing,  setEditing]  = useState<Review | null>(null);
  const [form,     setForm]     = useState(blank);
  const [file,     setFile]     = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/studio/reviews")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
        return d;
      })
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch((e: Error) => setError(e.message ?? "Failed to connect to database"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    if (file) fd.append("image", file);
    fd.append("name",       form.name);
    fd.append("role",       form.role);
    fd.append("review",     form.review);
    fd.append("branch",     form.branch);
    fd.append("rating",     form.rating);
    fd.append("sort_order", form.sort_order);
    const res = await fetch("/api/studio/reviews", { method: "POST", body: fd });
    setSaving(false);
    if (res.ok) { setForm(blank); setFile(null); if (fileRef.current) fileRef.current.value = ""; load(); }
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? "Failed"); }
  };

  const handleEditSave = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await fetch(`/api/studio/reviews/${editing.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editing.name, role: editing.role, review: editing.review, rating: editing.rating, branch: editing.branch, sort_order: editing.sort_order }),
    });
    setSaving(false);
    if (res.ok) { setEditing(null); load(); }
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? "Failed"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this review?")) return;
    setDeleting(id);
    await fetch(`/api/studio/reviews/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  };

  const handleToggle = async (item: Review) => {
    setToggling(item.id);
    await fetch(`/api/studio/reviews/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    setToggling(null);
    load();
  };

  return (
    <div className="space-y-6">

      {/* Real error — only shown when API/DB actually fails */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          <strong>Connection error:</strong> {error}
          <button onClick={load} className="ml-3 underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Add form — always visible */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-[14px] font-semibold text-[#0B1F3A]">Add Review</h2>
        <p className="mb-4 text-[12px] text-gray-400">Portrait photo optional. Rating 1–5 stars.</p>

        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={LABEL}>Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sara Ahmed" required className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Role</label>
              <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Parent · Student" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Branch</label>
              <input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} placeholder="e.g. Cairo — Maadi" className={INPUT} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Review *</label>
            <textarea value={form.review} onChange={(e) => setForm({ ...form, review: e.target.value })} rows={3} placeholder="Write the review here…" required className={`${INPUT} resize-none`} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={LABEL}>Rating (1–5)</label>
              <input type="number" min="1" max="5" step="0.1" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Sort Order</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Photo (optional)</label>
              <input ref={fileRef} type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-[13px] text-gray-500 file:mr-2 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-gray-600 hover:file:bg-gray-200" />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving}
              className="rounded-lg bg-[#0B1F3A] px-6 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#38BDF8] disabled:opacity-50">
              {saving ? "Saving…" : "Add Review"}
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#38BDF8] border-t-transparent" />
        </div>
      ) : (
        <>
          {items.length > 0 && (
            <p className="text-[13px] text-gray-400">{items.length} review{items.length !== 1 ? "s" : ""}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="p-4">
                  {editing?.id === item.id ? (
                    <div className="space-y-2">
                      <input value={editing.name}           onChange={(e) => setEditing({ ...editing, name: e.target.value })}           className={INPUT} placeholder="Name" />
                      <input value={editing.role ?? ""}     onChange={(e) => setEditing({ ...editing, role: e.target.value })}           className={INPUT} placeholder="Role" />
                      <textarea value={editing.review}      onChange={(e) => setEditing({ ...editing, review: e.target.value })}         className={`${INPUT} resize-none`} rows={3} placeholder="Review" />
                      <input value={editing.branch ?? ""}   onChange={(e) => setEditing({ ...editing, branch: e.target.value })}         className={INPUT} placeholder="Branch" />
                      <input type="number" min="1" max="5" step="0.1" value={editing.rating ?? 5} onChange={(e) => setEditing({ ...editing, rating: Number(e.target.value) })} className={INPUT} placeholder="Rating" />
                      <div className="flex gap-2 pt-1">
                        <button onClick={handleEditSave} disabled={saving} className="flex-1 rounded-lg bg-[#0B1F3A] py-2 text-[12px] font-semibold text-white hover:bg-[#38BDF8] disabled:opacity-50 transition">{saving ? "…" : "Save"}</button>
                        <button onClick={() => setEditing(null)} className="flex-1 rounded-lg border border-gray-200 py-2 text-[12px] font-semibold text-gray-500 hover:bg-gray-50">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-3">
                        {item.image_url ? (
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                            <Image src={item.image_url} alt={item.name} fill sizes="40px" className="object-cover" />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0B1F3A]/8 text-[13px] font-bold text-[#0B1F3A]">
                            {item.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-bold text-[#0B1F3A]">{item.name}</p>
                          <p className="text-[11px] text-gray-400">{[item.role, item.branch].filter(Boolean).join(" · ")}</p>
                          {item.rating != null && <p className="text-[11px] text-amber-500">{"★".repeat(Math.round(item.rating))}</p>}
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-gray-600">&ldquo;{item.review}&rdquo;</p>
                      <div className="mt-3 flex gap-1.5">
                        <button onClick={() => setEditing(item)} className="flex-1 rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-gray-600 hover:border-[#38BDF8] hover:text-[#38BDF8] transition">Edit</button>
                        <button onClick={() => handleToggle(item)} disabled={toggling === item.id}
                          className={["flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition disabled:opacity-50",
                            item.active ? "border-[#38BDF8]/30 bg-[#38BDF8]/8 text-[#38BDF8]" : "border-gray-200 text-gray-400 hover:border-[#38BDF8]/30 hover:text-[#38BDF8]"].join(" ")}>
                          {toggling === item.id ? "…" : item.active ? "Active" : "Inactive"}
                        </button>
                        <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id}
                          className="flex-1 rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-red-400 hover:border-red-300 hover:bg-red-50 transition disabled:opacity-50">
                          {deleting === item.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            {!error && items.length === 0 && (
              <div className="col-span-full">
                <SectionEmptyState
                  variant="reviews"
                  heading="No reviews yet"
                  subtext="Add your first parent or student review using the form above."
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
