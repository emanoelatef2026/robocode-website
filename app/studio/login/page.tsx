import { redirect } from 'next/navigation'
import { getSessionCookie } from '@/lib/lms-session'
import StudioLoginClient from './StudioLoginClient'

const STUDIO_ROLES = new Set(['super_admin', 'team_leader'])

export default async function StudioLoginPage() {
  const session = await getSessionCookie()
  if (session && STUDIO_ROLES.has(session.role)) redirect('/select-workspace')
  return <StudioLoginClient />
}
