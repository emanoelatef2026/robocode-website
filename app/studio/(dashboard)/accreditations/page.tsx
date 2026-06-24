"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import SectionEmptyState from "@/components/ui/SectionEmptyState";

interface Accreditation {
  id:           string;
  name:         string;
  logo_url:     string;
  website_url?: string | null;
  active:       boolean;
  sort_order:   number;
  created_at:   string;
}

const INPUT = "w-full rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] px-3 py-2.5 text-[13px] text-[#0B1F3A] outline-none transition focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/20";
const LABEL = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]";

const blank = { name: "", sort_order: "0", website_url: "" };

// ── Grip icon ─────────────────────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
    </svg>
  );
}

// ── Sortable card ─────────────────────────────────────────────────────────────

function SortableCard({
  item,
  toggling,
  deleting,
  onToggle,
  onDelete,
}: {
  item:     Accreditation;
  toggling: string | null;
  deleting: string | null;
  onToggle: (item: Accreditation) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform:  CSS.Transform.toString(transform),
    transition,
    zIndex:     isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200",
        isDragging
          ? "scale-[1.02] border-[#38BDF8]/40 shadow-xl ring-2 ring-[#38BDF8]/20"
          : "border-[#F1F5F9]",
      ].join(" ")}
    >
      <div className="flex h-28 items-center bg-[#F9FAFB] px-4 gap-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none select-none text-[#D1D5DB] transition hover:text-[#9CA3AF] active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripIcon />
        </button>

        {/* Logo */}
        <div className="relative h-12 w-24 shrink-0">
          <Image src={item.logo_url} alt={item.name} fill className="object-contain" sizes="96px" />
        </div>
      </div>

      <div className="p-3">
        <p className="truncate text-[12px] font-bold text-[#0B1F3A]">{item.name}</p>
        <p className="text-[11px] text-[#9CA3AF]">Order: {item.sort_order}</p>
        {item.website_url && (
          <p className="mt-0.5 truncate text-[10px] text-[#38BDF8]">{item.website_url}</p>
        )}
        <div className="mt-2 flex gap-1.5">
          <button
            onClick={() => onToggle(item)}
            disabled={toggling === item.id}
            className={[
              "flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition disabled:opacity-50",
              item.active
                ? "border-[#38BDF8]/30 bg-[#38BDF8]/8 text-[#38BDF8] hover:bg-[#38BDF8]/15"
                : "border-[#E2E8F0] text-[#9CA3AF] hover:border-[#38BDF8]/30 hover:text-[#38BDF8]",
            ].join(" ")}
          >
            {toggling === item.id ? "…" : item.active ? "Active" : "Inactive"}
          </button>
          <button
            onClick={() => onDelete(item.id)}
            disabled={deleting === item.id}
            className="flex-1 rounded-lg border border-[#E2E8F0] py-1.5 text-[11px] font-semibold text-[#F87171] transition hover:border-[#FCA5A5] hover:bg-[#FEE2E2] disabled:opacity-50"
          >
            {deleting === item.id ? "…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AccreditationsPage() {
  const [items,    setItems]    = useState<Accreditation[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [form,     setForm]     = useState(blank);
  const [file,     setFile]     = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/studio/accreditations")
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
    if (!file) return;
    setSaving(true);
    const fd = new FormData();
    fd.append("logo", file);
    fd.append("name", form.name);
    fd.append("sort_order", form.sort_order);
    if (form.website_url) fd.append("website_url", form.website_url);
    const res = await fetch("/api/studio/accreditations", { method: "POST", body: fd });
    setSaving(false);
    if (res.ok) {
      setForm(blank);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Upload failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this accreditation?")) return;
    setDeleting(id);
    await fetch(`/api/studio/accreditations/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  };

  const handleToggle = async (item: Accreditation) => {
    setToggling(item.id);
    await fetch(`/api/studio/accreditations/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    setToggling(null);
    load();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((s) => s.id === active.id);
    const newIndex = items.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    setReordering(true);
    await Promise.all(
      reordered.map((item, i) =>
        fetch(`/api/studio/accreditations/${item.id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ sort_order: i + 1 }),
        })
      )
    );
    setReordering(false);
  };

  return (
    <div className="space-y-6">

      {error && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEE2E2] p-4 text-[13px] text-[#DC2626]">
          <strong>Connection error:</strong> {error}
          <button onClick={load} className="ml-3 underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Add form */}
      <div className="rounded-xl border border-[#F1F5F9] bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-[14px] font-semibold text-[#0B1F3A]">Add Accreditation</h2>
        <p className="mb-4 text-[12px] text-[#9CA3AF]">Upload logos in WebP/PNG format, transparent or white background, recommended height 60px.</p>

        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className={LABEL}>Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. ISO Certified"
                required
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Sort Order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                className={INPUT}
              />
            </div>
          </div>

          <div>
            <label className={LABEL}>Website URL</label>
            <input
              type="url"
              value={form.website_url}
              onChange={(e) => setForm({ ...form, website_url: e.target.value })}
              placeholder="https://example.com (optional)"
              className={INPUT}
            />
          </div>

          <div>
            <label className={LABEL}>Logo *</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-[13px] text-[#6B7280] file:mr-2 file:rounded-lg file:border-0 file:bg-[#F3F4F6] file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-[#4B5563] hover:file:bg-gray-200"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !file}
              className="rounded-lg bg-[#0B1F3A] px-6 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#38BDF8] disabled:opacity-50"
            >
              {saving ? "Uploading…" : "Add Accreditation"}
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#38BDF8] border-t-transparent" />
        </div>
      ) : (
        <>
          {items.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-[#9CA3AF]">{items.length} accreditation{items.length !== 1 ? "s" : ""}</p>
              {reordering && (
                <span className="text-[12px] text-[#9CA3AF]">Saving order…</span>
              )}
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                {items.map((item) => (
                  <SortableCard
                    key={item.id}
                    item={item}
                    toggling={toggling}
                    deleting={deleting}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {!error && items.length === 0 && (
            <SectionEmptyState
              variant="accreditations"
              heading="No accreditations yet"
              subtext="Upload your first certification or accreditation logo above."
            />
          )}
        </>
      )}
    </div>
  );
}
