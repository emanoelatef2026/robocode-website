import { requirePermission }       from '@/modules/rbac/guards'
import { listFinancialAccounts, getFinanceKPIs } from '@/modules/finance/queries'
import { listBranches }            from '@/modules/branches/queries'
import { listGroups }              from '@/modules/groups/queries'
import AdminFilterSelect           from '@/components/admin/AdminFilterSelect'
import SearchInput                 from '@/components/admin/SearchInput'
import Pagination                  from '@/components/admin/Pagination'
import FinanceTableClient          from './FinanceTableClient'
import Link                        from 'next/link'
import type { AccountStatus }      from '@/modules/finance/types'

interface Props {
  searchParams: Promise<{
    page?:   string
    q?:      string
    branch?: string
    group?:  string
    status?: string
  }>
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

export default async function AdminFinancePage({ searchParams }: Props) {
  const user   = await requirePermission('manage_financials')
  const params = await searchParams

  const page     = Number(params.page   ?? 1)
  const search   = params.q             ?? ''
  const branchId = params.branch
  const groupId  = params.group
  const status   = params.status as AccountStatus | undefined

  const isSA = user.globalRole === 'super_admin'
  const branchFilter = isSA
    ? branchId
    : (branchId && user.branchIds.includes(branchId)) ? branchId : user.branchIds[0]

  const [result, kpis, branchesRes, groupsRes] = await Promise.all([
    listFinancialAccounts({ page, search, branch_id: branchFilter, group_id: groupId, status, perPage: 30 }),
    getFinanceKPIs(isSA ? undefined : user.branchIds),
    listBranches({ perPage: 100 }),
    listGroups({ perPage: 200 }),
  ])

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p: Record<string, string> = { page: '1' }
    if (search)   p.q      = search
    if (branchId) p.branch = branchId
    if (groupId)  p.group  = groupId
    if (status)   p.status = status as string
    Object.assign(p, overrides)
    Object.keys(p).forEach(k => (p as any)[k] === undefined && delete (p as any)[k])
    return '/admin/finance?' + new URLSearchParams(p).toString()
  }

  const kpiCards = [
    { label: 'Expected This Month',  value: `EGP ${fmt(kpis.expected_this_month)}`,  color: 'bg-violet-400' },
    { label: 'Collected This Month', value: `EGP ${fmt(kpis.collected_this_month)}`, color: 'bg-emerald-400' },
    { label: 'Outstanding',          value: `EGP ${fmt(kpis.outstanding_total)}`,    color: kpis.outstanding_total > 0 ? 'bg-amber-400' : 'bg-emerald-400' },
    { label: 'Collection Rate',      value: `${kpis.collection_rate_pct}%`,          color: kpis.collection_rate_pct >= 80 ? 'bg-emerald-400' : kpis.collection_rate_pct >= 50 ? 'bg-amber-400' : 'bg-red-400' },
    { label: 'Overdue Students',     value: kpis.overdue_count,                      color: kpis.overdue_count > 0 ? 'bg-red-400' : 'bg-slate-300' },
    { label: 'Due This Week',        value: kpis.due_this_week,                      color: kpis.due_this_week > 0 ? 'bg-amber-400' : 'bg-slate-300' },
    { label: 'Due This Month',       value: kpis.due_this_month,                     color: 'bg-blue-400' },
    { label: 'Students Paid',        value: `${kpis.paid_students} / ${kpis.total_students}`, color: 'bg-teal-400' },
  ]

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Finance Center</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">Collections command center — {result.total} accounts</p>
        </div>
        <Link
          href="/admin/finance/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#e87c18]"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Account
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpiCards.map(k => (
          <div key={k.label} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <div className={`mb-2 h-1.5 w-7 rounded-full ${k.color} opacity-80`} />
            <p className="text-2xl font-bold text-[#0B1F3A]">{k.value}</p>
            <p className="mt-0.5 text-xs text-[#64748B]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Finance Table */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search student, code…" />
          {isSA && (
            <AdminFilterSelect
              param="branch" placeholder="All branches"
              options={(branchesRes.data as any[]).map((b: any) => ({ value: b.id, label: b.name }))}
            />
          )}
          <AdminFilterSelect
            param="group" placeholder="All groups"
            options={(groupsRes.data as any[]).map((g: any) => ({ value: g.id, label: g.name }))}
          />
          <AdminFilterSelect
            param="status" placeholder="All statuses"
            options={[
              { value: 'OVERDUE',  label: 'Overdue' },
              { value: 'DUE_SOON', label: 'Due Soon' },
              { value: 'CURRENT',  label: 'Current' },
              { value: 'PAID',     label: 'Paid' },
            ]}
          />
          {status && (
            <Link href={buildUrl({ status: undefined })} className="text-xs text-[#FF8A1F] hover:underline">
              Clear ×
            </Link>
          )}
        </div>

        {result.data.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-medium text-[#0B1F3A]">No financial accounts found</p>
            <p className="mt-1 text-sm text-[#94A3B8]">
              {search ? 'Try a different search.' : 'Create financial accounts for students to begin tracking collections.'}
            </p>
          </div>
        ) : (
          <>
            <FinanceTableClient accounts={result.data} exportUrl={`/api/finance/export${branchFilter ? `?branch=${branchFilter}` : ''}${status ? `${branchFilter ? '&' : '?'}status=${status}` : ''}`} />
            <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={30} />
          </>
        )}
      </div>

    </div>
  )
}
