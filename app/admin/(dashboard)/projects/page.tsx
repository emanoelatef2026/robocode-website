"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import EmptyStateCard from "@/components/admin/EmptyStateCard";
import CharacterLimitHint from "@/components/admin/CharacterLimitHint";
import MediaRequirementsBadge from "@/components/admin/MediaRequirementsBadge";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Project {
  id:           string;
  title:        string;
  description:  string | null;
  image_url:    string | null;
  technologies: string[] | null;
  video_url:    string | null;
  difficulty:   string | null;
  age_group:    string | null;
  featured:     boolean;
  created_at:   string;
}

const EMPTY: Omit<Project, "id" | "created_at"> = {
  title: "", description: "", image_url: null, technologies: null,
  video_url: "", difficulty: "", age_group: "", featured: false,
};

const TITLE_MAX = 40;
const DESC_MAX  = 120;

// ── Styles ────────────────────────────────────────────────────────────────────

const INPUT = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-[#0B1F3A] outline-none transition focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</label>
      {children}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [projects,   setProjects]   = useState<Project[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState<{ mode: "add" | "edit"; project?: Project } | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [form,       setForm]       = useState<Omit<Project, "id" | "created_at">>(EMPTY);
  const [imageFile,  setImageFile]  = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/projects")
      .then((r) => r.json())
      .then((d) => { setProjects(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm(EMPTY);
    setImageFile(null);
    setModal({ mode: "add" });
  };

  const openEdit = (p: Project) => {
    setForm({
      title: p.title, description: p.description ?? "",
      image_url: p.image_url, technologies: p.technologies,
      video_url: p.video_url ?? "", difficulty: p.difficulty ?? "",
      age_group: p.age_group ?? "", featured: p.featured,
    });
    setImageFile(null);
    setModal({ mode: "edit", project: p });
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);

    const fd = new FormData();
    fd.append("title",        form.title);
    fd.append("description",  form.description ?? "");
    fd.append("technologies", (form.technologies ?? []).join(", "));
    fd.append("video_url",    form.video_url ?? "");
    fd.append("difficulty",   form.difficulty ?? "");
    fd.append("age_group",    form.age_group ?? "");
    fd.append("featured",     String(form.featured));
    if (imageFile) fd.append("image", imageFile);

    const url    = modal?.mode === "edit" ? `/api/admin/projects/${modal.project!.id}` : "/api/admin/projects";
    const method = modal?.mode === "edit" ? "PATCH" : "POST";

    const res = await fetch(url, { method, body: fd });
    setSaving(false);
    if (res.ok) { setModal(null); load(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    setDeleting(id);
    await fetch(`/api/admin/projects/${id}`, { method: "DELETE" });
    setDeleting(null);
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
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-gray-400">{projects.length} projects</p>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-lg bg-[#0B1F3A] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#38BDF8]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Project
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <div key={p.id} className="group rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              {p.image_url ? (
                <div className="relative h-40 w-full overflow-hidden bg-gray-100">
                  <Image src={p.image_url} alt={p.title} fill className="object-cover transition group-hover:scale-105" />
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center bg-linear-to-br from-[#0B1F3A] to-[#38BDF8]/30">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-8 w-8 text-white/30">
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[14px] font-semibold text-[#0B1F3A] leading-snug">{p.title}</h3>
                  {p.featured && (
                    <span className="shrink-0 rounded-full bg-[#38BDF8]/10 px-2 py-0.5 text-[10px] font-bold text-[#38BDF8]">
                      Featured
                    </span>
                  )}
                </div>
                {p.description && (
                  <p className="mt-1 line-clamp-2 text-[12px] text-gray-400">{p.description}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => openEdit(p)}
                    className="flex-1 rounded-lg border border-gray-200 py-1.5 text-[12px] font-medium text-gray-500 transition hover:border-[#38BDF8] hover:text-[#38BDF8]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deleting === p.id}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-red-400 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleting === p.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {projects.length === 0 && (
            <EmptyStateCard
              title="No projects yet"
              description="Add your first student project."
              size="tall"
            />
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-[15px] font-semibold text-[#0B1F3A]">
                {modal.mode === "add" ? "Add Project" : "Edit Project"}
              </h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <Field label={`Title * (max ${TITLE_MAX})`}>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value.slice(0, TITLE_MAX) })}
                  className={INPUT}
                  placeholder="e.g. AI Robot Assistant"
                />
                <CharacterLimitHint current={form.title.length} max={TITLE_MAX} />
              </Field>

              <Field label={`Description (max ${DESC_MAX})`}>
                <textarea
                  value={form.description ?? ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, DESC_MAX) })}
                  rows={3}
                  className={INPUT}
                  placeholder="Short project description…"
                />
                <CharacterLimitHint current={(form.description ?? "").length} max={DESC_MAX} />
              </Field>

              <Field label="Technologies (comma-separated)">
                <input
                  value={(form.technologies ?? []).join(", ")}
                  onChange={(e) => setForm({ ...form, technologies: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                  className={INPUT}
                  placeholder="Python, Raspberry Pi, OpenCV"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Difficulty">
                  <select
                    value={form.difficulty ?? ""}
                    onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                    className={INPUT}
                  >
                    <option value="">Select…</option>
                    {["Beginner", "Intermediate", "Advanced"].map((d) => <option key={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Age Group">
                  <input
                    value={form.age_group ?? ""}
                    onChange={(e) => setForm({ ...form, age_group: e.target.value })}
                    className={INPUT}
                    placeholder="8-12 yrs"
                  />
                </Field>
              </div>

              <Field label="Video URL">
                <input
                  value={form.video_url ?? ""}
                  onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                  className={INPUT}
                  placeholder="https://youtube.com/…"
                />
              </Field>

              <Field label="Project Image">
                <div className="mb-2">
                  <MediaRequirementsBadge type="image" compact />
                </div>
                {form.image_url && !imageFile && (
                  <div className="relative mb-2 h-28 w-full overflow-hidden rounded-lg bg-gray-100">
                    <Image src={form.image_url} alt="current" fill className="object-cover" />
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-[13px] text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-gray-600 hover:file:bg-gray-200"
                />
              </Field>

              <label className="flex items-center gap-2 text-[13px] text-gray-600">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  className="h-4 w-4 accent-[#38BDF8]"
                />
                Mark as Featured
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={() => setModal(null)} className="rounded-lg px-4 py-2 text-[13px] text-gray-500 hover:bg-gray-100">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                className="rounded-lg bg-[#0B1F3A] px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#38BDF8] disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
