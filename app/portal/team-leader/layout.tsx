import { requirePortalRole } from '@/modules/rbac/guards'

export default async function TeamLeaderLayout({ children }: { children: React.ReactNode }) {
  await requirePortalRole('team_leader')
  return <>{children}</>
}
