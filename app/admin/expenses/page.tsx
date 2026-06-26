import { requirePermission, requireAuth } from '@/modules/rbac/guards'
import { createServiceClient }            from '@/lib/supabase/service'
import {
  getGroupPnLRows, getBranchPnLRows, getAcademyPnL,
  listExpenses, listRecurringExpenses,
} from '@/modules/finance/queries'
import FinancialManagementClient from './FinancialManagementClient'

// ── Helpers ────────────────────────────────────────────────────────────────────

async function loadMeta(branchIds: string[] | null) {
  const db = createServiceClient()

  const [branchRes, groupRes] = await Promise.all([
    db.from('branches')
      .select('id, name')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name')
      .then(r => branchIds?.length ? db.from('branches').select('id, name').in('id', branchIds).eq('is_active', true).is('deleted_at', null).order('name') : r),
    db.from('groups')
      .select('id, name, branch_id, status, branches!groups_branch_id_fkey(name)')
      .is('deleted_at', null)
      .order('name')
      .then(r => branchIds?.length ? db.from('groups').select('id, name, branch_id, status, branches!groups_branch_id_fkey(name)').in('branch_id', branchIds).is('deleted_at', null).order('name') : r),
  ])

  type BranchMeta = { id: string; name: string }
  type GroupMeta  = { id: string; name: string; branch_id: string; status: string; branches: { name: string } | null }
  const branches = ((branchRes.data ?? []) as unknown as BranchMeta[]).map(b => ({
    id: b.id, name: b.name,
  }))
  const groups = ((groupRes.data ?? []) as unknown as GroupMeta[]).map(g => ({
    id: g.id, name: g.name,
    branch_id: g.branch_id, status: g.status,
    branch_name: g.branches?.name ?? '',
  }))

  return { branches, groups }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FinancialManagementPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?:        string
    branch_id?:  string
    date_from?:  string
    date_to?:    string
    archived?:   string
  }>
}) {
  const user = await requireAuth()
  await requirePermission('manage_financials')

  const params         = await searchParams
  const tab            = params.tab       ?? 'groups'
  const branchIdFilter = params.branch_id ?? undefined
  const dateFrom       = params.date_from ?? undefined
  const dateTo         = params.date_to   ?? undefined
  const includeArchived = params.archived === '1'

  const isSuperAdmin = user.globalRole === 'super_admin'
  const branchScope: string[] | null = isSuperAdmin
    ? null
    : user.branchIds

  // For data loading: combine role-based scope + optional branch filter
  const effectiveBranchIds: string[] | undefined = branchScope
    ? (branchIdFilter ? branchScope.filter(id => id === branchIdFilter) : branchScope)
    : (branchIdFilter ? [branchIdFilter] : undefined)

  const [groupRows, branchRows, academyPnL, expenses, recurring, { branches, groups }] =
    await Promise.all([
      getGroupPnLRows(effectiveBranchIds, { dateFrom, dateTo }),
      getBranchPnLRows(effectiveBranchIds, { dateFrom, dateTo }),
      getAcademyPnL(effectiveBranchIds ?? undefined, { dateFrom, dateTo }),
      listExpenses(
        effectiveBranchIds?.length
          ? { branch_ids: effectiveBranchIds, date_from: dateFrom, date_to: dateTo }
          : { date_from: dateFrom, date_to: dateTo }
      ),
      listRecurringExpenses(),
      loadMeta(branchScope),
    ])

  return (
    <div className="space-y-4">
      {/* Client shell: all tabs, filters, and interactive management */}
      <FinancialManagementClient
        groupRows={groupRows}
        branchRows={branchRows}
        academyPnL={academyPnL}
        expenses={expenses}
        recurring={recurring}
        branches={branches}
        groups={groups}
        activeTab={tab}
        currentBranchId={branchIdFilter ?? ''}
        currentDateFrom={dateFrom ?? ''}
        currentDateTo={dateTo ?? ''}
        includeArchived={includeArchived}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  )
}
