import { Icons } from "@/components/shared/layout/icons"
import type { PortalNavSection } from "@/components/shared/sidebar/PortalSidebar"
import type { BottomNavItem } from "@/components/shared/layout/BottomNav"

export interface AdminNavItem {
  label:           string
  href:            string
  icon:            React.ReactNode
  permission?:     string
  superAdminOnly?: boolean
  matchPatterns?:  string[]
}

export interface AdminNavSection {
  title: string
  items: AdminNavItem[]
}

/** Canonical Super Admin navigation — sidebar and bottom nav filter this by role/permission, page titles derive from it. */
export const ADMIN_SECTIONS: AdminNavSection[] = [
  {
    title: '',
    items: [
      { label: 'Dashboard', href: '/admin', icon: <Icons.dashboard /> },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Leads',        href: '/admin/leads',        icon: <Icons.leads /> },
      { label: 'Students',     href: '/admin/students',     icon: <Icons.students />,    permission: 'manage_students' },
      { label: 'Parents',      href: '/admin/parents',      icon: <Icons.parents />,     permission: 'manage_parents' },
      { label: 'Instructors',  href: '/admin/instructors',  icon: <Icons.instructors />, permission: 'manage_instructors' },
      { label: 'Team Leaders', href: '/admin/team-leaders', icon: <Icons.teamLeaders />, superAdminOnly: true },
      { label: 'Staff',        href: '/admin/staff',        icon: <Icons.staff />,       superAdminOnly: true },
    ],
  },
  {
    title: 'Academics',
    items: [
      { label: 'Groups',       href: '/admin/groups',       icon: <Icons.groups />,      permission: 'manage_groups' },
      { label: 'Courses',      href: '/admin/courses',      icon: <Icons.courses />,     permission: 'manage_courses' },
      { label: 'Certificates', href: '/admin/certificates', icon: <Icons.certificates />, permission: 'manage_certificates' },
      { label: 'Portfolio',    href: '/admin/portfolio',    icon: <Icons.portfolio />,   permission: 'manage_portfolio' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Payroll',        href: '/admin/payroll',        icon: <Icons.payroll />,       permission: 'manage_financials' },
      { label: 'Collections',    href: '/admin/finance',        icon: <Icons.collections />,   permission: 'manage_financials' },
      { label: 'Finance Center', href: '/admin/finance-center', icon: <Icons.financeCenter />, superAdminOnly: true },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Attendance',       href: '/admin/attendance',       icon: <Icons.attendance />,  permission: 'manage_attendance' },
      { label: 'Assignments',      href: '/admin/assignments',      icon: <Icons.assignments /> },
      { label: 'Special Sessions', href: '/admin/special-sessions', icon: <Icons.schedules />,   permission: 'manage_schedule' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Analytics', href: '/admin/analytics', icon: <Icons.analytics /> },
      { label: 'Reports',   href: '/admin/executive', icon: <Icons.reports />, superAdminOnly: true },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Branches',             href: '/admin/branches',             icon: <Icons.branches />,  superAdminOnly: true },
      { label: 'System Health',        href: '/admin/system-health',        icon: <Icons.health />,    superAdminOnly: true },
      { label: 'Production Readiness', href: '/admin/production-readiness', icon: <Icons.readiness />, superAdminOnly: true },
    ],
  },
]

/** Same permission/superAdminOnly rules the sidebar has always used. */
export function filterAdminSections(role: string, permissions: string[]): PortalNavSection[] {
  const isSuperAdmin = role === 'super_admin'
  return ADMIN_SECTIONS
    .map((section) => ({
      title: section.title || undefined,
      items: section.items.filter((item) => {
        if (item.superAdminOnly) return isSuperAdmin
        if (item.permission) return permissions.includes(item.permission)
        return true
      }),
    }))
    .filter((section) => section.items.length > 0)
}

const PRIMARY: AdminNavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: <Icons.dashboard className="h-6 w-6" /> },
  { label: 'Students',  href: '/admin/students', icon: <Icons.students className="h-6 w-6" />, permission: 'manage_students' },
  { label: 'Groups',    href: '/admin/groups', icon: <Icons.groups className="h-6 w-6" />, permission: 'manage_groups' },
  { label: 'Leads',     href: '/admin/leads', icon: <Icons.leads className="h-6 w-6" /> },
]

const MORE_ITEMS: AdminNavItem[] = [
  { label: 'Instructors',   href: '/admin/instructors',    icon: <Icons.instructors className="h-6 w-6" />,  permission: 'manage_instructors' },
  { label: 'Parents',       href: '/admin/parents',        icon: <Icons.parents className="h-6 w-6" />,      permission: 'manage_parents' },
  { label: 'Team Leaders',  href: '/admin/team-leaders',   icon: <Icons.teamLeaders className="h-6 w-6" />,  superAdminOnly: true },
  { label: 'Staff',         href: '/admin/staff',          icon: <Icons.staff className="h-6 w-6" />,        superAdminOnly: true },
  { label: 'Courses',       href: '/admin/courses',        icon: <Icons.courses className="h-6 w-6" />,      permission: 'manage_courses' },
  { label: 'Certificates',  href: '/admin/certificates',   icon: <Icons.certificates className="h-6 w-6" />, permission: 'manage_certificates' },
  { label: 'Portfolio',     href: '/admin/portfolio',      icon: <Icons.portfolio className="h-6 w-6" />,    permission: 'manage_portfolio' },
  { label: 'Attendance',    href: '/admin/attendance',     icon: <Icons.attendance className="h-6 w-6" />,   permission: 'manage_attendance' },
  { label: 'Assignments',   href: '/admin/assignments',    icon: <Icons.assignments className="h-6 w-6" /> },
  { label: 'Payroll',       href: '/admin/payroll',        icon: <Icons.payroll className="h-6 w-6" />,       permission: 'manage_financials' },
  { label: 'Collections',   href: '/admin/finance',        icon: <Icons.collections className="h-6 w-6" />,  permission: 'manage_financials' },
  { label: 'Finance Center', href: '/admin/finance-center', icon: <Icons.financeCenter className="h-6 w-6" />, superAdminOnly: true },
  { label: 'Analytics',     href: '/admin/analytics',      icon: <Icons.analytics className="h-6 w-6" /> },
  { label: 'Reports',       href: '/admin/executive',      icon: <Icons.reports className="h-6 w-6" />,      superAdminOnly: true },
  { label: 'Branches',      href: '/admin/branches',       icon: <Icons.branches className="h-6 w-6" />,     superAdminOnly: true },
  { label: 'Comms',         href: '/admin/communications', icon: <Icons.comms className="h-6 w-6" /> },
  { label: 'Semesters',     href: '/admin/semesters',      icon: <Icons.semesters className="h-6 w-6" /> },
]

function filterItems(items: AdminNavItem[], role: string, permissions: string[]): BottomNavItem[] {
  const isSuperAdmin = role === 'super_admin'
  return items
    .filter((item) => {
      if (item.superAdminOnly) return isSuperAdmin
      if (item.permission) return permissions.includes(item.permission)
      return true
    })
    .map(({ label, href, icon, matchPatterns }) => ({ label, href, icon, matchPatterns }))
}

export function getAdminBottomNav(role: string, permissions: string[]) {
  return {
    items: filterItems(PRIMARY, role, permissions),
    moreItems: filterItems(MORE_ITEMS, role, permissions),
  }
}
