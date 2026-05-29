import { getGroup } from '@/modules/groups/queries'
import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { notFound } from 'next/navigation'
import PageHeader from '@/components/admin/PageHeader'
import TLGroupEditForm from './TLGroupEditForm'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function TLGroupEditPage({ params }: Props) {
  await requirePortalRole('team_leader')
  await requirePermission('manage_groups')
  const { id } = await params
  const group = await getGroup(id)
  if (!group) notFound()

  return (
    <div>
      <PageHeader
        title="Edit Group"
        description={group.name}
        action={
          <Link
            href={`/portal/team-leader/groups/${id}`}
            className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] transition hover:border-[#CBD5E1]"
          >
            Back
          </Link>
        }
      />
      <TLGroupEditForm group={group} />
    </div>
  )
}
