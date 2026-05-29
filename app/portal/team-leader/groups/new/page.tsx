import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import PageHeader from '@/components/admin/PageHeader'
import TLNewGroupForm from './TLNewGroupForm'
import Link from 'next/link'

export default async function TLNewGroupPage() {
  const user = await requirePortalRole('team_leader')
  await requirePermission('manage_groups')
  const branchId = user.branchIds[0]

  if (!branchId) {
    return (
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No branch assigned. Contact a super admin.
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="New Group"
        description="Create a new student group for your branch"
        action={
          <Link
            href="/portal/team-leader/groups"
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Back
          </Link>
        }
      />
      <TLNewGroupForm branchId={branchId} />
    </div>
  )
}
