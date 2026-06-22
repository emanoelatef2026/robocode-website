import { requirePermission } from '@/modules/rbac/guards'
import { requireAuth }       from '@/modules/rbac/guards'
import { getAcademyPnL, getBranchPnLRows, getGroupPnLRows } from '@/modules/finance/queries'
import Link from 'next/link'
import RevenueFilterBar from './RevenueFilterBar'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `EGP ${new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)}`
}

function fmtK(n: number) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}EGP ${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}EGP ${(abs / 1_000).toFixed(0)}K`
  return fmt(n)
}

function KPI({
  label, value, sub, color = 'bg-slate-300', negative = false,
}: {
  label: string; value: string; sub?: string; color?: string; negative?: boolean
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <div className={`mb-2.5 h-1.5 w-8 rounded-full ${color} opacity-80`} />
      <p className={`text-xl font-bold ${negative ? 'text-red-600' : 'text-[#0B1F3A]'}`}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-[#64748B]">{label}</p>
      {sub && <p className="mt-1 text-[11px] text-[#94A3B8]">{sub}</p>}
    </div>
  )
}

function ProfitBadge({ value }: { value: number }) {
  const positive = value >= 0
  return (
    <span className={`font-semibold ${positive ? 'text-emerald-700' : 'text-red-600'}`}>
      {value < 0 ? '−' : '+'}{fmt(Math.abs(value))}
    </span>
  )
}

// ── Tab nav ────────────────────────────────────────────────────────────────────

function TabNav({ active, dateFrom, dateTo, branchId }: { active: string; dateFrom: string; dateTo: string; branchId: string }) {
  const tabs = [
    { key: 'academy',  label: 'Academy'  },
    { key: 'branches', label: 'Branches' },
    { key: 'groups',   label: 'Groups'   },
  ]
  function buildHref(key: string) {
    const p = new URLSearchParams({ tab: key })
    if (dateFrom) p.set('date_from', dateFrom)
    if (dateTo)   p.set('date_to', dateTo)
    if (branchId) p.set('branch_id', branchId)
    return `/admin/revenue?${p.toString()}`
  }
  return (
    <div className="flex gap-1 rounded-lg bg-[#F1F5F9] p-1">
      {tabs.map(t => (
        <Link
          key={t.key}
          href={buildHref(t.key)}
          className={`flex-1 rounded-md px-4 py-2 text-center text-xs font-semibold transition ${
            active === t.key
              ? 'bg-white text-[#0B1F3A] shadow-sm'
              : 'text-[#64748B] hover:text-[#0B1F3A]'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}

// ── Academy tab ────────────────────────────────────────────────────────────────

async function AcademyTab({ branchFilter, dateFrom, dateTo }: { branchFilter: string[] | null; dateFrom?: string; dateTo?: string }) {
  const data = await getAcademyPnL(branchFilter ?? undefined, { dateFrom, dateTo })
  const maxBar = Math.max(...data.monthly_trend.map(m => Math.max(m.collected_revenue, m.total_expenses)), 1)

  return (
    <div className="space-y-5">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KPI label="Expected Revenue"  value={fmtK(data.expected_revenue)}  color="bg-slate-400" />
        <KPI label="Collected Revenue" value={fmtK(data.collected_revenue)} color="bg-emerald-400" />
        <KPI label="Outstanding"       value={fmtK(data.outstanding)}       color="bg-amber-400" />
        <KPI label="Total Expenses"    value={fmtK(data.total_expenses)}    color="bg-red-400" />
        <KPI
          label="Expected Profit"
          value={fmtK(data.expected_profit)}
          color={data.expected_profit >= 0 ? 'bg-emerald-400' : 'bg-red-400'}
          negative={data.expected_profit < 0}
        />
        <KPI
          label="Actual Profit"
          value={fmtK(data.actual_profit)}
          color={data.actual_profit >= 0 ? 'bg-emerald-400' : 'bg-red-400'}
          negative={data.actual_profit < 0}
          sub={`${data.collection_rate}% collected`}
        />
      </div>

      {/* Expense breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">Instructor Earned</p>
          <p className="mt-1 text-base font-bold text-violet-600">{fmt(data.instructor_earned)}</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">Group Expenses</p>
          <p className="mt-1 text-base font-bold text-indigo-600">{fmt(data.group_expenses + data.group_recurring_expenses)}</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">Branch Expenses</p>
          <p className="mt-1 text-base font-bold text-blue-600">{fmt(data.branch_expenses + data.branch_recurring_expenses)}</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[#94A3B8]">Academy Expenses</p>
          <p className="mt-1 text-base font-bold text-cyan-600">{fmt(data.academy_expenses + data.academy_recurring_expenses)}</p>
        </div>
      </div>

      {/* Monthly trend chart */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">Monthly Trend — Last 6 Months</p>
          <div className="flex items-center gap-4 text-[11px] text-[#64748B]">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-400" /> Collected</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-400" /> Expenses</span>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-end gap-3">
            {data.monthly_trend.map(m => {
              const cH = maxBar > 0 ? Math.round((m.collected_revenue / maxBar) * 110) : 2
              const eH = maxBar > 0 ? Math.round((m.total_expenses   / maxBar) * 110) : 2
              const profit = m.actual_profit
              return (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                  <p className={`text-[10px] font-semibold ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {profit >= 0 ? '+' : '−'}{Math.abs(profit) > 0 ? fmtK(Math.abs(profit)).replace('EGP ', '') : '0'}
                  </p>
                  <div className="flex w-full items-end gap-0.5">
                    <div className="flex-1 rounded-t-sm bg-emerald-400" style={{ height: `${Math.max(cH, 2)}px` }} />
                    <div className="flex-1 rounded-t-sm bg-red-400"     style={{ height: `${Math.max(eH, 2)}px` }} />
                  </div>
                  <p className="text-[10px] text-[#94A3B8]">{m.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Branches tab ───────────────────────────────────────────────────────────────

async function BranchesTab({ branchFilter, dateFrom, dateTo }: { branchFilter: string[] | null; dateFrom?: string; dateTo?: string }) {
  const rows = await getBranchPnLRows(branchFilter ?? undefined, { dateFrom, dateTo })

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white flex items-center justify-center py-14">
        <p className="text-sm text-[#94A3B8]">No branch data available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(b => {
          const isProfit = b.actual_profit >= 0
          const rate = b.collection_rate
          return (
            <div key={b.branch_id} className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#0B1F3A]">{b.branch_name}</p>
                  <p className="text-[11px] text-[#94A3B8]">{b.student_count} students · {b.group_count} groups</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  rate >= 80 ? 'bg-emerald-50 text-emerald-700' :
                  rate >= 50 ? 'bg-amber-50 text-amber-700' :
                               'bg-red-50 text-red-600'
                }`}>
                  {rate}% collected
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <p className="text-[#94A3B8]">Expected</p>
                  <p className="font-semibold text-[#0B1F3A]">{fmt(b.expected_revenue)}</p>
                </div>
                <div>
                  <p className="text-[#94A3B8]">Collected</p>
                  <p className="font-semibold text-emerald-700">{fmt(b.collected_revenue)}</p>
                </div>
                <div>
                  <p className="text-[#94A3B8]">Outstanding</p>
                  <p className="font-semibold text-amber-600">{fmt(b.outstanding)}</p>
                </div>
                <div>
                  <p className="text-[#94A3B8]">Total Expenses</p>
                  <p className="font-semibold text-red-600">{fmt(b.total_expenses)}</p>
                </div>
              </div>

              {b.total_expenses > 0 && (
                <div className="rounded-lg bg-[#F8FAFC] px-3 py-2 text-[11px] space-y-1">
                  {b.instructor_earned > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Instr. Earned</span>
                      <span className="font-medium text-violet-700">{fmt(b.instructor_earned)}</span>
                    </div>
                  )}
                  {b.branch_expenses + b.branch_recurring_expenses > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Branch</span>
                      <span className="font-medium text-blue-700">{fmt(b.branch_expenses + b.branch_recurring_expenses)}</span>
                    </div>
                  )}
                  {b.group_expenses + b.group_recurring_expenses > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Groups</span>
                      <span className="font-medium text-indigo-700">{fmt(b.group_expenses + b.group_recurring_expenses)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-[#E2E8F0] pt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <p className="text-[#94A3B8]">Expected Profit</p>
                  <p className={`font-bold ${b.expected_profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {b.expected_profit < 0 ? '−' : '+'}{fmt(Math.abs(b.expected_profit))}
                  </p>
                </div>
                <div>
                  <p className="text-[#94A3B8]">Actual Profit</p>
                  <p className={`font-bold ${isProfit ? 'text-emerald-700' : 'text-red-600'}`}>
                    {b.actual_profit < 0 ? '−' : '+'}{fmt(Math.abs(b.actual_profit))}
                  </p>
                </div>
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                <div
                  className={`h-full rounded-full ${rate >= 80 ? 'bg-emerald-400' : rate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(rate, 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Full table */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
        <div className="border-b border-[#E2E8F0] px-5 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">Branch P&L Summary</p>
        </div>
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              {['Branch','Students','Groups','Expected Rev','Collected','Outstanding','Expenses','Exp. Profit','Act. Profit','Rate'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#64748B] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(b => (
              <tr key={b.branch_id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                <td className="px-4 py-3 font-semibold text-[#0B1F3A] whitespace-nowrap">{b.branch_name}</td>
                <td className="px-4 py-3 text-center text-[#64748B]">{b.student_count}</td>
                <td className="px-4 py-3 text-center text-[#64748B]">{b.group_count}</td>
                <td className="px-4 py-3 text-right text-[#0B1F3A]">{fmt(b.expected_revenue)}</td>
                <td className="px-4 py-3 text-right font-medium text-emerald-700">{fmt(b.collected_revenue)}</td>
                <td className="px-4 py-3 text-right text-amber-600">{fmt(b.outstanding)}</td>
                <td className="px-4 py-3 text-right text-red-600">{fmt(b.total_expenses)}</td>
                <td className="px-4 py-3 text-right"><ProfitBadge value={b.expected_profit} /></td>
                <td className="px-4 py-3 text-right"><ProfitBadge value={b.actual_profit} /></td>
                <td className="px-4 py-3">
                  <span className={`font-semibold ${b.collection_rate >= 80 ? 'text-emerald-700' : b.collection_rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {b.collection_rate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Groups tab ─────────────────────────────────────────────────────────────────

async function GroupsTab({ branchFilter, dateFrom, dateTo }: { branchFilter: string[] | null; dateFrom?: string; dateTo?: string }) {
  const rows = await getGroupPnLRows(branchFilter ?? undefined, { dateFrom, dateTo })

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white flex items-center justify-center py-14">
        <p className="text-sm text-[#94A3B8]">No active groups found.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-x-auto">
      <div className="border-b border-[#E2E8F0] px-5 py-3 flex items-center justify-between">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">Group P&L</p>
        <p className="text-[11px] text-[#94A3B8]">{rows.length} groups</p>
      </div>
      <table className="w-full text-sm min-w-[1000px]">
        <thead>
          <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
            {['Group','Branch','Course','Instructor','Students','Expected Rev','Collected','Outstanding','Instr. Cost','Other Exp.','Exp. Profit','Act. Profit','Rate'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#64748B] whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(g => (
            <tr key={g.group_id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
              <td className="px-4 py-3 font-semibold text-[#0B1F3A] whitespace-nowrap">
                <Link href={`/admin/groups/${g.group_id}`} className="hover:text-[#FF8A1F]">{g.group_name}</Link>
              </td>
              <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">{g.branch_name}</td>
              <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">{g.course_name ?? '—'}</td>
              <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">{g.instructor_name ?? '—'}</td>
              <td className="px-4 py-3 text-center text-[#64748B]">{g.student_count}</td>
              <td className="px-4 py-3 text-right text-[#0B1F3A]">{fmt(g.expected_revenue)}</td>
              <td className="px-4 py-3 text-right font-medium text-emerald-700">{fmt(g.collected_revenue)}</td>
              <td className="px-4 py-3 text-right text-amber-600">{fmt(g.outstanding)}</td>
              <td className="px-4 py-3 text-right text-violet-700">{fmt(g.instructor_earned)}</td>
              <td className="px-4 py-3 text-right text-indigo-700">{fmt(g.other_expenses)}</td>
              <td className="px-4 py-3 text-right"><ProfitBadge value={g.expected_profit} /></td>
              <td className="px-4 py-3 text-right"><ProfitBadge value={g.actual_profit} /></td>
              <td className="px-4 py-3">
                <span className={`font-semibold ${g.collection_rate >= 80 ? 'text-emerald-700' : g.collection_rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  {g.collection_rate}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FinancialPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; branch_id?: string; date_from?: string; date_to?: string }>
}) {
  const user = await requireAuth()
  await requirePermission('manage_financials')

  const params   = await searchParams
  const tab      = params.tab       ?? 'academy'
  const branchId = params.branch_id ?? ''
  const dateFrom = params.date_from ?? ''
  const dateTo   = params.date_to   ?? ''

  const isSuperAdmin = user.globalRole === 'super_admin'
  const roleScope    = isSuperAdmin ? null : user.branchIds
  const branchFilter = roleScope
    ? (branchId ? roleScope.filter(id => id === branchId) : roleScope)
    : (branchId ? [branchId] : null)

  const dateOpts = {
    dateFrom: dateFrom || undefined,
    dateTo:   dateTo   || undefined,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Financial Performance</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">Revenue, expenses and profitability at every level</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/expenses"
            className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] hover:border-[#CBD5E1] transition"
          >
            Manage Expenses →
          </Link>
          <Link
            href="/admin/finance"
            className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] hover:border-[#CBD5E1] transition"
          >
            Finance Center →
          </Link>
        </div>
      </div>

      {/* Date + branch filter */}
      <RevenueFilterBar
        activeTab={tab}
        currentDateFrom={dateFrom}
        currentDateTo={dateTo}
        currentBranchId={branchId}
      />

      {/* Tabs */}
      <TabNav active={tab} dateFrom={dateFrom} dateTo={dateTo} branchId={branchId} />

      {/* Tab content */}
      {tab === 'academy'  && <AcademyTab  branchFilter={branchFilter} {...dateOpts} />}
      {tab === 'branches' && <BranchesTab branchFilter={branchFilter} {...dateOpts} />}
      {tab === 'groups'   && <GroupsTab   branchFilter={branchFilter} {...dateOpts} />}
      {tab !== 'academy' && tab !== 'branches' && tab !== 'groups' && (
        <AcademyTab branchFilter={branchFilter} {...dateOpts} />
      )}
    </div>
  )
}
