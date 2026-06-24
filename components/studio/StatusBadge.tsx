type Status = "new" | "contacted" | "confirmed" | "cancelled";

const STYLES: Record<Status, string> = {
  new:       "bg-[#EFF6FF] text-[#2563EB]",
  contacted: "bg-[#FFFBEB] text-[#F59E0B]",
  confirmed: "bg-[#E7F8EE] text-[#10B981]",
  cancelled: "bg-[#FEE2E2] text-[#EF4444]",
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
