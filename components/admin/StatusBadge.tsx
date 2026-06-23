interface StatusConfig {
  bg: string;
  text: string;
  label: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  // Attendance
  present:    { bg: "bg-[#D1FAE5]", text: "text-[#15803D]", label: "Present"    },
  absent:     { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]", label: "Absent"     },
  late:       { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", label: "Late"       },
  excused:    { bg: "bg-[#E0F2FE]", text: "text-[#0369A1]", label: "Excused"    },
  makeup:     { bg: "bg-[#F3E8FF]", text: "text-[#6B21A8]", label: "Makeup"     },
  // People / Groups
  active:     { bg: "bg-[#D1FAE5]", text: "text-[#15803D]", label: "Active"     },
  inactive:   { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: "Inactive"   },
  graduated:  { bg: "bg-[#E0F2FE]", text: "text-[#0369A1]", label: "Graduated"  },
  paused:     { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", label: "Paused"     },
  banned:     { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]", label: "Banned"     },
  on_leave:   { bg: "bg-[#FFF1E2]", text: "text-[#FF8A1F]", label: "On Leave"   },
  dropped:    { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]", label: "Dropped"    },
  waitlisted: { bg: "bg-[#F3E8FF]", text: "text-[#6B21A8]", label: "Waitlisted" },
  // Groups / Courses
  forming:    { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", label: "Forming"    },
  completed:  { bg: "bg-[#D1FAE5]", text: "text-[#15803D]", label: "Completed"  },
  cancelled:  { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]", label: "Cancelled"  },
  online:     { bg: "bg-[#E0F2FE]", text: "text-[#0369A1]", label: "Online"     },
  offline:    { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: "Offline"    },
  hybrid:     { bg: "bg-[#F3E8FF]", text: "text-[#6B21A8]", label: "Hybrid"     },
  // Leads / Finance
  pending:    { bg: "bg-[#FFF1E2]", text: "text-[#FF8A1F]", label: "Pending"    },
  converted:  { bg: "bg-[#D1FAE5]", text: "text-[#15803D]", label: "Converted"  },
  lost:       { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]", label: "Lost"       },
  // Assignments
  published:  { bg: "bg-[#D1FAE5]", text: "text-[#15803D]", label: "Published"  },
  draft:      { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: "Draft"      },
  closed:     { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: "Closed"     },
  submitted:  { bg: "bg-[#E0F2FE]", text: "text-[#0369A1]", label: "Submitted"  },
  graded:     { bg: "bg-[#D1FAE5]", text: "text-[#15803D]", label: "Graded"     },
  returned:   { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", label: "Returned"   },
  under_review:            { bg: "bg-[#F3E8FF]", text: "text-[#6B21A8]", label: "Under Review"    },
  resubmission_requested:  { bg: "bg-[#FFF1E2]", text: "text-[#FF8A1F]", label: "Resubmission"   },
  resubmitted:             { bg: "bg-[#E0F2FE]", text: "text-[#0369A1]", label: "Resubmitted"    },
  // Booleans
  true:   { bg: "bg-[#D1FAE5]", text: "text-[#15803D]", label: "Yes" },
  false:  { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: "No"  },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { bg: "bg-[#F1F5F9]", text: "text-[#475569]", label: status };
  const label = config.label !== status
    ? config.label
    : status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold ${config.bg} ${config.text}`}
    >
      {label}
    </span>
  );
}
