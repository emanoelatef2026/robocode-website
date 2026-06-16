import { requirePortalRole }       from '@/modules/rbac/guards'
import { getPayrollRunWithItems }  from '@/modules/payroll/queries'
import { createServiceClient }     from '@/lib/supabase/service'
import PayrollWorkspaceClient      from './PayrollWorkspaceClient'

// ── Branch loader ─────────────────────────────────────────────────────────────

async function fetchBranches(branchIds: string[]) {
  if (branchIds.length <= 1) return []
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
  searchParams: Promise<{ month?: string; year?: string; branch?: string }>
}

export default async function InstructorPayrollPage({ searchParams }: Props) {
  const user   = await requirePortalRole('team_leader')
  const params = await searchParams

  if (!user.branchIds.length) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-[15px] font-semibold text-[#0B1F3A]">No branch assigned</p>
          <p className="mt-1 text-[13px] text-[#64748B]">Contact a super admin to assign you to a branch.</p>
        </div>
      </div>
    )
  }

  const now      = new Date()
  const month    = Math.max(1, Math.min(12, parseInt(params.month ?? String(now.getMonth() + 1))))
  const year     = Math.max(2020, parseInt(params.year ?? String(now.getFullYear())))
  const branchId = (params.branch && user.branchIds.includes(params.branch))
    ? params.branch
    : user.branchIds[0]

  const [initialPayroll, branches] = await Promise.all([
    getPayrollRunWithItems(month, year, branchId),
    fetchBranches(user.branchIds),
  ])

  return (
    <PayrollWorkspaceClient
      initialPayroll={initialPayroll}
      branchIds={user.branchIds}
      branches={branches}
      initialMonth={month}
      initialYear={year}
      initialBranchId={branchId}
    />
  )
}
