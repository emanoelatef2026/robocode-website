export interface InstructorNavItem {
  key: string
  label: string
  href: string
  exact?: boolean
}

/** Canonical instructor portal navigation — all layouts derive from this. */
export const INSTRUCTOR_NAV: InstructorNavItem[] = [
  { key: 'dashboard', label: 'Dashboard',      href: '/portal/instructor',          exact: true },
  { key: 'groups',    label: 'My Groups',       href: '/portal/instructor/groups'               },
  { key: 'homework',  label: 'Homework',        href: '/portal/instructor/homework'             },
  { key: 'history',   label: 'Session History', href: '/portal/instructor/history'              },
]

/** Desktop sidebar groups the nav into sections. */
export const INSTRUCTOR_NAV_SECTIONS = [
  {
    title: undefined,
    keys: ['dashboard'],
  },
  {
    title: 'Teaching',
    keys: ['groups', 'homework', 'history'],
  },
] as const
