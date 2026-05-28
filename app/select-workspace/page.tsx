import { redirect } from 'next/navigation'
import { getSessionCookie } from '@/lib/lms-session'
import { ROLE_PORTAL_MAP } from '@/types/enums'
import { signOut } from '@/modules/auth/actions'
import Image from 'next/image'
import Link from 'next/link'

// Only these roles reach the workspace picker; everyone else is redirected directly.
const WORKSPACE_PICKER_ROLES = new Set(['super_admin', 'team_leader'])

interface Workspace {
  title:       string
  description: string
  href:        string
  icon:        React.ReactNode
}

const ADMIN_WORKSPACES: Workspace[] = [
  {
    title:       'LMS Administration',
    description: 'Manage branches, students, instructors, courses, groups, and system settings.',
    href:        '/admin',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    title:       'Studio CMS',
    description: 'Edit the public website, blog, branch pages, and marketing content.',
    href:        '/studio',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    ),
  },
]

const TL_WORKSPACES: Workspace[] = [
  {
    title:       'Team Leader Portal',
    description: 'Manage your branch, students, groups, schedules, and instructors.',
    href:        '/portal/team-leader',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    title:       'Studio CMS',
    description: 'Edit the public website, blog, branch pages, and marketing content.',
    href:        '/studio',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    ),
  },
]

export default async function SelectWorkspacePage() {
  const session = await getSessionCookie()

  // No session — send to login
  if (!session) redirect('/login')

  // Single-workspace roles — redirect straight to their portal
  if (!WORKSPACE_PICKER_ROLES.has(session.role)) {
    redirect(ROLE_PORTAL_MAP[session.role] ?? '/')
  }

  const workspaces = session.role === 'super_admin' ? ADMIN_WORKSPACES : TL_WORKSPACES
  const greeting   = session.email ? `Signed in as ${session.email}` : null

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F4F7FB] px-4 py-12">
      {/* Logo */}
      <div className="mb-10">
        <Image src="/logo.png" alt="Robocode" width={160} height={70} className="h-auto w-32" />
      </div>

      {/* Heading */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">Choose your workspace</h1>
        {greeting && (
          <p className="mt-1.5 text-sm text-[#64748B]">{greeting}</p>
        )}
      </div>

      {/* Workspace cards */}
      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        {workspaces.map((ws) => (
          <Link
            key={ws.href}
            href={ws.href}
            className="group flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#FF8A1F] hover:shadow-[0_4px_24px_rgba(255,138,31,0.12)]"
          >
            {/* Icon */}
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F8FAFC] text-[#0B1F3A] transition-colors duration-200 group-hover:bg-[#FF8A1F]/10 group-hover:text-[#FF8A1F]">
              {ws.icon}
            </div>

            {/* Text */}
            <p className="mb-1 text-[15px] font-semibold text-[#0B1F3A]">{ws.title}</p>
            <p className="text-[13px] leading-relaxed text-[#64748B]">{ws.description}</p>

            {/* Arrow */}
            <div className="mt-4 flex items-center text-[13px] font-semibold text-[#FF8A1F] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Open workspace
              <svg viewBox="0 0 20 20" fill="currentColor" className="ml-1 h-4 w-4">
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* Sign out */}
      <form action={signOut} className="mt-8">
        <button
          type="submit"
          className="text-[13px] text-[#94A3B8] transition-colors hover:text-[#64748B]"
        >
          Sign out
        </button>
      </form>
    </div>
  )
}
