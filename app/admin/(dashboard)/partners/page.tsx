"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import SectionEmptyState from "@/components/ui/SectionEmptyState";

interface Partner {
  id:          string;
  name:        string;
  logo_url:    string;
  website_url: string | null;
  active:      boolean;
  sort_order:  number;
}

const INPUT = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-[#0B1F3A] outline-none transition focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/20";
const LABEL = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400";

const blank = { name: "", website_url: "", sort_order: "0" };

export default function PartnersPage() {
  const [items,    setItems]    = useState<Partner[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [editing,  setEditing]  = useState<Partner | null>(null);
  const [form,     setForm]     = useState(blank);
  const [file,     setFile]     = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/partners")
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
    fd.append("website_url", form.website_url);
    fd.append("sort_order", form.sort_order);
    const res = await fetch("/api/admin/partners", { method: "POST", body: fd });
    setSaving(false);
    if (res.ok) { setForm(blank); setFile(null); if (fileRef.current) fileRef.current.value = ""; load(); }
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? "Upload failed"); }
  };

  const handleEditSave = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await fetch(`/api/admin/partners/${editing.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editing.name, website_url: editing.website_url, sort_order: editing.sort_order }),
    });
    setSaving(false);
    if (res.ok) { setEditing(null); load(); }
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? "Failed"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this partner?")) return;
    setDeleting(id);
    await fetch(`/api/admin/partners/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  };

  const handleToggle = async (item: Partner) => {
    setToggling(item.id);
    await fetch(`/api/admin/partners/${item.id}`, {
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
        <h2 className="mb-1 text-[14px] font-semibold text-[#0B1F3A]">Add Partner</h2>
        <p className="mb-4 text-[12px] text-gray-400">Upload partner logos. WebP/PNG with transparent background. Recommended: 200×80px.</p>

        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Partner Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. FIRST Robotics" required className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Website URL</label>
              <input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://partner.com" className={INPUT} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className={LABEL}>Logo *</label>
              <input ref={fileRef} type="file" accept="image/*" required onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-[13px] text-gray-500 file:mr-2 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-gray-600 hover:file:bg-gray-200" />
            </div>
            <div>
              <label className={LABEL}>Sort Order</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className={INPUT} />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving || !file}
              className="rounded-lg bg-[#0B1F3A] px-6 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#38BDF8] disabled:opacity-50">
              {saving ? "Uploading…" : "Add Partner"}
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#38BDF8] border-t-transparent" />
        </div>
      ) : (
        <>
          {items.length > 0 && (
            <p className="text-[13px] text-gray-400">{items.length} partner{items.length !== 1 ? "s" : ""}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="flex h-24 items-center justify-center bg-gray-50 p-4">
                  <div className="relative h-12 w-28">
                    <Image src={item.logo_url} alt={item.name} fill className="object-contain" sizes="112px" />
                  </div>
                </div>
                <div className="p-3">
                  {editing?.id === item.id ? (
                    <div className="space-y-2">
                      <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={INPUT} placeholder="Name" />
                      <input value={editing.website_url ?? ""} onChange={(e) => setEditing({ ...editing, website_url: e.target.value })} className={INPUT} placeholder="Website URL" />
                      <input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className={INPUT} placeholder="Sort order" />
                      <div className="flex gap-2">
                        <button onClick={handleEditSave} disabled={saving} className="flex-1 rounded-lg bg-[#0B1F3A] py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#38BDF8] disabled:opacity-50">{saving ? "…" : "Save"}</button>
                        <button onClick={() => setEditing(null)} className="flex-1 rounded-lg border border-gray-200 py-1.5 text-[12px] font-semibold text-gray-500 hover:bg-gray-50">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="truncate text-[12px] font-bold text-[#0B1F3A]">{item.name}</p>
                      {item.website_url && <a href={item.website_url} target="_blank" rel="noopener noreferrer" className="truncate text-[11px] text-[#38BDF8] hover:underline">{item.website_url}</a>}
                      <div className="mt-2 flex gap-1.5">
                        <button onClick={() => setEditing(item)} className="flex-1 rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-gray-600 hover:border-[#38BDF8] hover:text-[#38BDF8] transition">Edit</button>
                        <button onClick={() => handleToggle(item)} disabled={toggling === item.id}
                          className={["flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition disabled:opacity-50",
                            item.active ? "border-[#38BDF8]/30 bg-[#38BDF8]/8 text-[#38BDF8]" : "border-gray-200 text-gray-400 hover:border-[#38BDF8]/30 hover:text-[#38BDF8]"].join(" ")}>
                          {toggling === item.id ? "…" : item.active ? "Active" : "Inactive"}
                        </button>
                        <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id}
                          className="flex-1 rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-red-400 hover:border-red-300 hover:bg-red-50 transition disabled:opacity-50">
                          {deleting === item.id ? "…" : "Del"}
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
                  variant="partners"
                  heading="No partners yet"
                  subtext="Upload your first partner logo to feature them on the homepage."
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
