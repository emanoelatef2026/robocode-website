interface StatusConfig {
  bg: string;
  text: string;
  label: string;
  dot?: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  // Attendance
  present:    { bg: "bg-[#E7F8EE]", text: "text-[#15803D]", label: "Present",    dot: "bg-[#10B981]" },
  absent:     { bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]", label: "Absent",     dot: "bg-[#EF4444]" },
  late:       { bg: "bg-[#FFFBEB]", text: "text-[#B45309]", label: "Late",       dot: "bg-[#F59E0B]" },
  excused:    { bg: "bg-[#E0F2FE]", text: "text-[#0369A1]", label: "Excused",    dot: "bg-[#38BDF8]" },
  makeup:     { bg: "bg-[#F3E8FF]", text: "text-[#6B21A8]", label: "Makeup",     dot: "bg-[#A855F7]" },
  // People / Groups
  active:     { bg: "bg-[#E7F8EE]", text: "text-[#15803D]", label: "Active",     dot: "bg-[#10B981]" },
  inactive:   { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: "Inactive",   dot: "bg-[#94A3B8]" },
  graduated:  { bg: "bg-[#E0F2FE]", text: "text-[#0369A1]", label: "Graduated",  dot: "bg-[#38BDF8]" },
  paused:     { bg: "bg-[#FFFBEB]", text: "text-[#B45309]", label: "Paused",     dot: "bg-[#F59E0B]" },
  banned:     { bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]", label: "Banned",     dot: "bg-[#EF4444]" },
  on_leave:   { bg: "bg-[#FFF1E2]", text: "text-[#FF8A1F]", label: "On Leave",   dot: "bg-[#FF8A1F]" },
  dropped:    { bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]", label: "Dropped",    dot: "bg-[#EF4444]" },
  waitlisted: { bg: "bg-[#F3E8FF]", text: "text-[#6B21A8]", label: "Waitlisted", dot: "bg-[#A855F7]" },
  // Groups / Courses / Sessions
  forming:    { bg: "bg-[#FFFBEB]", text: "text-[#B45309]", label: "Forming",    dot: "bg-[#F59E0B]" },
  completed:  { bg: "bg-[#E7F8EE]", text: "text-[#15803D]", label: "Completed",  dot: "bg-[#10B981]" },
  ongoing:    { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", label: "Ongoing",    dot: "bg-[#3B82F6]" },
  scheduled:  { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: "Scheduled",  dot: "bg-[#94A3B8]" },
  cancelled:  { bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]", label: "Cancelled",  dot: "bg-[#EF4444]" },
  postponed:  { bg: "bg-[#FFF7ED]", text: "text-[#C2410C]", label: "Postponed",  dot: "bg-[#FB923C]" },
  online:     { bg: "bg-[#E0F2FE]", text: "text-[#0369A1]", label: "Online",     dot: "bg-[#38BDF8]" },
  offline:    { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: "Offline",    dot: "bg-[#94A3B8]" },
  hybrid:     { bg: "bg-[#F3E8FF]", text: "text-[#6B21A8]", label: "Hybrid",     dot: "bg-[#A855F7]" },
  // Leads / Finance
  pending:    { bg: "bg-[#FFF1E2]", text: "text-[#FF8A1F]", label: "Pending",    dot: "bg-[#FF8A1F]" },
  converted:  { bg: "bg-[#E7F8EE]", text: "text-[#15803D]", label: "Converted",  dot: "bg-[#10B981]" },
  lost:       { bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]", label: "Lost",       dot: "bg-[#EF4444]" },
  // Assignments
  published:  { bg: "bg-[#E7F8EE]", text: "text-[#15803D]", label: "Published",  dot: "bg-[#10B981]" },
  draft:      { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: "Draft",      dot: "bg-[#94A3B8]" },
  closed:     { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: "Closed",     dot: "bg-[#94A3B8]" },
  submitted:  { bg: "bg-[#E0F2FE]", text: "text-[#0369A1]", label: "Submitted",  dot: "bg-[#38BDF8]" },
  graded:     { bg: "bg-[#E7F8EE]", text: "text-[#15803D]", label: "Graded",     dot: "bg-[#10B981]" },
  returned:   { bg: "bg-[#FFFBEB]", text: "text-[#B45309]", label: "Returned",   dot: "bg-[#F59E0B]" },
  under_review:           { bg: "bg-[#F3E8FF]", text: "text-[#6B21A8]", label: "Under Review",    dot: "bg-[#A855F7]" },
  resubmission_requested: { bg: "bg-[#FFF1E2]", text: "text-[#FF8A1F]", label: "Resubmission",   dot: "bg-[#FF8A1F]" },
  resubmitted:            { bg: "bg-[#E0F2FE]", text: "text-[#0369A1]", label: "Resubmitted",    dot: "bg-[#38BDF8]" },
  // Booleans
  true:  { bg: "bg-[#E7F8EE]", text: "text-[#15803D]", label: "Yes", dot: "bg-[#10B981]" },
  false: { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: "No",  dot: "bg-[#94A3B8]" },
};

interface Props {
  status: string;
  dot?: boolean;
}

export default function StatusBadge({ status, dot = false }: Props) {
  const config = STATUS_CONFIG[status] ?? { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: status, dot: "bg-[#94A3B8]" };
  const label = config.label !== status
    ? config.label
    : status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${config.bg} ${config.text}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${config.dot ?? 'bg-current'}`} />}
      {label}
    </span>
  );
}
