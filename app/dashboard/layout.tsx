import { requireAuth } from '@/modules/rbac/guards'
import { redirect }    from 'next/navigation'
import Link            from 'next/link'
import { ROLE_PORTAL_MAP } from '@/types/enums'
import type { RoleName } from '@/types/enums'

const ALLOWED: RoleName[] = ['super_admin', 'team_leader', 'instructor']

const ROLE_LABELS: Record<string, string> = {
  super_admin:  'Admin',
  team_leader:  'Team Leader',
  instructor:   'Instructor',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth()

  if (!ALLOWED.includes(user.globalRole)) {
    redirect(ROLE_PORTAL_MAP[user.globalRole] ?? '/login')
  }

  const backHref  = ROLE_PORTAL_MAP[user.globalRole] ?? '/'
  const roleLabel = ROLE_LABELS[user.globalRole] ?? user.globalRole

  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      {/* Top navigation */}
      <header className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          {/* Brand + nav links */}
          <div className="flex items-center gap-6">
            <Link
              href={backHref}
              className="flex items-center gap-1.5 text-sm font-medium text-[#64748B] hover:text-[#0B1F3A] transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0L4 10.414V17a1 1 0 01-1 1H3a1 1 0 01-1-1v-6l-1.293 1.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Portal
            </Link>

            <span className="h-4 w-px bg-[#E2E8F0]" />

            <nav className="flex items-center gap-1">
              {[
                { label: 'Overview',  href: '/dashboard/analytics' },
                { label: 'Groups',    href: '/dashboard/analytics/groups' },
                { label: 'Courses',   href: '/dashboard/analytics/courses' },
              ].map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0B1F3A] transition-colors"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Role badge */}
          <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-xs font-medium text-[#64748B]">
            {roleLabel}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-7">
        {children}
      </main>
    </div>
  )
}
