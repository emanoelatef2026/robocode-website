"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import EmptyStateCard from "@/components/studio/EmptyStateCard";
import MediaRequirementsBadge from "@/components/studio/MediaRequirementsBadge";

// ── Types ─────────────────────────────────────────────────────────────────────

type StudyMode = "online" | "offline" | "hybrid";

interface Branch {
  id:         string;
  name:       string;
  phone:      string | null;
  location:   string | null;
  image_url:  string | null;
  active:     boolean;
  sort_order: number;
  study_mode: StudyMode;
  created_at: string;
}

const EMPTY: Omit<Branch, "id" | "created_at"> = {
  name: "", phone: "", location: "", image_url: null, active: true, sort_order: 0, study_mode: "offline",
};

const INPUT = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-[#0B1F3A] outline-none transition focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/20";

// ── Study mode label ──────────────────────────────────────────────────────────

const STUDY_MODE_LABELS: Record<string, { label: string; color: string }> = {
  online:  { label: "Online",    color: "bg-[#38BDF8]/10 text-[#0EA5E9]" },
  offline: { label: "In-Person", color: "bg-[#FF8A1F]/10 text-[#FF8A1F]" },
  hybrid:  { label: "Hybrid",    color: "bg-purple-100 text-purple-600" },
};

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BranchesPage() {
  const [branches,   setBranches]   = useState<Branch[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState<{ mode: "add" | "edit"; branch?: Branch } | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [toggling,   setToggling]   = useState<string | null>(null);
  const [form,       setForm]       = useState<Omit<Branch, "id" | "created_at">>(EMPTY);
  const [imageFile,  setImageFile]  = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/studio/branches")
      .then((r) => r.json())
      .then((d) => { setBranches(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm({ ...EMPTY, sort_order: branches.length });
    setImageFile(null);
    setImgPreview(null);
    setModal({ mode: "add" });
  };

  const openEdit = (b: Branch) => {
    setForm({
      name: b.name, phone: b.phone ?? "", location: b.location ?? "",
      image_url: b.image_url, active: b.active, sort_order: b.sort_order,
      study_mode: b.study_mode ?? "offline",
    });
    setImageFile(null);
    setImgPreview(null);
    setModal({ mode: "edit", branch: b });
  };

  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setImgPreview(url);
    } else {
      setImgPreview(null);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);

    const fd = new FormData();
    fd.append("name",       form.name);
    fd.append("phone",      form.phone ?? "");
    fd.append("location",   form.location ?? "");
    fd.append("sort_order", String(form.sort_order));
    fd.append("active",     String(form.active));
    fd.append("study_mode", form.study_mode);
    if (imageFile) fd.append("image", imageFile);

    const url    = modal?.mode === "edit" ? `/api/studio/branches/${modal.branch!.id}` : "/api/studio/branches";
    const method = modal?.mode === "edit" ? "PATCH" : "POST";

    const res = await fetch(url, { method, body: fd });
    setSaving(false);
    if (res.ok) { setModal(null); load(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this branch?")) return;
    setDeleting(id);
    await fetch(`/api/studio/branches/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  };

  const handleToggleActive = async (b: Branch) => {
    setToggling(b.id);
    const fd = new FormData();
    fd.append("name",       b.name);
    fd.append("phone",      b.phone ?? "");
    fd.append("location",   b.location ?? "");
    fd.append("sort_order", String(b.sort_order));
    fd.append("active",     String(!b.active));
    fd.append("study_mode", b.study_mode ?? "offline");
    await fetch(`/api/studio/branches/${b.id}`, { method: "PATCH", body: fd });
    setToggling(null);
    load();
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#38BDF8] border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-gray-400">{branches.length} branches</p>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-lg bg-[#0B1F3A] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#38BDF8]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Branch
          </button>
        </div>

        {/* Branch list */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <div
              key={b.id}
              className={`group overflow-hidden rounded-xl border bg-white shadow-sm transition ${b.active ? "border-gray-100" : "border-gray-100 opacity-60"}`}
            >
              {/* Image */}
              {b.image_url ? (
                <div className="relative h-36 w-full overflow-hidden bg-gray-100">
                  <Image src={b.image_url} alt={b.name} fill className="object-cover transition group-hover:scale-105" />
                </div>
              ) : (
                <div className="flex h-36 items-center justify-center bg-linear-to-br from-[#0B1F3A] to-[#38BDF8]/30">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-8 w-8 text-white/30">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-[14px] font-semibold text-[#0B1F3A] leading-snug">{b.name}</h3>
                      {(() => {
                        const m = STUDY_MODE_LABELS[b.study_mode ?? "offline"];
                        return (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${m.color}`}>
                            {m.label}
                          </span>
                        );
                      })()}
                    </div>
                    {b.phone && (
                      <p className="mt-0.5 text-[12px] text-gray-400">{b.phone}</p>
                    )}
                    {b.location && (
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-gray-400">{b.location}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-300">#{b.sort_order}</span>
                    {/* Toggle active */}
                    <button
                      onClick={() => handleToggleActive(b)}
                      disabled={toggling === b.id}
                      className={`flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50 ${b.active ? "bg-[#38BDF8]" : "bg-gray-200"}`}
                      title={b.active ? "Active — click to deactivate" : "Inactive — click to activate"}
                    >
                      <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${b.active ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => openEdit(b)}
                    className="flex-1 rounded-lg border border-gray-200 py-1.5 text-[12px] font-medium text-gray-500 transition hover:border-[#38BDF8] hover:text-[#38BDF8]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(b.id)}
                    disabled={deleting === b.id}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-red-400 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleting === b.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {branches.length === 0 && (
            <EmptyStateCard
              title="No branches yet"
              description="Add your first branch to display it on the website."
              size="tall"
            />
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">

            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-[15px] font-semibold text-[#0B1F3A]">
                {modal.mode === "add" ? "Add Branch" : "Edit Branch"}
              </h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="space-y-4 px-6 py-5">
              <Field label="Branch Name *">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={INPUT}
                  placeholder="e.g. Cairo — Maadi"
                />
              </Field>

              <Field label="Phone">
                <input
                  value={form.phone ?? ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={INPUT}
                  placeholder="+20 10 0000 0000"
                  type="tel"
                />
              </Field>

              <Field label="Location (address or maps query)">
                <input
                  value={form.location ?? ""}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className={INPUT}
                  placeholder="123 Street, District, City"
                />
              </Field>

              <Field label="Sort Order">
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value, 10) || 0 })}
                  className={INPUT}
                  min={0}
                />
              </Field>

              <Field label="Branch Image">
                <div className="mb-2">
                  <MediaRequirementsBadge type="image" compact />
                </div>
                {/* Image preview */}
                {(imgPreview || (form.image_url && !imageFile)) && (
                  <div className="relative mb-2 h-36 w-full overflow-hidden rounded-lg bg-gray-100">
                    <Image
                      src={imgPreview ?? form.image_url!}
                      alt="preview"
                      fill
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImgPreview(null); setForm({ ...form, image_url: null }); if (fileRef.current) fileRef.current.value = ""; }}
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow hover:text-red-500"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
                  className="block w-full text-[13px] text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-gray-600 hover:file:bg-gray-200"
                />
                <p className="mt-1 text-[11px] text-gray-400">WebP / PNG / JPG — max 300 KB recommended</p>
              </Field>

              <Field label="Study Mode">
                <div className="flex gap-2">
                  {(["online", "offline", "hybrid"] as const).map((mode) => {
                    const { label, color } = STUDY_MODE_LABELS[mode];
                    const isActive = form.study_mode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setForm({ ...form, study_mode: mode })}
                        className={[
                          "flex-1 rounded-lg border py-2 text-[12px] font-semibold transition",
                          isActive
                            ? `${color} border-current`
                            : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600",
                        ].join(" ")}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              {/* Active toggle */}
              <label className="flex items-center gap-2.5 text-[13px] text-gray-600">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, active: !form.active })}
                  className={`flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${form.active ? "bg-[#38BDF8]" : "bg-gray-200"}`}
                >
                  <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${form.active ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                {form.active ? "Active — visible on site" : "Inactive — hidden from site"}
              </label>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button
                onClick={() => setModal(null)}
                className="rounded-lg px-4 py-2 text-[13px] text-gray-500 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="rounded-lg bg-[#0B1F3A] px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#38BDF8] disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Branch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
