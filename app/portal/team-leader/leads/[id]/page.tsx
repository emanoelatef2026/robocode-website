import { notFound }                   from 'next/navigation'
import { requirePortalRole }          from '@/modules/rbac/guards'
import { getLead, getLeadTimeline, getBranchTeamMembers } from '@/modules/leads/queries'
import { createServiceClient }        from '@/lib/supabase/service'
import LeadDetailClient               from './LeadDetailClient'
import Link                           from 'next/link'

interface Props {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function LeadDetailPage({ params, searchParams }: Props) {
  const user       = await requirePortalRole('team_leader')
  const { id }     = await params
  const { tab }    = await searchParams

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
  const [{ data: groups }, { data: instructorRows }] = await Promise.all([
    branchId
      ? db.from('groups').select('id, name, type')
          .eq('branch_id', branchId).eq('status', 'active').is('deleted_at', null).order('name')
      : Promise.resolve({ data: [] as { id: string; name: string; type: string }[] }),
    branchId
      ? db.from('instructors')
          .select('id, users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))')
          .eq('branch_id', branchId)
          .eq('status', 'active')
          .is('deleted_at', null)
          .order('created_at')
      : Promise.resolve({ data: [] as any[] }),
  ])

  const instructors = (instructorRows ?? []).map((i: any) => {
    const prof = i.users?.profiles
    return {
      id:   i.id as string,
      name: prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || 'Unknown' : 'Unknown',
    }
  })

  return (
    <div>
      <div className="mb-6">
        <Link href="/portal/team-leader/leads" className="text-sm text-[#64748B] hover:text-[#0B1F3A]">
          ← Leads
        </Link>
      </div>

      <LeadDetailClient
        lead={lead}
        timeline={timeline}
        branches={branches ?? []}
        groups={(groups ?? []) as { id: string; name: string; type: string }[]}
        teamMembers={teamMembers}
        instructors={instructors}
        currentUserId={user.id}
        initialTab={tab}
      />
    </div>
  )
}
