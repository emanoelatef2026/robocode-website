"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

interface Student {
  id:          string;
  name:        string;
  grade:       string;
  country:     string;
  image_url:   string;
  youtube_url: string;
  featured:    boolean;
  sort_order:  number;
  created_at:  string;
}

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-[#0B132B] outline-none focus:border-[#19C6F4] focus:ring-2 focus:ring-[#19C6F4]/20";

const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400";

const blank = {
  name:        "",
  grade:       "",
  country:     "",
  youtube_url: "",
  featured:    true,
  sort_order:  "0",
};

export default function StudentsPage() {
  const [students,   setStudents]   = useState<Student[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [editing,    setEditing]    = useState<Student | null>(null);
  const [form,       setForm]       = useState(blank);
  const [file,       setFile]       = useState<File | null>(null);
  const [toggling,   setToggling]   = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/students")
      .then((r) => r.json())
      .then((d) => { setStudents(Array.isArray(d) ? d : []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // ── Add ────────────────────────────────────────────────────────────────────

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setSaving(true);

    const fd = new FormData();
    fd.append("image",       file);
    fd.append("name",        form.name);
    fd.append("grade",       form.grade);
    fd.append("country",     form.country);
    fd.append("youtube_url", form.youtube_url);
    fd.append("featured",    String(form.featured));
    fd.append("sort_order",  form.sort_order);

    const res = await fetch("/api/admin/students", { method: "POST", body: fd });
    setSaving(false);

    if (res.ok) {
      setForm(blank);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Failed to add student");
    }
  };

  // ── Edit save ──────────────────────────────────────────────────────────────

  const handleEditSave = async () => {
    if (!editing) return;
    setSaving(true);

    const res = await fetch(`/api/admin/students/${editing.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:        editing.name,
        grade:       editing.grade,
        country:     editing.country,
        youtube_url: editing.youtube_url,
        featured:    editing.featured,
        sort_order:  editing.sort_order,
      }),
    });

    setSaving(false);
    if (res.ok) { setEditing(null); load(); }
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Failed to save");
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this student?")) return;
    setDeleting(id);
    await fetch(`/api/admin/students/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  };

  // ── Feature toggle ────────────────────────────────────────────────────────

  const handleToggleFeatured = async (student: Student) => {
    setToggling(student.id);
    await fetch(`/api/admin/students/${student.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured: !student.featured }),
    });
    setToggling(null);
    load();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Add form ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-[14px] font-semibold text-[#0B132B]">Add New Student</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelCls}>Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Ahmed Mohamed"
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Grade *</label>
              <input
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                placeholder="e.g. Grade 8"
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Country *</label>
              <input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="e.g. Egypt"
                required
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>YouTube Shorts URL *</label>
            <input
              value={form.youtube_url}
              onChange={(e) => setForm({ ...form, youtube_url: e.target.value })}
              placeholder="https://youtube.com/shorts/..."
              required
              className={inputCls}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label className={labelCls}>Photo *</label>
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
              <label className={labelCls}>Sort Order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                placeholder="0"
                className={inputCls}
              />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  className="h-4 w-4 rounded accent-[#19C6F4]"
                />
                <span className="text-[13px] font-medium text-gray-600">Featured</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !file}
              className="rounded-lg bg-[#0B132B] px-6 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#19C6F4] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add Student"}
            </button>
          </div>
        </form>
      </div>

      {/* ── List ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#19C6F4] border-t-transparent" />
        </div>
      ) : (
        <>
          <p className="text-[13px] text-gray-400">{students.length} students</p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {students.map((s) => (
              <div
                key={s.id}
                className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
              >
                {/* Image */}
                <div className="relative h-52 w-full overflow-hidden bg-gray-100">
                  <Image
                    src={s.image_url}
                    alt={s.name}
                    fill
                    sizes="280px"
                    className="object-cover"
                  />
                  {/* Featured badge */}
                  {s.featured && (
                    <span className="absolute left-2 top-2 rounded-full bg-[#19C6F4] px-2 py-0.5 text-[10px] font-bold text-white">
                      Featured
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  {editing?.id === s.id ? (
                    /* Inline edit mode */
                    <div className="space-y-2">
                      <input
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        className={inputCls}
                        placeholder="Name"
                      />
                      <input
                        value={editing.grade}
                        onChange={(e) => setEditing({ ...editing, grade: e.target.value })}
                        className={inputCls}
                        placeholder="Grade"
                      />
                      <input
                        value={editing.country}
                        onChange={(e) => setEditing({ ...editing, country: e.target.value })}
                        className={inputCls}
                        placeholder="Country"
                      />
                      <input
                        value={editing.youtube_url}
                        onChange={(e) => setEditing({ ...editing, youtube_url: e.target.value })}
                        className={inputCls}
                        placeholder="YouTube URL"
                      />
                      <input
                        type="number"
                        value={editing.sort_order}
                        onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                        className={inputCls}
                        placeholder="Sort order"
                      />
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleEditSave}
                          disabled={saving}
                          className="flex-1 rounded-lg bg-[#0B132B] py-2 text-[12px] font-semibold text-white transition hover:bg-[#19C6F4] disabled:opacity-50"
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="flex-1 rounded-lg border border-gray-200 py-2 text-[12px] font-semibold text-gray-500 transition hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <>
                      <p className="truncate text-[13px] font-bold text-[#0B132B]">{s.name}</p>
                      <p className="text-[12px] text-gray-400">{s.grade} · {s.country}</p>
                      <p className="mt-1 truncate text-[11px] text-gray-300">{s.youtube_url}</p>
                      <p className="text-[11px] text-gray-300">Order: {s.sort_order}</p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => setEditing(s)}
                          className="flex-1 rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-gray-600 transition hover:border-[#19C6F4] hover:text-[#19C6F4]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleFeatured(s)}
                          disabled={toggling === s.id}
                          className={[
                            "flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition disabled:opacity-50",
                            s.featured
                              ? "border-cyan-200 bg-cyan-50 text-[#19C6F4] hover:bg-cyan-100"
                              : "border-gray-200 text-gray-400 hover:border-cyan-200 hover:text-[#19C6F4]",
                          ].join(" ")}
                        >
                          {toggling === s.id ? "…" : s.featured ? "Unfeature" : "Feature"}
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={deleting === s.id}
                          className="w-full rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-red-400 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deleting === s.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}

            {students.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-gray-200 py-20 text-center text-gray-400">
                No students yet — add your first one above
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
