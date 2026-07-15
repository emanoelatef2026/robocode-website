import { Icons } from "@/components/shared/layout/icons"
import type { PortalNavSection } from "@/components/shared/sidebar/PortalSidebar"
import type { BottomNavItem } from "@/components/shared/layout/BottomNav"

export interface StudentNavItem {
  key:   string
  label: string
  href:  string
  exact?: boolean
}

const ICON_MAP: Record<string, keyof typeof Icons> = {
  dashboard:    'dashboard',
  journey:      'journey',
  achievements: 'achievements',
  evaluations:  'evaluations',
  competitions: 'competitions',
  notes:        'notes',
  sessions:     'sessions',
  assignments:  'assignments',
  attendance:   'attendance',
  certificates: 'certificates',
  portfolio:    'portfolio',
  videos:       'videos',
  leaderboard:  'leaderboard',
}

/** Canonical Student portal navigation — sidebar and bottom nav both derive from this. */
export const STUDENT_NAV_ITEMS: StudentNavItem[] = [
  { key: 'dashboard',    label: "Dashboard",    href: "/portal/student",              exact: true },
  { key: 'journey',      label: "Journey",      href: "/portal/student/journey" },
  { key: 'achievements', label: "Achievements", href: "/portal/student/achievements" },
  { key: 'evaluations',  label: "Evaluations",  href: "/portal/student/evaluations" },
  { key: 'competitions', label: "Competitions", href: "/portal/student/competitions" },
  { key: 'notes',        label: "Notes",        href: "/portal/student/notes" },
  { key: 'sessions',     label: "Sessions",     href: "/portal/student/history" },
  { key: 'assignments',  label: "Assignments",  href: "/portal/student/assignments" },
  { key: 'attendance',   label: "Attendance",   href: "/portal/student/attendance" },
  { key: 'certificates', label: "Certificates", href: "/portal/student/certificates" },
  { key: 'portfolio',    label: "Portfolio",    href: "/portal/student/portfolio" },
  { key: 'videos',       label: "My Videos",    href: "/portal/student/videos" },
  { key: 'leaderboard',  label: "Leaderboard",  href: "/portal/student/leaderboard" },
]

function icon(key: string, className?: string) {
  const Icon = Icons[ICON_MAP[key]]
  return <Icon className={className} />
}

export const STUDENT_SECTIONS: PortalNavSection[] = [
  { items: STUDENT_NAV_ITEMS.map((i) => ({ label: i.label, href: i.href, exact: i.exact, icon: icon(i.key) })) },
]

const BOTTOM_NAV_KEYS = ['dashboard', 'assignments', 'sessions', 'portfolio']

export const STUDENT_BOTTOM_NAV: BottomNavItem[] = STUDENT_NAV_ITEMS
  .filter((i) => BOTTOM_NAV_KEYS.includes(i.key))
  .map((i) => ({ label: i.key === 'dashboard' ? 'Home' : i.label, href: i.href, exact: i.exact, icon: icon(i.key, 'h-6 w-6') }))

export const STUDENT_BOTTOM_MORE: BottomNavItem[] = STUDENT_NAV_ITEMS
  .filter((i) => !BOTTOM_NAV_KEYS.includes(i.key))
  .map((i) => ({ label: i.label, href: i.href, exact: i.exact, icon: icon(i.key, 'h-6 w-6') }))
