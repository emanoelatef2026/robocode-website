"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stage {
  id:           string;
  title:        string;
  age_range:    string;
  description:  string;
  image_url:    string;
  skills:       string[];
  technologies: string[];
  outcomes:     string[];
  active:       boolean;
  sort_order:   number;
  created_at:   string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const linesToArray = (text: string): string[] =>
  text.split("\n").map((s) => s.trim()).filter(Boolean);

const arrayToLines = (arr: string[] | null | undefined): string =>
  (arr ?? []).join("\n");

// ── Styles ────────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-[#0F172A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20";

const textareaCls =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-[#0F172A] outline-none transition focus:border-[#FF8A1F] focus:ring-2 focus:ring-[#FF8A1F]/20 resize-none";

const labelCls =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400";

const BLANK = {
  title:        "",
  age_range:    "",
  description:  "",
  skills:       "",
  technologies: "",
  outcomes:     "",
  sort_order:   "0",
  active:       true,
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LearningJourneyAdminPage() {
  const [stages,          setStages]          = useState<Stage[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [deleting,        setDeleting]        = useState<string | null>(null);
  const [toggling,        setToggling]        = useState<string | null>(null);
  const [showForm,        setShowForm]        = useState(false);
  const [editingId,       setEditingId]       = useState<string | null>(null);
  const [form,            setForm]            = useState(BLANK);
  const [imageFile,       setImageFile]       = useState<File | null>(null);
  const [previewUrl,      setPreviewUrl]      = useState("");
  const [currentImageUrl, setCurrentImageUrl] = useState("");

  const fileRef  = useRef<HTMLInputElement>(null);
  const formRef  = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/learning-journey")
      .then((r) => r.json())
      .then((d) => setStages(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setImageFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : "");
  };

  // ── Submit (add or update) ─────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const fd = new FormData();
    fd.append("title",        form.title.trim());
    fd.append("age_range",    form.age_range.trim());
    fd.append("description",  form.description.trim());
    fd.append("skills",       JSON.stringify(linesToArray(form.skills)));
    fd.append("technologies", JSON.stringify(linesToArray(form.technologies)));
    fd.append("outcomes",     JSON.stringify(linesToArray(form.outcomes)));
    fd.append("sort_order",   form.sort_order);
    fd.append("active",       String(form.active));
    if (imageFile) fd.append("image", imageFile);

    const url    = editingId
      ? `/api/admin/learning-journey/${editingId}`
      : "/api/admin/learning-journey";
    const method = editingId ? "PATCH" : "POST";

    const res = await fetch(url, { method, body: fd });
    setSaving(false);

    if (res.ok) {
      resetForm();
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      alert((d as { error?: string }).error ?? "Failed to save");
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────

  const handleEdit = (stage: Stage) => {
    setForm({
      title:        stage.title,
      age_range:    stage.age_range,
      description:  stage.description,
      skills:       arrayToLines(stage.skills),
      technologies: arrayToLines(stage.technologies),
      outcomes:     arrayToLines(stage.outcomes),
      sort_order:   String(stage.sort_order),
      active:       stage.active,
    });
    setCurrentImageUrl(stage.image_url);
    setPreviewUrl("");
    setImageFile(null);
    setEditingId(stage.id);
    setShowForm(true);
    if (fileRef.current) fileRef.current.value = "";
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this stage? This cannot be undone.")) return;
    setDeleting(id);
    await fetch(`/api/admin/learning-journey/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  };

  // ── Toggle active ─────────────────────────────────────────────────────────

  const handleToggleActive = async (stage: Stage) => {
    setToggling(stage.id);
    const fd = new FormData();
    fd.append("active", String(!stage.active));
    await fetch(`/api/admin/learning-journey/${stage.id}`, { method: "PATCH", body: fd });
    setToggling(null);
    load();
  };

  // ── Reset form ────────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm(BLANK);
    setImageFile(null);
    setPreviewUrl("");
    setCurrentImageUrl("");
    setEditingId(null);
    setShowForm(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-bold text-[#0F172A]">Learning Journey</h1>
          <p className="mt-0.5 text-[13px] text-gray-400">
            {loading ? "Loading…" : `${stages.length} stage${stages.length !== 1 ? "s" : ""} configured`}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="rounded-lg bg-[#FF8A1F] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_2px_12px_rgba(255,138,31,0.35)] transition hover:brightness-110"
          >
            + Add Stage
          </button>
        )}
      </div>

      {/* ── Add / Edit form ─────────────────────────────────────────────────── */}
      {showForm && (
        <div ref={formRef} id="lj-form" className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-[#0F172A]">
              {editingId ? "Edit Stage" : "Add New Stage"}
            </h2>
            <button
              onClick={resetForm}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-semibold text-gray-400 transition hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Row 1: Title + Age Range + Sort Order + Active */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <label className={labelCls}>Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Explorer"
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Age Range *</label>
                <input
                  value={form.age_range}
                  onChange={(e) => setForm({ ...form, age_range: e.target.value })}
                  placeholder="e.g. Ages 6–8"
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Sort Order</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                  placeholder="0"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>Description *</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe what students learn and achieve at this stage…"
                required
                rows={3}
                className={textareaCls}
              />
            </div>

            {/* Skills + Technologies */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Skills (one per line)</label>
                <textarea
                  value={form.skills}
                  onChange={(e) => setForm({ ...form, skills: e.target.value })}
                  placeholder={"Logical Thinking\nCreativity\nProblem Solving"}
                  rows={4}
                  className={textareaCls}
                />
              </div>
              <div>
                <label className={labelCls}>Technologies (one per line)</label>
                <textarea
                  value={form.technologies}
                  onChange={(e) => setForm({ ...form, technologies: e.target.value })}
                  placeholder={"Scratch\nLEGO Mindstorms\nTinkercad"}
                  rows={4}
                  className={textareaCls}
                />
              </div>
            </div>

            {/* Outcomes */}
            <div>
              <label className={labelCls}>Learning Outcomes (one per line)</label>
              <textarea
                value={form.outcomes}
                onChange={(e) => setForm({ ...form, outcomes: e.target.value })}
                placeholder={"Build and animate their first game\nProgram a LEGO robot\nDesign a digital project"}
                rows={4}
                className={textareaCls}
              />
            </div>

            {/* Image upload */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>
                  Hero Image {editingId ? "(leave blank to keep existing)" : ""}
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block w-full text-[13px] text-gray-500 file:mr-2 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-gray-600 hover:file:bg-gray-200"
                />

                {/* Image guidelines */}
                <div className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    Recommended
                  </p>
                  <ul className="space-y-0.5 text-[11px] text-gray-400">
                    <li>· 1600 × 900 px</li>
                    <li>· 16:9 ratio</li>
                    <li>· WebP format</li>
                    <li>· Max 300 KB</li>
                    <li>· Avoid text near edges</li>
                  </ul>
                </div>
              </div>

              {/* Image preview */}
              <div>
                <label className={labelCls}>Preview</label>
                {previewUrl ? (
                  <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: "16/9" }}>
                    <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                  </div>
                ) : currentImageUrl ? (
                  <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: "16/9" }}>
                    <Image src={currentImageUrl} alt="Current image" fill className="object-cover" />
                    <div className="absolute inset-0 flex items-end bg-linear-to-t from-black/40 to-transparent">
                      <p className="px-3 pb-2 text-[10px] font-semibold text-white/70">Current image</p>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-[12px] text-gray-300"
                    style={{ aspectRatio: "16/9" }}
                  >
                    No image
                  </div>
                )}
              </div>
            </div>

            {/* Active toggle + submit */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-4">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 rounded accent-[#FF8A1F]"
                />
                <span className="text-[13px] font-medium text-gray-600">Active (visible on homepage)</span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#0B1F3A] px-6 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#163560] disabled:opacity-50"
              >
                {saving ? "Saving…" : editingId ? "Save Changes" : "Add Stage"}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* ── Stage list ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FF8A1F] border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md"
            >
              {/* Image / placeholder */}
              <div className="relative w-full overflow-hidden bg-[#0B1F3A]" style={{ aspectRatio: "16/9" }}>
                {stage.image_url ? (
                  <Image
                    src={stage.image_url}
                    alt={stage.title}
                    fill
                    sizes="400px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <p className="text-2xl font-black text-white/20">{stage.sort_order + 1}</p>
                      <p className="mt-1 text-xs text-white/30">{stage.title}</p>
                    </div>
                  </div>
                )}

                {/* Active badge */}
                <span
                  className={[
                    "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold",
                    stage.active
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-500/70 text-white",
                  ].join(" ")}
                >
                  {stage.active ? "Active" : "Hidden"}
                </span>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-bold text-[#0F172A]">{stage.title}</p>
                    <p className="text-[12px] text-[#FF8A1F]">{stage.age_range}</p>
                  </div>
                  <span className="shrink-0 rounded-md border border-gray-100 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-400">
                    #{stage.sort_order}
                  </span>
                </div>

                <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-gray-400">
                  {stage.description}
                </p>

                {/* Tags count */}
                <div className="mt-3 flex gap-3 text-[11px] text-gray-300">
                  <span>{stage.skills?.length ?? 0} skills</span>
                  <span>·</span>
                  <span>{stage.technologies?.length ?? 0} tools</span>
                  <span>·</span>
                  <span>{stage.outcomes?.length ?? 0} outcomes</span>
                </div>

                {/* Actions */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleEdit(stage)}
                    className="rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-gray-600 transition hover:border-[#0B1F3A] hover:text-[#0B1F3A]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(stage)}
                    disabled={toggling === stage.id}
                    className={[
                      "rounded-lg border py-1.5 text-[11px] font-semibold transition disabled:opacity-50",
                      stage.active
                        ? "border-orange-200 bg-orange-50 text-[#FF8A1F] hover:bg-orange-100"
                        : "border-gray-200 text-gray-400 hover:border-[#FF8A1F] hover:text-[#FF8A1F]",
                    ].join(" ")}
                  >
                    {toggling === stage.id ? "…" : stage.active ? "Hide" : "Show"}
                  </button>
                  <button
                    onClick={() => handleDelete(stage.id)}
                    disabled={deleting === stage.id}
                    className="rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-red-400 transition hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleting === stage.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {stages.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-gray-200 py-24 text-center text-gray-400">
              <p className="text-sm font-medium">No stages yet</p>
              <p className="mt-1 text-xs">Click &ldquo;Add Stage&rdquo; above to create your first learning stage.</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
