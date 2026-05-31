import { requirePortalRole }  from '@/modules/rbac/guards'
import { createServiceClient } from '@/lib/supabase/service'
import NewLeadForm              from './NewLeadForm'
import Link                     from 'next/link'

export default async function NewLeadPage() {
  const user = await requirePortalRole('team_leader')
  const db   = createServiceClient()

  const { data: branches } = await db
    .from('branches')
    .select('id, name')
    .in('id', user.branchIds)
    .order('name')

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/portal/team-leader/leads"
          className="text-sm text-[#64748B] hover:text-[#0B1F3A]"
        >
          ← Leads
        </Link>
        <span className="text-[#CBD5E1]">/</span>
        <h1 className="text-xl font-semibold text-[#0B1F3A]">Add Lead</h1>
      </div>

      <div className="max-w-2xl">
        <NewLeadForm branches={branches ?? []} />
      </div>
    </div>
  )
}
