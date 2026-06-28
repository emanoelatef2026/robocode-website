"use client";

import { usePathname } from "next/navigation";
import { useTopbarAction } from "./TopbarActionContext";

const PATH_TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/students": "Students",
  "/admin/parents": "Parents",
  "/admin/instructors": "Instructors",
  "/admin/team-leaders": "Team Leaders",
  "/admin/staff": "Staff",
  "/admin/groups": "Groups",
  "/admin/courses": "Courses",
  "/admin/certificates": "Certificates",
  "/admin/payroll": "Payroll",
  "/admin/finance": "Collections",
  "/admin/finance-center": "Finance Center",
  "/admin/revenue": "Finance Center",
  "/admin/expenses": "Finance Center",
  "/admin/attendance": "Attendance",
  "/admin/assignments": "Assignments",
  "/admin/analytics": "Analytics",
  "/admin/executive": "Reports",
  "/admin/branches": "Branches",
  "/admin/system-health": "System Health",
  "/admin/production-readiness": "Production Readiness",
  "/admin/leads": "Leads",
  "/admin/sessions": "Sessions",
  "/admin/communications": "Communications",
  "/admin/semesters": "Semesters",
  "/admin/portfolio": "Portfolio",
  // Team Leader portal paths
  "/portal/team-leader": "Dashboard",
  "/portal/team-leader/students": "Students",
  "/portal/team-leader/parents": "Parents",
  "/portal/team-leader/groups": "Groups",
  "/portal/team-leader/attendance": "Attendance",
  "/portal/team-leader/finance": "Finance",
  "/portal/team-leader/leads": "Leads",
  "/portal/team-leader/instructors": "Instructors",
  "/portal/team-leader/courses": "Courses",
  "/portal/team-leader/assignments": "Assignments",
  "/portal/team-leader/analytics": "Analytics",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  team_leader: "Team Leader",
  instructor:  "Instructor",
};

function getPageTitle(pathname: string): string {
  if (PATH_TITLES[pathname]) return PATH_TITLES[pathname];
  const sorted = Object.keys(PATH_TITLES).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (pathname.startsWith(key + "/")) return PATH_TITLES[key];
  }
  return "Dashboard";
}

interface Props {
  onMenuClick: () => void;
  role?:       string;
  branchName?: string;
}

export default function AdminTopbar({ onMenuClick, role = "super_admin", branchName }: Props) {
  const pathname  = usePathname();
  const { action } = useTopbarAction();

  const pageTitle   = getPageTitle(pathname);
  const roleLabel   = ROLE_LABELS[role] ?? "Admin";
  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-[#E2E8F0] bg-white px-4 md:px-6">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white transition hover:border-[#94A3B8] md:hidden"
        aria-label="Open menu"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4.5 w-4.5 text-[#64748B]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Page title */}
      <div className="hidden md:block">
        <h1 className="text-[17px] font-extrabold leading-tight text-[#0B1F3A] tracking-tight">
          {pageTitle}
        </h1>
        <p className="text-[11px] text-[#94A3B8] leading-none mt-0.5">
          {formattedDate} · {roleLabel}
        </p>
      </div>
      {/* Mobile: just show title */}
      <div className="block md:hidden">
        <h1 className="text-[16px] font-extrabold text-[#0B1F3A]">{pageTitle}</h1>
      </div>

      <div className="flex-1" />

      {/* Branch badge */}
      {branchName && (
        <div className="hidden items-center gap-1.5 rounded-[10px] border border-[#e4e9f0] bg-white px-3 py-1.5 md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF8A1F]" />
          <span className="text-[12px] font-semibold text-[#0B1F3A]">{branchName}</span>
        </div>
      )}

      {/* Page action injected by page via TopbarActionContext */}
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
