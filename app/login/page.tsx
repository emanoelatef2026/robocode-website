import { redirect } from 'next/navigation'
import { getSessionCookie } from '@/lib/lms-session'
import { ROLE_PORTAL_MAP } from '@/types/enums'
import LoginClient from './LoginClient'

const WORKSPACE_PICKER_ROLES = new Set(['super_admin', 'team_leader'])

export default async function LoginPage() {
  const session = await getSessionCookie()
  if (session) {
    if (WORKSPACE_PICKER_ROLES.has(session.role)) redirect('/select-workspace')
    redirect(ROLE_PORTAL_MAP[session.role] ?? '/')
  }
  return <LoginClient />
}
