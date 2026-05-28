import { requirePortalRole } from '@/modules/rbac/guards'
import TLShell from '@/components/portal/team-leader/TLShell'

export default async function TeamLeaderLayout({ children }: { children: React.ReactNode }) {
  await requirePortalRole('team_leader')
  return <TLShell>{children}</TLShell>
}
