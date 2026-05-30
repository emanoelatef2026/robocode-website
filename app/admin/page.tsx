import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth } from '@/modules/rbac/guards'
import InstructorDashboard from './_instructor-dashboard'
import Link from 'next/link'

// ── Admin / Team-Leader dashboard ─────────────────────────────────────────────

async function getStats(branchIds: string[] | null) {
  const db     = createServiceClient()
  const scoped = branchIds && branchIds.length > 0

  function qBranches() {
    const base = db.from('branches').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('is_active', true)
    return scoped ? base.in('id', branchIds!) : base
  }
  function qStudents() {
    const base = db.from('students').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'active')
    return scoped ? base.in('branch_id', branchIds!) : base
  }
  function qInstructors() {
    const base = db.from('instructors').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'active')
    return scoped ? base.in('branch_id', branchIds!) : base
  }
  function qGroups() {
    const base = db.from('groups').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'active')
    return scoped ? base.in('branch_id', branchIds!) : base
  }

  const [branches, students, instructors, groups] = await Promise.all([
    qBranches(), qStudents(), qInstructors(), qGroups(),
  ])
  return {
    branches:    branches.count    ?? 0,
    students:    students.count    ?? 0,
    instructors: instructors.count ?? 0,
    groups:      groups.count      ?? 0,
  }
}

const STAT_CARDS = [
  { key: 'branches',    label: 'Active Branches',    href: '/admin/branches',    color: 'bg-[#FF8A1F]' },
  { key: 'students',    label: 'Active Students',    href: '/admin/students',    color: 'bg-emerald-500' },
  { key: 'instructors', label: 'Active Instructors', href: '/admin/instructors', color: 'bg-blue-500' },
  { key: 'groups',      label: 'Active Groups',      href: '/admin/groups',      color: 'bg-violet-500' },
] as const

const ALL_QUICK_LINKS: { label: string; href: string; superAdminOnly?: boolean; permission?: string }[] = [
  { label: 'Add Branch',      href: '/admin/branches/new',    superAdminOnly: true },
  { label: 'Add Student',     href: '/admin/students/new',    permission: 'manage_students' },
  { label: 'Add Instructor',  href: '/admin/instructors/new', permission: 'manage_instructors' },
  { label: 'Create Group',    href: '/admin/groups/new',      permission: 'manage_groups' },
  { label: 'Mark Attendance', href: '/admin/attendance',      permission: 'manage_attendance' },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminDashboard() {
  const user = await requireAuth()

  if (user.globalRole === 'instructor') {
    return <InstructorDashboard userId={user.id} permissions={user.permissions} />
  }

  const isSuperAdmin = user.globalRole === 'super_admin'
  const branchFilter = isSuperAdmin ? null : user.branchIds
  const stats        = await getStats(branchFilter)

  const quickLinks = ALL_QUICK_LINKS.filter((l) => {
    if (l.superAdminOnly) return isSuperAdmin
    if (l.permission)     return user.permissions.includes(l.permission)
    return true
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#0B1F3A]">Dashboard</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">Robocode LMS overview</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label, href, color }) => (
          <Link
            key={key}
            href={href}
            className="group rounded-xl border border-[#E2E8F0] bg-white p-5 transition hover:border-[#CBD5E1] hover:shadow-sm"
          >
            <div className={`mb-3 h-2 w-8 rounded-full ${color} opacity-80`} />
            <p className="text-2xl font-bold text-[#0B1F3A]">
              {stats[key as keyof typeof stats]}
            </p>
            <p className="mt-0.5 text-xs text-[#64748B]">{label}</p>
          </Link>
        ))}
      </div>

      {quickLinks.length > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
          <h2 className="mb-4 text-sm font-medium text-[#0B1F3A]">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            {quickLinks.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
