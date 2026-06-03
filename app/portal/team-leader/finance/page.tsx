import { requirePermission }        from '@/modules/rbac/guards'
import { listFinancialAccounts, getFinanceKPIs } from '@/modules/finance/queries'
import SearchInput                   from '@/components/admin/SearchInput'
import AdminFilterSelect             from '@/components/admin/AdminFilterSelect'
import Pagination                    from '@/components/admin/Pagination'
import FinanceTableClient            from '@/app/admin/finance/FinanceTableClient'
import Link                          from 'next/link'
import type { AccountStatus }        from '@/modules/finance/types'
import { STATUS_COLORS, STATUS_LABELS } from '@/modules/finance/types'

interface Props {
  searchParams: Promise<{
    page?:   string
    q?:      string
    status?: string
  }>
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

export default async function TLFinancePage({ searchParams }: Props) {
  const user   = await requirePermission('manage_financials')
  const params = await searchParams

  const page   = Number(params.page   ?? 1)
  const search = params.q             ?? ''
  const status = params.status as AccountStatus | undefined

  // Team leaders are scoped to their branches only
  const branchId = user.branchIds[0]
  if (!branchId) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-12 text-center">
        <p className="text-sm font-medium text-[#0B1F3A]">No branch assigned</p>
        <p className="mt-1 text-xs text-[#94A3B8]">Contact your administrator to assign a branch to your account.</p>
      </div>
    )
  }

  const [result, kpis] = await Promise.all([
    listFinancialAccounts({
      page, search,
      branch_id: branchId,
      status,
      perPage: 25,
    }),
    getFinanceKPIs(user.branchIds),
  ])

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p: Record<string, string> = { page: '1' }
    if (search) p.q      = search
    if (status) p.status = status as string
    Object.assign(p, overrides)
    Object.keys(p).forEach(k => (p as any)[k] === undefined && delete (p as any)[k])
    return '/portal/team-leader/finance?' + new URLSearchParams(p).toString()
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Finance</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">Branch collections — {result.total} accounts</p>
        </div>
        <Link
          href="/portal/team-leader/finance/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF8A1F] px-3 py-2 text-sm font-medium text-white hover:bg-[#e87c18]"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New
        </Link>
      </div>

      {/* KPI mini cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Collected This Month', value: `EGP ${fmt(kpis.collected_this_month)}`,  color: 'bg-emerald-400' },
          { label: 'Outstanding',          value: `EGP ${fmt(kpis.outstanding_total)}`,      color: 'bg-amber-400' },
          { label: 'Collection Rate',      value: `${kpis.collection_rate_pct}%`,            color: kpis.collection_rate_pct >= 80 ? 'bg-emerald-400' : 'bg-red-400' },
          { label: 'Overdue',              value: kpis.overdue_count,                        color: kpis.overdue_count > 0 ? 'bg-red-400' : 'bg-slate-300' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
            <div className={`mb-1.5 h-1 w-6 rounded-full ${k.color} opacity-80`} />
            <p className="text-xl font-bold text-[#0B1F3A]">{k.value}</p>
            <p className="text-[11px] text-[#64748B]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] px-4 py-3">
          <SearchInput placeholder="Search student…" />
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
            <Link href={buildUrl({ status: undefined })} className="text-xs text-[#FF8A1F]">Clear ×</Link>
          )}
        </div>

        {result.data.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">No accounts found</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              {search ? 'Try different search terms.' : 'Add financial accounts for branch students.'}
            </p>
          </div>
        ) : (
          <>
            <FinanceTableClient accounts={result.data} />
            <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={25} />
          </>
        )}
      </div>
    </div>
  )
}
