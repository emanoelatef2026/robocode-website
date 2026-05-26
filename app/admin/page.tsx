import { createServiceClient } from '@/lib/supabase/service'
import { requirePermission } from '@/modules/rbac/guards'
import Link from 'next/link'

async function getStats() {
  const db = createServiceClient()
  const [branches, students, instructors, groups] = await Promise.all([
    db.from('branches').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('is_active', true),
    db.from('students').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'active'),
    db.from('instructors').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'active'),
    db.from('groups').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'active'),
  ])
  return {
    branches:    branches.count ?? 0,
    students:    students.count ?? 0,
    instructors: instructors.count ?? 0,
    groups:      groups.count ?? 0,
  }
}

const STAT_CARDS = [
  { key: 'branches',    label: 'Active Branches',    href: '/admin/branches',    color: 'bg-[#FF8A1F]' },
  { key: 'students',    label: 'Active Students',    href: '/admin/students',    color: 'bg-emerald-500' },
  { key: 'instructors', label: 'Active Instructors', href: '/admin/instructors', color: 'bg-blue-500' },
  { key: 'groups',      label: 'Active Groups',      href: '/admin/groups',      color: 'bg-violet-500' },
] as const

const QUICK_LINKS = [
  { label: 'Add Branch',      href: '/admin/branches/new' },
  { label: 'Add Student',     href: '/admin/students/new' },
  { label: 'Add Instructor',  href: '/admin/instructors/new' },
  { label: 'Create Group',    href: '/admin/groups/new' },
  { label: 'Mark Attendance', href: '/admin/attendance' },
]

export default async function AdminDashboard() {
  await requirePermission('manage_system')
  const stats = await getStats()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#0B1F3A]">Dashboard</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">Robocode LMS overview</p>
      </div>

      {/* Stats */}
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

      {/* Quick links */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-[#0B1F3A]">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_LINKS.map(({ label, href }) => (
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
    </div>
  )
}
