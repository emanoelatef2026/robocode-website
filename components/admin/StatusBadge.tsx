interface StatusConfig {
  bg: string;
  text: string;
  label: string;
  dot?: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  // Attendance
  present:    { bg: "bg-[#E7F8EE]", text: "text-[#166534]", label: "Present",    dot: "bg-[#16A34A]" },
  absent:     { bg: "bg-[#FEECEC]", text: "text-[#991B1B]", label: "Absent",     dot: "bg-[#DC2626]" },
  late:       { bg: "bg-[#FFF7E6]", text: "text-[#92400E]", label: "Late",       dot: "bg-[#D97706]" },
  excused:    { bg: "bg-[#E6F6FB]", text: "text-[#155E75]", label: "Excused",    dot: "bg-[#0E7490]" },
  makeup:     { bg: "bg-[#FFF1E2]", text: "text-[#9A3412]", label: "Makeup",     dot: "bg-[#C2410C]" },
  // People / Groups
  active:     { bg: "bg-[#E7F8EE]", text: "text-[#166534]", label: "Active",     dot: "bg-[#16A34A]" },
  inactive:   { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: "Inactive",   dot: "bg-[#94A3B8]" },
  graduated:  { bg: "bg-[#E6F6FB]", text: "text-[#155E75]", label: "Graduated",  dot: "bg-[#0E7490]" },
  paused:     { bg: "bg-[#FFF7E6]", text: "text-[#92400E]", label: "Paused",     dot: "bg-[#D97706]" },
  banned:     { bg: "bg-[#FEECEC]", text: "text-[#991B1B]", label: "Banned",     dot: "bg-[#DC2626]" },
  on_leave:   { bg: "bg-[#FFF1E2]", text: "text-[#9A3412]", label: "On Leave",   dot: "bg-[#C2410C]" },
  dropped:    { bg: "bg-[#FEECEC]", text: "text-[#991B1B]", label: "Dropped",    dot: "bg-[#DC2626]" },
  waitlisted: { bg: "bg-[#FFF1E2]", text: "text-[#9A3412]", label: "Waitlisted", dot: "bg-[#C2410C]" },
  // Groups / Courses / Sessions
  forming:    { bg: "bg-[#FFF7E6]", text: "text-[#92400E]", label: "Forming",    dot: "bg-[#D97706]" },
  completed:  { bg: "bg-[#E7F8EE]", text: "text-[#166534]", label: "Completed",  dot: "bg-[#16A34A]" },
  // Cohort lifecycle stages (Phase 1) — open/running/archived are derived
  // presentation labels (getCohortLifecycleStage), never a DB status. 'draft'
  // reuses the existing entry below (Assignments section) — same label/tone
  // already fits a not-yet-ready cohort.
  open:       { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", label: "Open",       dot: "bg-[#3B82F6]" },
  running:    { bg: "bg-[#E7F8EE]", text: "text-[#166534]", label: "Running",    dot: "bg-[#16A34A]" },
  archived:   { bg: "bg-[#F1F5F9]", text: "text-[#64748B]", label: "Archived",   dot: "bg-[#64748B]" },
  // Phase 2: a Draft cohort created by the Graduation Wizard, not yet given
  // a course/instructor/schedule — see modules/groups/actions/graduation.ts.
  setup_required: { bg: "bg-[#FFF7E6]", text: "text-[#92400E]", label: "Draft – Setup Required", dot: "bg-[#D97706]" },
  ongoing:    { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", label: "Ongoing",    dot: "bg-[#3B82F6]" },
  scheduled:  { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: "Scheduled",  dot: "bg-[#94A3B8]" },
  cancelled:  { bg: "bg-[#FEECEC]", text: "text-[#991B1B]", label: "Cancelled",  dot: "bg-[#DC2626]" },
  postponed:  { bg: "bg-[#FFF7ED]", text: "text-[#C2410C]", label: "Postponed",  dot: "bg-[#FB923C]" },
  online:     { bg: "bg-[#E6F6FB]", text: "text-[#155E75]", label: "Online",     dot: "bg-[#0E7490]" },
  offline:    { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: "Offline",    dot: "bg-[#94A3B8]" },
  hybrid:     { bg: "bg-[#FFF1E2]", text: "text-[#9A3412]", label: "Hybrid",     dot: "bg-[#C2410C]" },
  // Leads / Finance
  pending:    { bg: "bg-[#FFF7E6]", text: "text-[#92400E]", label: "Pending",    dot: "bg-[#D97706]" },
  converted:  { bg: "bg-[#E7F8EE]", text: "text-[#166534]", label: "Converted",  dot: "bg-[#16A34A]" },
  lost:       { bg: "bg-[#FEECEC]", text: "text-[#991B1B]", label: "Lost",       dot: "bg-[#DC2626]" },
  // Assignments
  published:  { bg: "bg-[#E7F8EE]", text: "text-[#166534]", label: "Published",  dot: "bg-[#16A34A]" },
  draft:      { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: "Draft",      dot: "bg-[#94A3B8]" },
  closed:     { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: "Closed",     dot: "bg-[#94A3B8]" },
  submitted:  { bg: "bg-[#E6F6FB]", text: "text-[#155E75]", label: "Submitted",  dot: "bg-[#0E7490]" },
  graded:     { bg: "bg-[#E7F8EE]", text: "text-[#166534]", label: "Graded",     dot: "bg-[#16A34A]" },
  returned:   { bg: "bg-[#FFF7E6]", text: "text-[#92400E]", label: "Returned",   dot: "bg-[#D97706]" },
  under_review:           { bg: "bg-[#FFF1E2]", text: "text-[#9A3412]", label: "Under Review",    dot: "bg-[#C2410C]" },
  resubmission_requested: { bg: "bg-[#FFF1E2]", text: "text-[#9A3412]", label: "Resubmission",   dot: "bg-[#C2410C]" },
  resubmitted:            { bg: "bg-[#E6F6FB]", text: "text-[#155E75]", label: "Resubmitted",    dot: "bg-[#0E7490]" },
  // Booleans
  true:  { bg: "bg-[#E7F8EE]", text: "text-[#166534]", label: "Yes", dot: "bg-[#16A34A]" },
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
