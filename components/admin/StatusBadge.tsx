type Status = "new" | "contacted" | "confirmed" | "cancelled";

const STYLES: Record<Status, string> = {
  new:       "bg-blue-50 text-blue-600",
  contacted: "bg-amber-50 text-amber-600",
  confirmed: "bg-emerald-50 text-emerald-600",
  cancelled: "bg-red-50 text-red-500",
};

const LABELS: Record<Status, string> = {
  new:       "New",
  contacted: "Contacted",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
