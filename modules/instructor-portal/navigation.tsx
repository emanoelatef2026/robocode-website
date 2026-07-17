import { Icons } from "@/components/shared/layout/icons"
import type { PortalNavSection } from "@/components/shared/sidebar/PortalSidebar"
import type { BottomNavItem } from "@/components/shared/layout/BottomNav"

export interface InstructorNavItem {
  key:   string
  label: string
  href:  string
  exact?: boolean
}

/** Canonical instructor portal navigation — sidebar, bottom nav and page titles all derive from this. */
export const INSTRUCTOR_NAV: InstructorNavItem[] = [
  { key: 'dashboard', label: 'Dashboard',      href: '/portal/instructor',                  exact: true },
  { key: 'review',    label: 'Review Center',   href: '/portal/instructor/review'                       },
  { key: 'groups',    label: 'My Groups',       href: '/portal/instructor/groups'                       },
  { key: 'calendar',  label: 'Calendar',        href: '/portal/instructor/calendar'                     },
  { key: 'students',  label: 'Students',        href: '/portal/instructor/students/search'              },
  { key: 'homework',  label: 'Homework',        href: '/portal/instructor/homework'                     },
  { key: 'portfolio', label: 'Portfolio',       href: '/portal/instructor/portfolio'                    },
  { key: 'history',   label: 'My Sessions',     href: '/portal/instructor/history'                      },
  { key: 'performance', label: 'Performance',   href: '/portal/instructor/performance'                  },
  { key: 'payments',  label: 'My Payments',     href: '/portal/instructor/payments'                     },
]

/** Desktop sidebar groups the nav into sections. */
export const INSTRUCTOR_NAV_SECTIONS = [
  { title: undefined, keys: ['dashboard', 'review'] },
  { title: 'Teaching', keys: ['groups', 'calendar', 'students', 'homework', 'portfolio', 'history'] },
  { title: 'Insights', keys: ['performance'] },
  { title: 'Finance', keys: ['payments'] },
] as const

/** Primary tabs shown directly in the mobile bottom bar. */
const BOTTOM_NAV_KEYS = ['dashboard', 'review', 'groups', 'calendar'] as const

const ICON_MAP: Record<string, keyof typeof Icons> = {
  dashboard: 'dashboard',
  review:    'reports',
  groups:    'groups',
  calendar:  'schedules',
  students:  'students',
  homework:  'assignments',
  portfolio: 'portfolio',
  history:   'sessions',
  performance: 'performance',
  payments:  'payroll',
}

const navByKey = Object.fromEntries(INSTRUCTOR_NAV.map(n => [n.key, n]))

function icon(key: string, className?: string) {
  const Icon = Icons[ICON_MAP[key]]
  return <Icon className={className} />
}

export const INSTRUCTOR_SECTIONS: PortalNavSection[] = INSTRUCTOR_NAV_SECTIONS.map(s => ({
  title: s.title,
  items: [...s.keys].map(key => {
    const item = navByKey[key]!
    return { label: item.label, href: item.href, icon: icon(key), exact: item.exact }
  }),
}))

export const INSTRUCTOR_BOTTOM_NAV: BottomNavItem[] = BOTTOM_NAV_KEYS.map(key => {
  const item = navByKey[key]!
  return { label: item.key === 'dashboard' ? 'Home' : item.label, href: item.href, icon: icon(key, 'h-6 w-6'), exact: item.exact }
})

export const INSTRUCTOR_BOTTOM_MORE: BottomNavItem[] = INSTRUCTOR_NAV
  .filter(n => !BOTTOM_NAV_KEYS.includes(n.key as typeof BOTTOM_NAV_KEYS[number]))
  .map(item => ({ label: item.label, href: item.href, icon: icon(item.key, 'h-6 w-6'), exact: item.exact }))
