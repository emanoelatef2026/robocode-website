"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import SectionEmptyState from "@/components/ui/SectionEmptyState";

const CATEGORIES = ["General", "AI", "Robotics", "Game Dev", "Programming", "Competitions", "Events", "Tips"];

interface BlogPost {
  id:             string;
  title:          string;
  slug:           string;
  status:         string;
  category:       string;
  author:         string;
  published_at:   string | null;
  created_at:     string;
  featured_image: string | null;
}

interface EditForm {
  title:            string;
  slug:             string;
  excerpt:          string;
  content:          string;
  category:         string;
  author:           string;
  seo_title:        string;
  meta_description: string;
  og_image_url:     string;
  status:           string;
}

const INPUT = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] text-[#0B1F3A] outline-none transition focus:border-[#38BDF8] focus:ring-2 focus:ring-[#38BDF8]/20";
const LABEL = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400";

const blankForm: EditForm = {
  title: "", slug: "", excerpt: "", content: "",
  category: "General", author: "Robocode",
  seo_title: "", meta_description: "", og_image_url: "", status: "draft",
};

function toSlug(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function BlogAdminPage() {
  const [posts,    setPosts]    = useState<BlogPost[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing,  setEditing]  = useState<BlogPost | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(blankForm);
  const [newForm,  setNewForm]  = useState<EditForm>(blankForm);
  const [file,     setFile]     = useState<File | null>(null);
  const [tab,      setTab]      = useState<"add" | "list">("add");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/studio/blog")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
        return d;
      })
      .then((d) => setPosts(Array.isArray(d) ? d : []))
      .catch((e: Error) => setError(e.message ?? "Failed to connect to database"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    if (file) fd.append("featured_image", file);
    Object.entries(newForm).forEach(([k, v]) => fd.append(k, v));
    const res = await fetch("/api/studio/blog", { method: "POST", body: fd });
    setSaving(false);
    if (res.ok) { setNewForm(blankForm); setFile(null); if (fileRef.current) fileRef.current.value = ""; load(); setTab("list"); }
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? "Failed"); }
  };

  const handleEditSave = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await fetch(`/api/studio/blog/${editing.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm }),
    });
    setSaving(false);
    if (res.ok) { setEditing(null); load(); }
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? "Failed"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    setDeleting(id);
    await fetch(`/api/studio/blog/${id}`, { method: "DELETE" });
    setDeleting(null);
    load();
  };

  const startEdit = (post: BlogPost) => {
    setEditing(post);
    setEditForm({ title: post.title, slug: post.slug, excerpt: "", content: "", category: post.category, author: post.author, seo_title: "", meta_description: "", og_image_url: "", status: post.status });
  };

  const f = newForm;
  const setF = (partial: Partial<EditForm>) => setNewForm((prev) => ({ ...prev, ...partial }));

  return (
    <div className="space-y-6">

      {/* Real error — only shown when API/DB actually fails */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          <strong>Connection error:</strong> {error}
          <button onClick={load} className="ml-3 underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-gray-100 bg-gray-50 p-1 w-fit">
        {(["add", "list"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={["rounded-md px-4 py-1.5 text-[13px] font-semibold transition",
              tab === t ? "bg-white text-[#0B1F3A] shadow-sm" : "text-gray-400 hover:text-gray-700"].join(" ")}>
            {t === "add" ? "New Post" : `All Posts (${posts.length})`}
          </button>
        ))}
      </div>

      {tab === "add" && (
        <form onSubmit={handleAdd} className="space-y-5 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-[14px] font-semibold text-[#0B1F3A]">Create New Post</h2>

          {/* Core fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Title *</label>
              <input value={f.title} onChange={(e) => setF({ title: e.target.value, slug: toSlug(e.target.value) })} placeholder="Article title" required className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Slug *</label>
              <input value={f.slug} onChange={(e) => setF({ slug: toSlug(e.target.value) })} placeholder="url-friendly-slug" required className={INPUT} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Excerpt</label>
            <textarea value={f.excerpt} onChange={(e) => setF({ excerpt: e.target.value })} rows={2} placeholder="Short summary shown on blog listing…" className={`${INPUT} resize-none`} />
          </div>

          <div>
            <label className={LABEL}>Content (HTML)</label>
            <p className="mb-1.5 text-[11px] text-gray-400">Enter content as HTML. Use &lt;h2&gt;, &lt;h3&gt;, &lt;p&gt;, &lt;strong&gt;, &lt;ul&gt;&lt;li&gt;, &lt;img src="…"&gt; tags.</p>
            <textarea value={f.content} onChange={(e) => setF({ content: e.target.value })} rows={10} placeholder="<h2>Introduction</h2><p>Your content here…</p>" className={`${INPUT} resize-y font-mono text-[12px]`} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={LABEL}>Category</label>
              <select value={f.category} onChange={(e) => setF({ category: e.target.value })} className={INPUT}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Author</label>
              <input value={f.author} onChange={(e) => setF({ author: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Status</label>
              <select value={f.status} onChange={(e) => setF({ status: e.target.value })} className={INPUT}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL}>Featured Image</label>
            <p className="mb-1.5 text-[11px] text-gray-400">WebP recommended · 1600×900 · max 400KB</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-[13px] text-gray-500 file:mr-2 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-gray-600 hover:file:bg-gray-200" />
          </div>

          {/* SEO fields */}
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">SEO Fields (optional)</p>
            <div className="space-y-3">
              <div>
                <label className={LABEL}>SEO Title</label>
                <input value={f.seo_title} onChange={(e) => setF({ seo_title: e.target.value })} placeholder="Override the browser tab title" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Meta Description</label>
                <textarea value={f.meta_description} onChange={(e) => setF({ meta_description: e.target.value })} rows={2} placeholder="Search engine snippet (150–160 chars ideal)" className={`${INPUT} resize-none`} />
              </div>
              <div>
                <label className={LABEL}>OG Image URL</label>
                <input value={f.og_image_url} onChange={(e) => setF({ og_image_url: e.target.value })} placeholder="https://… (defaults to featured image)" className={INPUT} />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving}
              className="rounded-lg bg-[#0B1F3A] px-8 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#38BDF8] disabled:opacity-50">
              {saving ? "Saving…" : f.status === "published" ? "Publish Post" : "Save Draft"}
            </button>
          </div>
        </form>
      )}

      {tab === "list" && (
        loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#38BDF8] border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div key={post.id} className="rounded-xl border border-gray-100 bg-white shadow-sm">
                {editing?.id === post.id ? (
                  <div className="p-5 space-y-4">
                    <h3 className="text-[13px] font-semibold text-[#0B1F3A]">Editing: {post.title}</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><label className={LABEL}>Title</label><input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className={INPUT} /></div>
                      <div><label className={LABEL}>Slug</label><input value={editForm.slug} onChange={(e) => setEditForm({ ...editForm, slug: toSlug(e.target.value) })} className={INPUT} /></div>
                    </div>
                    <div><label className={LABEL}>Excerpt</label><textarea value={editForm.excerpt} onChange={(e) => setEditForm({ ...editForm, excerpt: e.target.value })} rows={2} className={`${INPUT} resize-none`} /></div>
                    <div><label className={LABEL}>Content (HTML)</label><textarea value={editForm.content} onChange={(e) => setEditForm({ ...editForm, content: e.target.value })} rows={8} className={`${INPUT} resize-y font-mono text-[12px]`} /></div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div><label className={LABEL}>Category</label><select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className={INPUT}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
                      <div><label className={LABEL}>Author</label><input value={editForm.author} onChange={(e) => setEditForm({ ...editForm, author: e.target.value })} className={INPUT} /></div>
                      <div><label className={LABEL}>Status</label><select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className={INPUT}><option value="draft">Draft</option><option value="published">Published</option></select></div>
                    </div>
                    <div><label className={LABEL}>SEO Title</label><input value={editForm.seo_title} onChange={(e) => setEditForm({ ...editForm, seo_title: e.target.value })} className={INPUT} /></div>
                    <div><label className={LABEL}>Meta Description</label><textarea value={editForm.meta_description} onChange={(e) => setEditForm({ ...editForm, meta_description: e.target.value })} rows={2} className={`${INPUT} resize-none`} /></div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={handleEditSave} disabled={saving} className="flex-1 rounded-lg bg-[#0B1F3A] py-2 text-[13px] font-semibold text-white hover:bg-[#38BDF8] disabled:opacity-50 transition">{saving ? "Saving…" : "Save"}</button>
                      <button onClick={() => setEditing(null)} className="flex-1 rounded-lg border border-gray-200 py-2 text-[13px] font-semibold text-gray-500 hover:bg-gray-50">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 p-4">
                    {post.featured_image && (
                      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        <Image src={post.featured_image} alt={post.title} fill sizes="80px" className="object-cover" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[13px] font-bold text-[#0B1F3A]">{post.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${post.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {post.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-gray-400">{post.category} · {post.author} · /blog/{post.slug}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => startEdit(post)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-600 hover:border-[#38BDF8] hover:text-[#38BDF8] transition">Edit</button>
                      <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-600 hover:border-[#38BDF8] hover:text-[#38BDF8] transition">View</a>
                      <button onClick={() => handleDelete(post.id)} disabled={deleting === post.id}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-red-400 hover:border-red-300 hover:bg-red-50 transition disabled:opacity-50">
                        {deleting === post.id ? "…" : "Del"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!error && posts.length === 0 && (
              <SectionEmptyState
                variant="blog"
                heading="No posts yet"
                subtext="Switch to the New Post tab to write and publish your first article."
              />
            )}
          </div>
        )
      )}
    </div>
  );
}
