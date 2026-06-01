"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Student {
  id:                      string;
  name:                    string;
  image_url:               string;
  achievement_title:       string | null;
  achievement_description: string | null;
  youtube_url:             string | null;
  featured:                boolean;
  sort_order:              number;
  created_at:              string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const INPUT    = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-[#0B1F3A] outline-none transition focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/20";
const LABEL    = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400";
const TEXTAREA = `${INPUT} resize-none`;

const blank = {
  name:                    "",
  achievement_title:       "",
  achievement_description: "",
  youtube_url:             "",
  sort_order:              "0",
};

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({
  student,
  onSave,
  onClose,
}: {
  student: Student;
  onSave:  (updated: Student) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name:                    student.name,
    achievement_title:       student.achievement_title       ?? "",
    achievement_description: student.achievement_description ?? "",
    youtube_url:             student.youtube_url             ?? "",
    sort_order:              String(student.sort_order),
    featured:                student.featured,
  });
  const [file,    setFile]    = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const fd = new FormData();
    fd.append("name",                    form.name);
    fd.append("achievement_title",       form.achievement_title);
    fd.append("achievement_description", form.achievement_description);
    fd.append("youtube_url",             form.youtube_url);
    fd.append("sort_order",              form.sort_order);
    fd.append("featured",                String(form.featured));
    if (file) fd.append("image", file);

    const res = await fetch(`/api/studio/students/${student.id}`, { method: "PATCH", body: fd });
    setSaving(false);

    if (res.ok) {
      const updated = await res.json();
      onSave(updated);
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Failed to save");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh]"
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-[#0B1F3A]">Edit Student</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition hover:bg-gray-200"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Image preview + replacement */}
          <div>
            <label className={LABEL}>Photo</label>
            <div className="flex items-start gap-4">
              <div className="relative h-24 w-18 shrink-0 overflow-hidden rounded-xl bg-gray-100" style={{ width: "4.5rem" }}>
                <Image
                  src={preview ?? student.image_url}
                  alt={form.name}
                  fill
                  sizes="72px"
                  className="object-cover"
                />
              </div>
              <div className="flex-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-[12px] text-gray-500 file:mr-2 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:text-gray-600 hover:file:bg-gray-200"
                />
                <p className="mt-1 text-[11px] text-gray-400">Leave blank to keep current photo. 3:4 portrait recommended.</p>
              </div>
            </div>
          </div>

          <div>
            <label className={LABEL}>Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={INPUT} placeholder="e.g. Ahmed Mohamed" />
          </div>

          <div>
            <label className={LABEL}>Achievement Title</label>
            <input value={form.achievement_title} onChange={(e) => setForm({ ...form, achievement_title: e.target.value })} className={INPUT} placeholder="e.g. First Place — FLL 2025" />
          </div>

          <div>
            <label className={LABEL}>Achievement Description</label>
            <textarea value={form.achievement_description} onChange={(e) => setForm({ ...form, achievement_description: e.target.value })} rows={3} className={TEXTAREA} placeholder="Brief description of what this student built or achieved…" />
          </div>

          <div>
            <label className={LABEL}>YouTube / Project URL (optional)</label>
            <input value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} className={INPUT} placeholder="https://youtube.com/…" type="url" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Sort Order</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className={INPUT} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-center gap-2">
                <div
                  role="switch"
                  aria-checked={form.featured}
                  onClick={() => setForm({ ...form, featured: !form.featured })}
                  className={[
                    "relative h-5 w-9 cursor-pointer rounded-full transition-colors duration-200",
                    form.featured ? "bg-[#38BDF8]" : "bg-gray-200",
                  ].join(" ")}
                >
                  <span className={[
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
                    form.featured ? "translate-x-4" : "translate-x-0.5",
                  ].join(" ")} />
                </div>
                <span className="text-[12px] font-medium text-gray-600">Active</span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-[#0B1F3A] py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#38BDF8] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-5 py-2.5 text-[13px] font-semibold text-gray-500 transition hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Sortable card ─────────────────────────────────────────────────────────────

function SortableStudentCard({
  student,
  onEdit,
  onDelete,
  onToggle,
  deleting,
  toggling,
}: {
  student:  Student;
  onEdit:   (s: Student) => void;
  onDelete: (id: string) => void;
  onToggle: (s: Student) => void;
  deleting: string | null;
  toggling: string | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: student.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        "overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow",
        isDragging ? "border-[#38BDF8] shadow-lg opacity-70" : "border-gray-100",
        !student.featured ? "opacity-60" : "",
      ].join(" ")}
    >
      {/* Photo */}
      <div className="relative h-52 w-full overflow-hidden bg-gray-100">
        <Image
          src={student.image_url}
          alt={student.name}
          fill
          sizes="280px"
          className="object-cover"
        />
        {/* Status badge */}
        <span className={[
          "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold",
          student.featured ? "bg-emerald-500 text-white" : "bg-gray-400 text-white",
        ].join(" ")}>
          {student.featured ? "Active" : "Hidden"}
        </span>
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="absolute right-2 top-2 flex h-7 w-7 cursor-grab items-center justify-center rounded-lg bg-white/80 text-gray-500 shadow-sm transition hover:bg-white hover:text-gray-700 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 6zm0 6a2 2 0 10.001 4.001A2 2 0 007 12zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 4zm0 2a2 2 0 10.001 4.001A2 2 0 0013 6zm0 6a2 2 0 10.001 4.001A2 2 0 0013 12z" />
          </svg>
        </button>
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="truncate text-[13px] font-bold text-[#0B1F3A]">{student.name}</p>
        {student.achievement_title && (
          <p className="mt-0.5 truncate text-[11px] font-semibold text-[#38BDF8]">{student.achievement_title}</p>
        )}
        {student.achievement_description && (
          <p className="mt-1 line-clamp-2 text-[11px] text-gray-400">{student.achievement_description}</p>
        )}
        {student.youtube_url && (
          <p className="mt-1 truncate text-[10px] text-gray-300">{student.youtube_url}</p>
        )}
        <p className="mt-1 text-[10px] text-gray-300">Order: {student.sort_order}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => onEdit(student)}
            className="flex-1 rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-gray-600 transition hover:border-[#38BDF8] hover:text-[#38BDF8]"
          >
            Edit
          </button>
          <button
            onClick={() => onToggle(student)}
            disabled={toggling === student.id}
            className={[
              "flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition disabled:opacity-50",
              student.featured
                ? "border-emerald-200 bg-emerald-50/60 text-emerald-600 hover:bg-emerald-100"
                : "border-gray-200 text-gray-400 hover:border-emerald-200 hover:text-emerald-600",
            ].join(" ")}
          >
            {toggling === student.id ? "…" : student.featured ? "Hide" : "Show"}
          </button>
          <button
            onClick={() => onDelete(student.id)}
            disabled={deleting === student.id}
            className="w-full rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-red-400 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting === student.id ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  const [students,  setStudents]  = useState<Student[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [toggling,  setToggling]  = useState<string | null>(null);
  const [editing,   setEditing]   = useState<Student | null>(null);
  const [form,      setForm]      = useState(blank);
  const [file,      setFile]      = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const load = () => {
    setLoading(true);
    fetch("/api/studio/students")
      .then((r) => r.json())
      .then((d) => { setStudents(Array.isArray(d) ? d : []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setSaving(true);

    const fd = new FormData();
    fd.append("image",                   file);
    fd.append("name",                    form.name);
    fd.append("achievement_title",       form.achievement_title);
    fd.append("achievement_description", form.achievement_description);
    fd.append("youtube_url",             form.youtube_url);
    fd.append("sort_order",              form.sort_order);

    const res = await fetch("/api/studio/students", { method: "POST", body: fd });
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

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this student?")) return;
    setDeleting(id);
    await fetch(`/api/studio/students/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  };

  const handleToggle = async (student: Student) => {
    setToggling(student.id);
    await fetch(`/api/studio/students/${student.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ featured: !student.featured }),
    });
    setToggling(null);
    load();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = students.findIndex((s) => s.id === active.id);
    const newIndex = students.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(students, oldIndex, newIndex).map((s, i) => ({
      ...s,
      sort_order: i,
    }));
    setStudents(reordered);

    await Promise.all(
      reordered.map((s) =>
        fetch(`/api/studio/students/${s.id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ sort_order: s.sort_order }),
        })
      )
    );
  };

  return (
    <div className="space-y-6">

      {/* Add form */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-[14px] font-semibold text-[#0B1F3A]">Add Featured Student</h2>
        <p className="mb-5 text-[12px] text-gray-400">Portrait photo required (3:4 ratio recommended). Achievement fields are optional.</p>

        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ahmed Mohamed" required className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Achievement Title</label>
              <input value={form.achievement_title} onChange={(e) => setForm({ ...form, achievement_title: e.target.value })} placeholder="e.g. First Place — FLL 2025" className={INPUT} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Achievement Description</label>
            <textarea value={form.achievement_description} onChange={(e) => setForm({ ...form, achievement_description: e.target.value })} rows={2} placeholder="Brief description of what this student built or achieved…" className={TEXTAREA} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label className={LABEL}>YouTube / Project URL (optional)</label>
              <input value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} placeholder="https://youtube.com/…" type="url" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Sort Order</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Photo *</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-[12px] text-gray-500 file:mr-2 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-[11px] file:font-semibold file:text-gray-600 hover:file:bg-gray-200"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !file}
              className="rounded-lg bg-[#0B1F3A] px-6 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#38BDF8] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add Student"}
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#38BDF8] border-t-transparent" />
        </div>
      ) : (
        <>
          {students.length > 0 && (
            <p className="text-[12px] text-gray-400">
              {students.length} student{students.length !== 1 ? "s" : ""} — drag cards to reorder
            </p>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={students.map((s) => s.id)} strategy={rectSortingStrategy}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {students.map((s) => (
                  <SortableStudentCard
                    key={s.id}
                    student={s}
                    onEdit={setEditing}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                    deleting={deleting}
                    toggling={toggling}
                  />
                ))}

                {students.length === 0 && (
                  <div className="col-span-full rounded-xl border border-dashed border-gray-200 bg-gray-50 p-12 text-center">
                    <p className="text-[14px] font-semibold text-gray-400">No students yet</p>
                    <p className="mt-1 text-[12px] text-gray-300">Add your first featured student using the form above.</p>
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {/* Edit modal */}
      {editing && (
        <EditModal
          student={editing}
          onSave={(updated) => {
            setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
