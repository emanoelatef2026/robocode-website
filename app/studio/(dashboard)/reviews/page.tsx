"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = "pending" | "approved" | "rejected";

interface Review {
  id:         string;
  name:       string;
  role:       string | null;
  review:     string;
  image_url:  string | null;
  rating:     number | null;
  branch:     string | null;
  active:     boolean;
  status:     Status | null;
  featured:   boolean | null;
  sort_order: number;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const INPUT    = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-[#0B1F3A] outline-none transition focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/20";
const LABEL    = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400";
const TEXTAREA = `${INPUT} resize-none`;

const blank = { name: "", role: "", review: "", branch: "", rating: "5", sort_order: "0" };

const STATUS_BADGE: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  pending:  "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

// ── Stars ─────────────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-[11px] text-amber-400">
      {"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReviewsPage() {
  const [items,    setItems]    = useState<Review[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [acting,   setActing]   = useState<string | null>(null);
  const [editing,  setEditing]  = useState<Review | null>(null);
  const [form,     setForm]     = useState(blank);
  const [file,     setFile]     = useState<File | null>(null);
  const [filter,   setFilter]   = useState<"all" | Status>("all");
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
      .catch((e: Error) => setError(e.message ?? "Failed to connect"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setActing(id);
    await fetch(`/api/studio/reviews/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    setActing(null);
    load();
  };

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
    if (res.ok) {
      setForm(blank); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Failed");
    }
  };

  const handleEditSave = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await fetch(`/api/studio/reviews/${editing.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name: editing.name, role: editing.role, review: editing.review,
        rating: editing.rating, branch: editing.branch, sort_order: editing.sort_order,
      }),
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

  const visible = filter === "all"
    ? items
    : items.filter((r) => (r.status ?? "pending") === filter);

  const counts = {
    all:      items.length,
    pending:  items.filter((r) => (r.status ?? "pending") === "pending").length,
    approved: items.filter((r) => r.status === "approved").length,
    rejected: items.filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="space-y-6">

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          <strong>Connection error:</strong> {error}
          <button onClick={load} className="ml-3 underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Add form */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-[14px] font-semibold text-[#0B1F3A]">Add Review</h2>
        <p className="mb-4 text-[12px] text-gray-400">New reviews start as <span className="font-semibold text-amber-600">Pending</span> — approve them below to show on the homepage.</p>

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
            <textarea value={form.review} onChange={(e) => setForm({ ...form, review: e.target.value })} rows={3} placeholder="Write the review here…" required className={TEXTAREA} />
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

      {/* Filter tabs */}
      {!loading && !error && items.length > 0 && (
        <div className="flex gap-1 rounded-xl border border-gray-100 bg-white p-1.5 shadow-sm w-fit">
          {(["all", "pending", "approved", "rejected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                "rounded-lg px-4 py-1.5 text-[12px] font-semibold transition",
                filter === f
                  ? "bg-[#0B1F3A] text-white"
                  : "text-gray-400 hover:text-gray-600",
              ].join(" ")}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className={[
                "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]",
                filter === f ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500",
              ].join(" ")}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#38BDF8] border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => {
            const status = (item.status ?? "pending") as Status;
            return (
              <div key={item.id} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="p-4">
                  {editing?.id === item.id ? (
                    /* ── Inline edit form ── */
                    <div className="space-y-2">
                      <input value={editing.name}         onChange={(e) => setEditing({ ...editing, name: e.target.value })}         className={INPUT} placeholder="Name" />
                      <input value={editing.role ?? ""}   onChange={(e) => setEditing({ ...editing, role: e.target.value })}         className={INPUT} placeholder="Role" />
                      <textarea value={editing.review}    onChange={(e) => setEditing({ ...editing, review: e.target.value })}       className={`${INPUT} resize-none`} rows={3} placeholder="Review" />
                      <input value={editing.branch ?? ""} onChange={(e) => setEditing({ ...editing, branch: e.target.value })}       className={INPUT} placeholder="Branch" />
                      <input type="number" min="1" max="5" step="0.1" value={editing.rating ?? 5}
                        onChange={(e) => setEditing({ ...editing, rating: Number(e.target.value) })} className={INPUT} placeholder="Rating" />
                      <input type="number" value={editing.sort_order}
                        onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className={INPUT} placeholder="Sort order" />
                      <div className="flex gap-2 pt-1">
                        <button onClick={handleEditSave} disabled={saving} className="flex-1 rounded-lg bg-[#0B1F3A] py-2 text-[12px] font-semibold text-white hover:bg-[#38BDF8] disabled:opacity-50 transition">{saving ? "…" : "Save"}</button>
                        <button onClick={() => setEditing(null)} className="flex-1 rounded-lg border border-gray-200 py-2 text-[12px] font-semibold text-gray-500 hover:bg-gray-50">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    /* ── Review card ── */
                    <>
                      {/* Author row */}
                      <div className="flex items-start gap-3">
                        {item.image_url ? (
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                            <Image src={item.image_url} alt={item.name} fill sizes="40px" className="object-cover" />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0B1F3A]/8 text-[13px] font-bold text-[#0B1F3A]">
                            {item.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[13px] font-bold text-[#0B1F3A]">{item.name}</p>
                            {item.featured && (
                              <span className="shrink-0 rounded-full bg-[#FF8A1F]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#FF8A1F]">FEATURED</span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400">{[item.role, item.branch].filter(Boolean).join(" · ")}</p>
                          {item.rating != null && <Stars rating={item.rating} />}
                        </div>
                        {/* Status badge */}
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[status]}`}>
                          {STATUS_LABEL[status]}
                        </span>
                      </div>

                      <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-gray-600">&ldquo;{item.review}&rdquo;</p>

                      {/* Moderation actions */}
                      <div className="mt-3 space-y-1.5">
                        {/* Status row */}
                        <div className="flex gap-1.5">
                          {status !== "approved" && (
                            <button
                              onClick={() => patch(item.id, { status: "approved" })}
                              disabled={acting === item.id}
                              className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                            >
                              {acting === item.id ? "…" : "Approve"}
                            </button>
                          )}
                          {status !== "rejected" && (
                            <button
                              onClick={() => patch(item.id, { status: "rejected" })}
                              disabled={acting === item.id}
                              className="flex-1 rounded-lg border border-red-200 bg-red-50 py-1.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                            >
                              {acting === item.id ? "…" : "Reject"}
                            </button>
                          )}
                          {status !== "pending" && (
                            <button
                              onClick={() => patch(item.id, { status: "pending" })}
                              disabled={acting === item.id}
                              className="flex-1 rounded-lg border border-amber-200 bg-amber-50 py-1.5 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                            >
                              {acting === item.id ? "…" : "Set Pending"}
                            </button>
                          )}
                        </div>

                        {/* Feature + edit + delete row */}
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => patch(item.id, { featured: !item.featured })}
                            disabled={acting === item.id}
                            className={[
                              "flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition disabled:opacity-50",
                              item.featured
                                ? "border-[#FF8A1F]/30 bg-[#FF8A1F]/8 text-[#FF8A1F] hover:bg-[#FF8A1F]/15"
                                : "border-gray-200 text-gray-400 hover:border-[#FF8A1F]/30 hover:text-[#FF8A1F]",
                            ].join(" ")}
                          >
                            {acting === item.id ? "…" : item.featured ? "Unfeature" : "Feature"}
                          </button>
                          <button
                            onClick={() => setEditing(item)}
                            className="flex-1 rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-gray-600 transition hover:border-[#38BDF8] hover:text-[#38BDF8]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={deleting === item.id}
                            className="flex-1 rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-red-400 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                          >
                            {deleting === item.id ? "…" : "Delete"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {!error && visible.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-gray-200 bg-gray-50 p-12 text-center">
              <p className="text-[14px] font-semibold text-gray-400">
                {filter === "all" ? "No reviews yet" : `No ${filter} reviews`}
              </p>
              {filter === "all" && (
                <p className="mt-1 text-[12px] text-gray-300">Add your first review using the form above.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
