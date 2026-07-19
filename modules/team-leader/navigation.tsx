import { Icons } from "@/components/shared/layout/icons"
import type { PortalNavSection } from "@/components/shared/sidebar/PortalSidebar"
import type { BottomNavItem } from "@/components/shared/layout/BottomNav"

const SATISFACTION_MATCH = ["/portal/team-leader/parent-feedback", "/portal/team-leader/parent-satisfaction"]

/** Canonical Team Leader portal navigation — sidebar, bottom nav and page titles all derive from this. */
export const TL_SECTIONS: PortalNavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/portal/team-leader", icon: <Icons.dashboard />, exact: true },
    ],
  },
  {
    title: "People",
    items: [
      { label: "Leads",                  href: "/portal/team-leader/leads",                  icon: <Icons.leads /> },
      { label: "Students",               href: "/portal/team-leader/students",               icon: <Icons.students /> },
      { label: "Parents",                href: "/portal/team-leader/parents",                icon: <Icons.parents /> },
      { label: "Instructors",            href: "/portal/team-leader/instructors",            icon: <Icons.instructors /> },
      { label: "Instructor Performance", href: "/portal/team-leader/instructor-performance", icon: <Icons.performance /> },
    ],
  },
  {
    title: "Academics",
    items: [
      { label: "Groups",       href: "/portal/team-leader/groups",       icon: <Icons.groups /> },
      { label: "Courses",      href: "/portal/team-leader/courses",      icon: <Icons.courses /> },
      { label: "Certificates", href: "/portal/team-leader/certificates", icon: <Icons.certificates /> },
      { label: "Portfolio",    href: "/portal/team-leader/portfolio",    icon: <Icons.portfolio /> },
      { label: "Evaluations",  href: "/portal/team-leader/evaluations",  icon: <Icons.evaluations /> },
      { label: "Notes",        href: "/portal/team-leader/notes",        icon: <Icons.notes /> },
      { label: "Competitions", href: "/portal/team-leader/competitions", icon: <Icons.competitions /> },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Payroll",     href: "/portal/team-leader/payroll",     icon: <Icons.payroll /> },
      { label: "Collections", href: "/portal/team-leader/finance",     icon: <Icons.collections /> },
      { label: "Watchlist",   href: "/portal/team-leader/collections", icon: <Icons.watchlist /> },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Special Sessions", href: "/portal/team-leader/special-sessions", icon: <Icons.schedules /> },
      { label: "Calendar",         href: "/portal/team-leader/calendar",         icon: <Icons.schedules /> },
    ],
  },
  {
    title: "Insights",
    items: [
      { label: "Analytics", href: "/portal/team-leader/analytics", icon: <Icons.analytics /> },
      {
        label: "Satisfaction",
        href: "/portal/team-leader/parent-feedback?tab=reviews",
        icon: <Icons.satisfaction />,
        matchPatterns: SATISFACTION_MATCH,
      },
    ],
  },
]

export const TL_BOTTOM_NAV: BottomNavItem[] = [
  { label: "Dashboard",   href: "/portal/team-leader",             icon: <Icons.dashboard className="h-6 w-6" />,   exact: true },
  { label: "Students",    href: "/portal/team-leader/students",    icon: <Icons.students className="h-6 w-6" /> },
  { label: "Groups",      href: "/portal/team-leader/groups",      icon: <Icons.groups className="h-6 w-6" /> },
  { label: "Instructors", href: "/portal/team-leader/instructors", icon: <Icons.instructors className="h-6 w-6" /> },
]

export const TL_BOTTOM_MORE: BottomNavItem[] = [
  { label: "Leads",        href: "/portal/team-leader/leads",                       icon: <Icons.leads className="h-6 w-6" /> },
  { label: "Parents",      href: "/portal/team-leader/parents",                     icon: <Icons.parents className="h-6 w-6" /> },
  { label: "Courses",      href: "/portal/team-leader/courses",                     icon: <Icons.courses className="h-6 w-6" /> },
  { label: "Certificates", href: "/portal/team-leader/certificates",                icon: <Icons.certificates className="h-6 w-6" /> },
  { label: "Portfolio",    href: "/portal/team-leader/portfolio",                   icon: <Icons.portfolio className="h-6 w-6" /> },
  { label: "Satisfaction", href: "/portal/team-leader/parent-feedback?tab=reviews", icon: <Icons.satisfaction className="h-6 w-6" />, matchPatterns: SATISFACTION_MATCH },
  { label: "Analytics",    href: "/portal/team-leader/analytics",                   icon: <Icons.analytics className="h-6 w-6" /> },
  { label: "Performance",  href: "/portal/team-leader/instructor-performance",      icon: <Icons.performance className="h-6 w-6" /> },
  { label: "Payroll",      href: "/portal/team-leader/payroll",                     icon: <Icons.payroll className="h-6 w-6" />, matchPatterns: ["/portal/team-leader/instructor-payroll"] },
  { label: "Watchlist",    href: "/portal/team-leader/collections",                 icon: <Icons.watchlist className="h-6 w-6" /> },
]
