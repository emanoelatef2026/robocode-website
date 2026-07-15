import { Icons } from "@/components/shared/layout/icons"
import type { BottomNavItem } from "@/components/shared/layout/BottomNav"

export interface ParentNavItem {
  key:   string
  label: string
  href:  string
  exact?: boolean
}

const ICON_MAP: Record<string, keyof typeof Icons> = {
  dashboard:    'dashboard',
  assignments:  'assignments',
  attendance:   'attendance',
  progress:     'analytics',
  evaluations:  'evaluations',
  competitions: 'competitions',
  notes:        'notes',
  portfolio:    'portfolio',
  certificates: 'certificates',
  journey:      'journey',
  history:      'sessions',
  finance:      'payroll',
  feedback:     'satisfaction',
}

/** Canonical Parent portal navigation — sidebar and bottom nav both derive from this. */
export const PARENT_NAV_ITEMS: ParentNavItem[] = [
  { key: 'dashboard',    label: "Dashboard",    href: "/portal/parent",              exact: true },
  { key: 'assignments',  label: "Assignments",  href: "/portal/parent/assignments" },
  { key: 'attendance',   label: "Attendance",   href: "/portal/parent/attendance" },
  { key: 'progress',     label: "Progress",     href: "/portal/parent/progress" },
  { key: 'evaluations',  label: "Evaluations",  href: "/portal/parent/evaluations" },
  { key: 'competitions', label: "Competitions", href: "/portal/parent/competitions" },
  { key: 'notes',        label: "Notes",        href: "/portal/parent/notes" },
  { key: 'portfolio',    label: "Portfolio",    href: "/portal/parent/portfolio" },
  { key: 'certificates', label: "Certificates", href: "/portal/parent/certificates" },
  { key: 'journey',      label: "Journey",      href: "/portal/parent/journey" },
  { key: 'history',      label: "History",      href: "/portal/parent/semesters" },
  { key: 'finance',      label: "Finance",      href: "/portal/parent/finance" },
  { key: 'feedback',     label: "Feedback",     href: "/portal/parent/feedback" },
]

export function parentIcon(key: string, className?: string) {
  const Icon = Icons[ICON_MAP[key]]
  return <Icon className={className} />
}

const BOTTOM_NAV_KEYS = ['dashboard', 'assignments', 'attendance', 'progress']

export const PARENT_BOTTOM_NAV: BottomNavItem[] = PARENT_NAV_ITEMS
  .filter((i) => BOTTOM_NAV_KEYS.includes(i.key))
  .map((i) => ({ label: i.key === 'dashboard' ? 'Home' : i.label, href: i.href, exact: i.exact, icon: parentIcon(i.key, 'h-6 w-6') }))

export const PARENT_BOTTOM_MORE: BottomNavItem[] = PARENT_NAV_ITEMS
  .filter((i) => !BOTTOM_NAV_KEYS.includes(i.key))
  .map((i) => ({ label: i.label, href: i.href, exact: i.exact, icon: parentIcon(i.key, 'h-6 w-6') }))
