export interface InstructorNavItem {
  key: string
  label: string
  href: string
  exact?: boolean
}

/** Canonical instructor portal navigation — all layouts derive from this. */
export const INSTRUCTOR_NAV: InstructorNavItem[] = [
  { key: 'dashboard', label: 'Dashboard',      href: '/portal/instructor',                  exact: true },
  { key: 'groups',    label: 'My Groups',       href: '/portal/instructor/groups'                       },
  { key: 'calendar',  label: 'Calendar',        href: '/portal/instructor/calendar'                     },
  { key: 'students',  label: 'Students',        href: '/portal/instructor/students/search'              },
  { key: 'homework',  label: 'Homework',        href: '/portal/instructor/homework'                     },
  { key: 'history',   label: 'My Sessions',     href: '/portal/instructor/history'                      },
  { key: 'payments',  label: 'My Payments',     href: '/portal/instructor/payments'                     },
]

/** Desktop sidebar groups the nav into sections. */
export const INSTRUCTOR_NAV_SECTIONS = [
  {
    title: undefined,
    keys: ['dashboard'],
  },
  {
    title: 'Teaching',
    keys: ['groups', 'calendar', 'students', 'homework', 'history'],
  },
  {
    title: 'Finance',
    keys: ['payments'],
  },
] as const
