import { requirePortalRole }             from '@/modules/rbac/guards'
import { getStaffPayrollProfiles }       from '@/modules/payroll/staff-queries'
import { createServiceClient }           from '@/lib/supabase/service'
import StaffClient                        from './StaffClient'

// ── Branch + branch list ──────────────────────────────────────────────────────

async function fetchBranches(branchIds: string[]) {
  if (!branchIds.length) return []
  const db = createServiceClient()
  const { data } = await db
    .from('branches')
    .select('id, name')
    .in('id', branchIds)
    .order('name')
  return (data ?? []) as { id: string; name: string }[]
}

// ── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{ branch?: string }>
}

export default async function StaffPayrollDirectoryPage({ searchParams }: Props) {
  const user   = await requirePortalRole('team_leader')
  const params = await searchParams

  if (!user.branchIds.length) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[13px] text-[#64748B]">No branch assigned.</p>
      </div>
    )
  }

  const branchId = (params.branch && user.branchIds.includes(params.branch))
    ? params.branch
    : user.branchIds[0]

  const [profiles, branches] = await Promise.all([
    getStaffPayrollProfiles(branchId),
    fetchBranches(user.branchIds),
  ])

  return (
    <StaffClient
      initialProfiles={profiles}
      branchIds={user.branchIds}
      branches={branches}
      initialBranchId={branchId}
    />
  )
}
