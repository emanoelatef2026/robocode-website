import { notFound }                   from 'next/navigation'
import { requirePortalRole }          from '@/modules/rbac/guards'
import { getLead, getLeadTimeline, getBranchTeamMembers } from '@/modules/leads/queries'
import { createServiceClient }        from '@/lib/supabase/service'
import LeadDetailClient               from './LeadDetailClient'
import Link                           from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function LeadDetailPage({ params }: Props) {
  const user    = await requirePortalRole('team_leader')
  const { id }  = await params

  const [lead, timeline, teamMembers] = await Promise.all([
    getLead(id),
    getLeadTimeline(id),
    getBranchTeamMembers(user.branchIds),
  ])

  if (!lead) notFound()

  const db = createServiceClient()
  const { data: branches } = await db
    .from('branches').select('id, name')
    .in('id', user.branchIds).order('name')

  const branchId = lead.branch_id ?? user.branchIds[0] ?? null
  const { data: groups } = branchId
    ? await db.from('groups').select('id, name, type')
        .eq('branch_id', branchId).eq('status', 'active').is('deleted_at', null).order('name')
    : { data: [] }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/portal/team-leader/leads" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Leads
        </Link>
        <span className="text-[#CBD5E1]">/</span>
        <h1 className="text-xl font-semibold text-[#0B1F3A]">{lead.child_name}</h1>
      </div>

      <LeadDetailClient
        lead={lead}
        timeline={timeline}
        branches={branches ?? []}
        groups={(groups ?? []) as { id: string; name: string; type: string }[]}
        teamMembers={teamMembers}
        currentUserId={user.id}
      />
    </div>
  )
}
