"use client";

import { useEffect, useState, useCallback } from "react";
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface Section {
  id:         string;
  key:        string;
  title:      string;
  enabled:    boolean;
  sort_order: number;
}

// ── Section icons ─────────────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, React.ReactNode> = {
  hero:              <span className="text-lg">🚀</span>,
  trust:             <span className="text-lg">⭐</span>,
  why:               <span className="text-lg">💡</span>,
  programs:          <span className="text-lg">📚</span>,
  learning_journey:  <span className="text-lg">🗺️</span>,
  projects:          <span className="text-lg">🔧</span>,
  featured_students: <span className="text-lg">🏆</span>,
  competitions:      <span className="text-lg">🥇</span>,
  branches:          <span className="text-lg">📍</span>,
  contact:           <span className="text-lg">✉️</span>,
};

// ── Drag handle icon ──────────────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
    </svg>
  );
}

// ── Sortable row ──────────────────────────────────────────────────────────────

function SortableRow({
  section,
  index,
  onToggle,
}: {
  section:  Section;
  index:    number;
  onToggle: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

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
        "flex items-center gap-4 rounded-xl border bg-white px-4 py-4 shadow-sm transition-all duration-200",
        isDragging
          ? "scale-[1.02] border-[#19C6F4]/40 shadow-xl ring-2 ring-[#19C6F4]/20"
          : "border-gray-100 hover:border-gray-200",
        !section.enabled ? "opacity-60" : "",
      ].join(" ")}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none select-none text-gray-300 transition hover:text-gray-400 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripIcon />
      </button>

      {/* Sort badge */}
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-400">
        {index + 1}
      </span>

      {/* Icon */}
      <span className="shrink-0">{SECTION_ICONS[section.key] ?? <span className="text-lg">📄</span>}</span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-[14px] font-semibold text-[#0B132B]">{section.title}</p>
        <p className="text-[11px] text-gray-400 font-mono">{section.key}</p>
      </div>

      {/* Status pill */}
      <span
        className={[
          "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
          section.enabled
            ? "bg-emerald-50 text-emerald-600"
            : "bg-gray-100 text-gray-400",
        ].join(" ")}
      >
        {section.enabled ? "Visible" : "Hidden"}
      </span>

      {/* Toggle switch */}
      <button
        onClick={() => onToggle(section.id)}
        className={[
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
          section.enabled ? "bg-[#19C6F4]" : "bg-gray-200",
        ].join(" ")}
        role="switch"
        aria-checked={section.enabled}
      >
        <span
          className={[
            "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
            section.enabled ? "translate-x-5" : "translate-x-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HomepageSectionsPage() {
  const [sections,    setSections]    = useState<Section[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [hasChanges,  setHasChanges]  = useState(false);
  const [saveStatus,  setSaveStatus]  = useState<"idle" | "saved" | "error">("idle");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/homepage-sections")
      .then((r) => r.json())
      .then((d) => { setSections(Array.isArray(d) ? d : []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Drag end ──────────────────────────────────────────────────────────────

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSections((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
    setHasChanges(true);
    setSaveStatus("idle");
  };

  // ── Toggle enabled ────────────────────────────────────────────────────────

  const handleToggle = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
    setHasChanges(true);
    setSaveStatus("idle");
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("idle");

    const updates = sections.map((s, i) => ({
      id:         s.id,
      sort_order: i + 1,
      enabled:    s.enabled,
    }));

    try {
      const res = await fetch("/api/admin/homepage-sections", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(updates),
      });

      if (!res.ok) throw new Error("Save failed");

      setHasChanges(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[16px] font-bold text-[#0B132B]">Homepage Sections</h1>
          <p className="mt-0.5 text-[13px] text-gray-400">
            Drag to reorder · toggle to show/hide · save when done
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-500">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-[12px] font-semibold text-red-500">Save failed — try again</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={[
              "rounded-lg px-5 py-2.5 text-[13px] font-semibold transition",
              hasChanges
                ? "bg-[#0B132B] text-white hover:bg-[#19C6F4]"
                : "cursor-not-allowed bg-gray-100 text-gray-300",
            ].join(" ")}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-100 bg-white px-4 py-3 text-[12px] text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-emerald-400" /> Visible on homepage
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-gray-200" /> Hidden
        </span>
        <span className="ml-auto italic">
          Drag the ⠿ handle to reorder
        </span>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#19C6F4] border-t-transparent" />
        </div>
      ) : sections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-20 text-center">
          <p className="text-gray-400 text-sm">No sections found.</p>
          <p className="mt-1 text-gray-300 text-xs">Run the SQL seed in Supabase to populate sections.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {sections.map((section, i) => (
                <SortableRow
                  key={section.id}
                  section={section}
                  index={i}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Unsaved banner */}
      {hasChanges && !saving && (
        <div className="sticky bottom-4 z-10">
          <div className="mx-auto max-w-md rounded-xl bg-[#0B132B] px-5 py-3.5 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[13px] font-medium text-white/80">
                You have unsaved changes
              </p>
              <button
                onClick={handleSave}
                className="rounded-lg bg-[#19C6F4] px-4 py-2 text-[12px] font-bold text-[#0B132B] transition hover:brightness-110"
              >
                Save now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
