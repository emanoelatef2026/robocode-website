const COLORS: Record<string, string> = {
  active:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive:    "bg-gray-50 text-gray-500 border-gray-200",
  graduated:   "bg-blue-50 text-blue-700 border-blue-200",
  paused:      "bg-amber-50 text-amber-700 border-amber-200",
  banned:      "bg-red-50 text-red-600 border-red-200",
  on_leave:    "bg-orange-50 text-orange-700 border-orange-200",
  online:      "bg-sky-50 text-sky-700 border-sky-200",
  offline:     "bg-slate-50 text-slate-600 border-slate-200",
  hybrid:      "bg-violet-50 text-violet-700 border-violet-200",
  forming:     "bg-yellow-50 text-yellow-700 border-yellow-200",
  completed:   "bg-teal-50 text-teal-700 border-teal-200",
  cancelled:   "bg-red-50 text-red-600 border-red-200",
  dropped:     "bg-red-50 text-red-500 border-red-200",
  waitlisted:  "bg-purple-50 text-purple-600 border-purple-200",
  present:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  absent:      "bg-red-50 text-red-600 border-red-200",
  late:        "bg-amber-50 text-amber-700 border-amber-200",
  excused:     "bg-blue-50 text-blue-600 border-blue-200",
  makeup:      "bg-purple-50 text-purple-600 border-purple-200",
  true:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  false:       "bg-gray-50 text-gray-500 border-gray-200",
};

export default function StatusBadge({ status }: { status: string }) {
  const cls = COLORS[status] ?? "bg-gray-50 text-gray-500 border-gray-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
