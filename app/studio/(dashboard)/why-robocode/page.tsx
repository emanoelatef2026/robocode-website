"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Settings {
  id:               string;
  section_title:    string;
  section_subtitle: string;
  updated_at:       string;
}

interface Tab {
  id:         string;
  tab_name:   string;
  image_url:  string;
  sort_order: number;
  is_active:  boolean;
  created_at: string;
}

interface SetupNeeded {
  tables: boolean;
  bucket: boolean;
}

// ── Shared style tokens ───────────────────────────────────────────────────────

const INPUT = "w-full rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] px-3 py-2.5 text-[13px] text-[#0B1F3A] outline-none transition focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/20";
const LABEL = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]";

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({
  tab,
  onSave,
  onClose,
}: {
  tab:     Tab;
  onSave:  () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    tab_name:   tab.tab_name,
    sort_order: String(tab.sort_order),
    is_active:  tab.is_active,
  });
  const [file,    setFile]    = useState<File | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const fd = new FormData();
    fd.append("tab_name",   form.tab_name.trim());
    fd.append("sort_order", form.sort_order);
    fd.append("is_active",  String(form.is_active));
    if (file) fd.append("image", file);

    const res = await fetch(`/api/studio/why-robocode/${tab.id}`, {
      method: "PATCH",
      body:   fd,
    });

    setSaving(false);
    if (res.ok) {
      onSave();
      onClose();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Failed to save");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">

        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-[#F1F5F9] px-6 py-4">
          <h2 className="text-[15px] font-bold text-[#0B1F3A]">Edit Tab</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9CA3AF] transition hover:bg-[#F3F4F6] hover:text-[#4B5563]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">

          {/* Tab name + sort order */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className={LABEL}>Tab Name *</label>
              <input
                value={form.tab_name}
                onChange={(e) => setForm({ ...form, tab_name: e.target.value })}
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

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] px-4 py-3">
            <span className="text-[13px] font-medium text-[#0B1F3A]">Visible on homepage</span>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
              className={[
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200",
                form.is_active ? "bg-[#38BDF8]" : "bg-gray-200",
              ].join(" ")}
              role="switch"
              aria-checked={form.is_active}
            >
              <span
                className={[
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                  form.is_active ? "translate-x-5" : "translate-x-0.5",
                ].join(" ")}
              />
            </button>
          </div>

          {/* Image replacement */}
          <div>
            <label className={LABEL}>Replace Image <span className="normal-case font-normal text-[#D1D5DB]">(optional)</span></label>

            {/* Current / preview image */}
            <div className="mb-3 relative h-36 w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
              <Image
                src={preview ?? tab.image_url}
                alt={tab.tab_name}
                fill
                className="object-contain"
                sizes="448px"
              />
              {preview && (
                <span className="absolute left-2 top-2 rounded-md bg-[#38BDF8] px-2 py-0.5 text-[10px] font-bold text-white">
                  New image
                </span>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-[13px] text-[#6B7280] file:mr-2 file:rounded-lg file:border-0 file:bg-[#F3F4F6] file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-[#4B5563] hover:file:bg-gray-200"
            />
            <p className="mt-1 text-[11px] text-[#9CA3AF]">Leave empty to keep the current image.</p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-[#F1F5F9] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#E2E8F0] px-5 py-2.5 text-[13px] font-semibold text-[#6B7280] transition hover:bg-[#F9FAFB]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#0B1F3A] px-6 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#38BDF8] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WhyRobocodePage() {
  const [settings,       setSettings]       = useState<Settings | null>(null);
  const [tabs,           setTabs]           = useState<Tab[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [setupNeeded,    setSetupNeeded]    = useState<SetupNeeded | null>(null);
  const [settingsSaved,  setSettingsSaved]  = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsForm,   setSettingsForm]   = useState({ section_title: "", section_subtitle: "" });

  // Add tab form
  const [tabForm,   setTabForm]   = useState({ tab_name: "", sort_order: "0" });
  const [tabFile,   setTabFile]   = useState<File | null>(null);
  const [tabSaving, setTabSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Per-tab state
  const [editingTab, setEditingTab] = useState<Tab | null>(null);
  const [toggling,   setToggling]   = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    setSetupNeeded(null);
    fetch("/api/studio/why-robocode")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
        return d;
      })
      .then((d: { settings: Settings | null; tabs: Tab[]; setupNeeded: false | SetupNeeded }) => {
        if (d.setupNeeded) {
          setSetupNeeded(d.setupNeeded as SetupNeeded);
          return;
        }
        setSettings(d.settings);
        setTabs(Array.isArray(d.tabs) ? d.tabs : []);
        if (d.settings) {
          setSettingsForm({
            section_title:    d.settings.section_title    ?? "",
            section_subtitle: d.settings.section_subtitle ?? "",
          });
        }
      })
      .catch((e: Error) => setError(e.message ?? "Failed to connect"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // ── Save settings ─────────────────────────────────────────────────────────

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    const res = await fetch("/api/studio/why-robocode", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(settingsForm),
    });
    setSavingSettings(false);
    if (res.ok) {
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Failed to save settings");
    }
  };

  // ── Add tab ───────────────────────────────────────────────────────────────

  const handleAddTab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tabFile) return;
    setTabSaving(true);
    const fd = new FormData();
    fd.append("image",      tabFile);
    fd.append("tab_name",   tabForm.tab_name);
    fd.append("sort_order", tabForm.sort_order);
    const res = await fetch("/api/studio/why-robocode", { method: "POST", body: fd });
    setTabSaving(false);
    if (res.ok) {
      setTabForm({ tab_name: "", sort_order: "0" });
      setTabFile(null);
      if (fileRef.current) fileRef.current.value = "";
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Upload failed");
    }
  };

  // ── Toggle tab ────────────────────────────────────────────────────────────

  const handleToggle = async (tab: Tab) => {
    setToggling(tab.id);
    await fetch(`/api/studio/why-robocode/${tab.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ is_active: !tab.is_active }),
    });
    setToggling(null);
    load();
  };

  // ── Delete tab ────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tab?")) return;
    setDeleting(id);
    await fetch(`/api/studio/why-robocode/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Edit modal — rendered outside the content flow */}
      {editingTab && (
        <EditModal
          tab={editingTab}
          onSave={load}
          onClose={() => setEditingTab(null)}
        />
      )}

      <div className="space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-[16px] font-bold text-[#0B132B]">Why Robocode</h1>
          <p className="mt-0.5 text-[13px] text-[#9CA3AF]">
            Manage the section heading and feature tabs shown on the homepage.
          </p>
        </div>

        {/* Setup instructions — only shown when tables or bucket genuinely don't exist */}
        {setupNeeded && (
          <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-[12px] text-[#B45309]">
            <p className="font-semibold">One-time setup required</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {setupNeeded.tables && (
                <li>
                  Create tables{" "}
                  <code className="rounded bg-[#FFFBEB] px-1 font-mono">why_robocode_settings</code>
                  {" "}and{" "}
                  <code className="rounded bg-[#FFFBEB] px-1 font-mono">why_robocode_tabs</code>
                  {" "}in Supabase.
                </li>
              )}
              {setupNeeded.bucket && (
                <li>
                  Create a public storage bucket named{" "}
                  <code className="rounded bg-[#FFFBEB] px-1 font-mono">why-robocode</code>.
                </li>
              )}
            </ul>
            <button onClick={load} className="mt-2 underline hover:no-underline">
              Retry after setup
            </button>
          </div>
        )}

        {/* Connection error */}
        {error && (
          <div className="rounded-xl border border-[#FECACA] bg-[#FEE2E2] p-4 text-[13px] text-[#DC2626]">
            <strong>Connection error:</strong> {error}
            <button onClick={load} className="ml-3 underline hover:no-underline">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#38BDF8] border-t-transparent" />
          </div>
        ) : setupNeeded ? null : (
          <>
            {/* Settings form */}
            <div className="rounded-xl border border-[#F1F5F9] bg-white p-6 shadow-sm">
              <h2 className="mb-1 text-[14px] font-semibold text-[#0B1F3A]">Section Text</h2>
              <p className="mb-4 text-[12px] text-[#9CA3AF]">
                The main heading and subtitle shown above the tabs.
              </p>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className={LABEL}>Section Title *</label>
                  <input
                    value={settingsForm.section_title}
                    onChange={(e) => setSettingsForm({ ...settingsForm, section_title: e.target.value })}
                    placeholder="e.g. Built For Future Innovators"
                    required
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className={LABEL}>Section Subtitle</label>
                  <textarea
                    value={settingsForm.section_subtitle}
                    onChange={(e) => setSettingsForm({ ...settingsForm, section_subtitle: e.target.value })}
                    placeholder="Optional subtitle text shown below the heading"
                    rows={2}
                    className={INPUT + " resize-none"}
                  />
                </div>
                <div className="flex items-center justify-end gap-3">
                  {settingsSaved && (
                    <span className="text-[12px] font-semibold text-[#10B981]">Saved</span>
                  )}
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="rounded-lg bg-[#0B1F3A] px-6 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#38BDF8] disabled:opacity-50"
                  >
                    {savingSettings ? "Saving…" : "Save Text"}
                  </button>
                </div>
              </form>
            </div>

            {/* Add tab form */}
            <div className="rounded-xl border border-[#F1F5F9] bg-white p-6 shadow-sm">
              <h2 className="mb-1 text-[14px] font-semibold text-[#0B1F3A]">Add Tab</h2>
              <p className="mb-4 text-[12px] text-[#9CA3AF]">
                Each tab shows a name on the left and its image on the right when selected.
              </p>
              <form onSubmit={handleAddTab} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className={LABEL}>Tab Name *</label>
                    <input
                      value={tabForm.tab_name}
                      onChange={(e) => setTabForm({ ...tabForm, tab_name: e.target.value })}
                      placeholder="e.g. Adaptive Learning"
                      required
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>Sort Order</label>
                    <input
                      type="number"
                      value={tabForm.sort_order}
                      onChange={(e) => setTabForm({ ...tabForm, sort_order: e.target.value })}
                      className={INPUT}
                    />
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Tab Image *</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    required
                    onChange={(e) => setTabFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-[13px] text-[#6B7280] file:mr-2 file:rounded-lg file:border-0 file:bg-[#F3F4F6] file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-[#4B5563] hover:file:bg-gray-200"
                  />
                  <p className="mt-1 text-[11px] text-[#9CA3AF]">Recommended: 800 × 600 px, WebP, under 300 KB</p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={tabSaving || !tabFile}
                    className="rounded-lg bg-[#0B1F3A] px-6 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#38BDF8] disabled:opacity-50"
                  >
                    {tabSaving ? "Uploading…" : "Add Tab"}
                  </button>
                </div>
              </form>
            </div>

            {/* Tab list */}
            <div>
              {tabs.length > 0 && (
                <p className="mb-3 text-[13px] text-[#9CA3AF]">{tabs.length} tab{tabs.length !== 1 ? "s" : ""}</p>
              )}
              <div className="space-y-3">
                {tabs.map((tab) => (
                  <div
                    key={tab.id}
                    className="flex items-center gap-4 overflow-hidden rounded-xl border border-[#F1F5F9] bg-white shadow-sm"
                  >
                    {/* Thumbnail */}
                    <div className="relative h-20 w-28 shrink-0 overflow-hidden bg-[#F9FAFB]">
                      {tab.image_url ? (
                        <Image
                          src={tab.image_url}
                          alt={tab.tab_name}
                          fill
                          className="object-contain"
                          sizes="112px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[#D1D5DB]">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
                            <rect x="3" y="3" width="18" height="18" rx="3" />
                            <path d="M3 16l5-5 4 4 3-3 6 4" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1 py-3">
                      <p className="truncate text-[14px] font-semibold text-[#0B1F3A]">{tab.tab_name}</p>
                      <p className="text-[11px] text-[#9CA3AF]">
                        Order: {tab.sort_order} &middot;{" "}
                        <span className={tab.is_active ? "text-[#10B981]" : "text-[#9CA3AF]"}>
                          {tab.is_active ? "Active" : "Inactive"}
                        </span>
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-2 px-4">
                      <button
                        onClick={() => setEditingTab(tab)}
                        className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[11px] font-semibold text-[#0B1F3A] transition hover:border-[#38BDF8]/40 hover:bg-[#38BDF8]/6 hover:text-[#38BDF8]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggle(tab)}
                        disabled={toggling === tab.id}
                        className={[
                          "rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-50",
                          tab.is_active
                            ? "border-[#38BDF8]/30 bg-[#38BDF8]/8 text-[#38BDF8] hover:bg-[#38BDF8]/15"
                            : "border-[#E2E8F0] text-[#9CA3AF] hover:border-[#38BDF8]/30 hover:text-[#38BDF8]",
                        ].join(" ")}
                      >
                        {toggling === tab.id ? "…" : tab.is_active ? "Active" : "Inactive"}
                      </button>
                      <button
                        onClick={() => handleDelete(tab.id)}
                        disabled={deleting === tab.id}
                        className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[11px] font-semibold text-[#F87171] transition hover:border-[#FCA5A5] hover:bg-[#FEE2E2] disabled:opacity-50"
                      >
                        {deleting === tab.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}

                {tabs.length === 0 && !error && (
                  <div className="rounded-xl border border-dashed border-[#E2E8F0] py-16 text-center">
                    <p className="text-[14px] text-[#9CA3AF]">No tabs yet</p>
                    <p className="mt-1 text-[12px] text-[#D1D5DB]">Add your first tab above.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
