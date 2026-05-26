"use client";

import { useEffect, useState } from "react";
import SectionEmptyState from "@/components/ui/SectionEmptyState";

const FAQ_CATEGORIES = [
  "Programs", "Online Learning", "Robotics", "AI",
  "Competitions", "Trial Sessions", "Age Groups", "Certifications",
] as const;

interface FAQItem {
  id:         string;
  question:   string;
  answer:     string;
  category:   string;
  active:     boolean;
  sort_order: number;
}

const INPUT = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-[#0B1F3A] outline-none transition focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/20";
const LABEL = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400";

const blank = { question: "", answer: "", category: "Programs", sort_order: "0" };

export default function FAQPage() {
  const [items,    setItems]    = useState<FAQItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [editing,  setEditing]  = useState<FAQItem | null>(null);
  const [form,     setForm]     = useState(blank);
  const [filter,   setFilter]   = useState("All");

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/studio/faq")
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
    setSaving(true);
    const res = await fetch("/api/studio/faq", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: form.question, answer: form.answer, category: form.category, sort_order: Number(form.sort_order) }),
    });
    setSaving(false);
    if (res.ok) { setForm(blank); load(); }
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? "Failed"); }
  };

  const handleEditSave = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await fetch(`/api/studio/faq/${editing.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: editing.question, answer: editing.answer, category: editing.category, sort_order: editing.sort_order }),
    });
    setSaving(false);
    if (res.ok) { setEditing(null); load(); }
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? "Failed"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this FAQ?")) return;
    setDeleting(id);
    await fetch(`/api/studio/faq/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  };

  const handleToggle = async (item: FAQItem) => {
    setToggling(item.id);
    await fetch(`/api/studio/faq/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    setToggling(null);
    load();
  };

  const filtered = filter === "All" ? items : items.filter((i) => i.category === filter);

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
        <h2 className="mb-4 text-[14px] font-semibold text-[#0B1F3A]">Add FAQ Item</h2>

        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className={LABEL}>Question *</label>
              <input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="e.g. What age groups do you teach?" required className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Category *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={INPUT}>
                {FAQ_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL}>Answer *</label>
            <textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} rows={3} placeholder="Clear, concise answer…" required className={`${INPUT} resize-none`} />
          </div>

          <div className="flex items-center justify-between">
            <div className="w-32">
              <label className={LABEL}>Sort Order</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className={INPUT} />
            </div>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-[#0B1F3A] px-6 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#38BDF8] disabled:opacity-50">
              {saving ? "Saving…" : "Add FAQ"}
            </button>
          </div>
        </form>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {["All", ...FAQ_CATEGORIES].map((cat) => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={["rounded-full px-3 py-1 text-[12px] font-semibold transition",
              filter === cat ? "bg-[#0B1F3A] text-white" : "border border-gray-200 text-gray-500 hover:text-[#0B1F3A]"].join(" ")}>
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#38BDF8] border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length > 0 && (
            <p className="text-[13px] text-gray-400">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</p>
          )}
          {filtered.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              {editing?.id === item.id ? (
                <div className="space-y-3">
                  <input value={editing.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} className={INPUT} placeholder="Question" />
                  <textarea value={editing.answer} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} rows={3} className={`${INPUT} resize-none`} placeholder="Answer" />
                  <div className="flex gap-3">
                    <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className={`${INPUT} flex-1`}>
                      {FAQ_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className={`${INPUT} w-24`} placeholder="Order" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleEditSave} disabled={saving} className="flex-1 rounded-lg bg-[#0B1F3A] py-2 text-[12px] font-semibold text-white hover:bg-[#38BDF8] disabled:opacity-50 transition">{saving ? "…" : "Save"}</button>
                    <button onClick={() => setEditing(null)} className="flex-1 rounded-lg border border-gray-200 py-2 text-[12px] font-semibold text-gray-500 hover:bg-gray-50">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#38BDF8]/10 px-2 py-0.5 text-[10px] font-bold text-[#0B1F3A]">{item.category}</span>
                      {!item.active && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-400">Inactive</span>}
                    </div>
                    <p className="text-[13px] font-semibold text-[#0F172A]">{item.question}</p>
                    <p className="mt-1 line-clamp-2 text-[12px] text-gray-500">{item.answer}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button onClick={() => setEditing(item)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-600 hover:border-[#38BDF8] hover:text-[#38BDF8] transition">Edit</button>
                    <button onClick={() => handleToggle(item)} disabled={toggling === item.id}
                      className={["rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-50",
                        item.active ? "border-[#38BDF8]/30 bg-[#38BDF8]/8 text-[#38BDF8]" : "border-gray-200 text-gray-400 hover:text-[#38BDF8]"].join(" ")}>
                      {toggling === item.id ? "…" : item.active ? "On" : "Off"}
                    </button>
                    <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-red-400 hover:border-red-300 hover:bg-red-50 transition disabled:opacity-50">
                      {deleting === item.id ? "…" : "Del"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!error && filtered.length === 0 && (
            <SectionEmptyState
              variant="faq"
              heading={filter === "All" ? "No FAQ items yet" : `No items in "${filter}"`}
              subtext={filter === "All" ? "Add your first question and answer using the form above." : "Try a different category filter or add a new item."}
            />
          )}
        </div>
      )}
    </div>
  );
}
