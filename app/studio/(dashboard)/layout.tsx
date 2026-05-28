import { redirect } from 'next/navigation'
import { getSessionCookie } from '@/lib/lms-session'
import { ROLE_PORTAL_MAP } from '@/types/enums'
import StudioShell from "@/components/studio/StudioShell"

export const dynamic = 'force-dynamic'

const STUDIO_ROLES = new Set(['super_admin', 'team_leader'])

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionCookie()

  if (!session) {
    redirect('/studio/login')
  }

  if (!STUDIO_ROLES.has(session.role)) {
    redirect(`${ROLE_PORTAL_MAP[session.role]}?error=forbidden`)
  }

  return <StudioShell>{children}</StudioShell>
}
