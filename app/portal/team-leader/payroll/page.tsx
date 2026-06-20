import { requirePortalRole }              from '@/modules/rbac/guards'
import { createServiceClient }            from '@/lib/supabase/service'
import {
  getLiveInstructorFinance,
  getLiveStaffFinance,
  getStaffFinanceSummary,
}                                          from '@/modules/staff-finance/queries'
import FinanceClient                       from './FinanceClient'

// ── Branch loader ─────────────────────────────────────────────────────────────

async function fetchAllBranches(): Promise<{ id: string; name: string }[]> {
  const db = createServiceClient()
  const { data } = await db
    .from('branches')
    .select('id, name')
    .order('name')
  return (data ?? []) as { id: string; name: string }[]
}

async function fetchBranchesByIds(ids: string[]): Promise<{ id: string; name: string }[]> {
  if (!ids.length) return []
  const db = createServiceClient()
  const { data } = await db
    .from('branches')
    .select('id, name')
    .in('id', ids)
    .order('name')
  return (data ?? []) as { id: string; name: string }[]
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function defaultDateFrom(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function defaultDateTo(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{
    tab?:       string
    date_from?: string
    date_to?:   string
    branch?:    string
  }>
}

export default async function PayrollPage({ searchParams }: Props) {
  const user   = await requirePortalRole('team_leader')
  const params = await searchParams

  const isSuperAdmin = user.globalRole === 'super_admin' || user.branchIds.length === 0

  const allBranches  = isSuperAdmin
    ? await fetchAllBranches()
    : await fetchBranchesByIds(user.branchIds)

  const availableBranchIds = allBranches.map(b => b.id)

  if (!availableBranchIds.length) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-[15px] font-semibold text-[#0B1F3A]">No branches found</p>
          <p className="mt-1 text-[13px] text-[#64748B]">
            Contact a super admin to set up branches.
          </p>
        </div>
      </div>
    )
  }

  const dateFrom = params.date_from || defaultDateFrom()
  const dateTo   = params.date_to   || defaultDateTo()

  const branchParam    = params.branch
  const isSingleBranch = branchParam && branchParam !== 'all' && availableBranchIds.includes(branchParam)
  const branchId       = isSingleBranch ? branchParam : 'all'
  const queryBranchIds = isSingleBranch ? [branchParam] : availableBranchIds

  const [instructors, staff, summary] = await Promise.all([
    getLiveInstructorFinance(queryBranchIds, dateFrom, dateTo),
    getLiveStaffFinance(queryBranchIds, dateFrom, dateTo),
    getStaffFinanceSummary(queryBranchIds, dateFrom, dateTo),
  ])

  return (
    <FinanceClient
      instructors={instructors}
      staff={staff}
      summary={summary}
      branches={allBranches}
      branchIds={availableBranchIds}
      initialBranchId={branchId}
      initialDateFrom={dateFrom}
      initialDateTo={dateTo}
      initialTab={params.tab ?? 'instructors'}
      isSuperAdmin={isSuperAdmin}
    />
  )
}
