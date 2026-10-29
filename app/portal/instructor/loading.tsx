export default function InstructorLoading() {
  return <div role="status" aria-live="polite" className="space-y-4 p-4"><p className="text-sm font-semibold text-(--text-2)">Loading your workspace…</p><div aria-hidden="true" className="motion-safe:animate-pulse space-y-4"><div className="h-24 rounded-xl bg-(--border-soft)" /><div className="h-12 rounded-xl bg-(--border-soft)" /><div className="h-64 rounded-xl bg-(--border-soft)" /></div></div>
}
