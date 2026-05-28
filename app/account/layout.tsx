import { requireAuth } from '@/modules/rbac/guards'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireAuth()
  return <>{children}</>
}
