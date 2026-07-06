import { requirePortalRole } from '@/modules/rbac/guards'
import {
  listLeads, getLeadKPIs, getLeadsBySource,
  getOwnershipKPIs, getAgingLeads, getFollowUpsDue,
  getWorkloadDistribution, getAvgDaysToConvert,
} from '@/modules/leads/queries'
import { LEAD_STATUSES, LEAD_SOURCES } from '@/modules/leads/schemas'
import { AGING_THRESHOLDS, LEAD_STATUS_COLORS, LEAD_SOURCE_LABELS } from '@/modules/leads/types'
import { createServiceClient } from '@/lib/supabase/service'
import EmptyState    from '@/components/admin/EmptyState'
import Pagination    from '@/components/admin/Pagination'
import SearchInput   from '@/components/admin/SearchInput'
import FilterSelect  from '@/components/admin/FilterSelect'
import Link          from 'next/link'
import { TopbarAction } from '@/components/admin/TopbarActionContext'
import LeadsTableClient from './_components/LeadsTableClient'

interface Props {
  searchParams: Promise<{
    page?:        string
    q?:           string
    status?:      string
    source?:      string
    assigned_to?: string
    unassigned?:  string
    date_from?:   string
    date_to?:     string
  }>
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${LEAD_STATUS_COLORS[status as keyof typeof LEAD_STATUS_COLORS] ?? 'bg-[#F1F5F9] text-[#334155]'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function DaysBadge({ days, status }: { days: number; status: string }) {
  const threshold = AGING_THRESHOLDS[status as keyof typeof AGING_THRESHOLDS]
  const isAging   = threshold != null && days > threshold
  const cls = isAging
    ? 'bg-[#FEE2E2] text-[#DC2626] font-semibold'
    : days > 0
      ? 'bg-[#F8FAFC] text-[#64748B]'
      : 'text-[#94A3B8]'
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] ${cls}`}>
      {days}d
    </span>
  )
}

function KPICard({
  label, value, sub, color = 'text-[#0B1F3A]', href, alert = false,
}: {
  label: string; value: string | number; sub?: string
  color?: string; href?: string; alert?: boolean
}) {
  const cls = [
    'min-w-0 rounded-xl border px-2 py-1.5 md:p-3 transition',
    alert ? 'border-orange-200 bg-orange-50' : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]',
  ].join(' ')
  const inner = (
    <>
      <p className="truncate text-[8px] font-semibold uppercase tracking-wide text-[#94A3B8] leading-tight md:text-[10px]">{label}</p>
      <p className={`mt-0.5 truncate text-[13px] font-bold leading-none md:text-xl ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-[8px] text-[#94A3B8] leading-tight md:text-[10px]">{sub}</p>}
    </>
  )
  return href
    ? <Link href={href} className={cls}>{inner}</Link>
    : <div className={cls}>{inner}</div>
}

function SectionTitle({ title }: { title: string }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">{title}</p>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TLLeadsPage({ searchParams }: Props) {
  const user   = await requirePortalRole('team_leader')
  const params = await searchParams

  const page           = Number(params.page ?? 1)
  const search         = params.q           ?? ''
  const status         = params.status
  const source         = params.source
  const assignedTo     = params.assigned_to
  const unassignedOnly = params.unassigned === '1'
  const dateFrom       = params.date_from
  const dateTo         = params.date_to

  const db = createServiceClient()

  const [result, kpis, ownerKpis, bySource, agingLeads, followUpsDue, workload, conversionSpeed, branchRows, instructorRows] =
    await Promise.all([
      listLeads({
        page, perPage: 25, search, branchIds: user.branchIds,
        status, source, assignedTo, unassignedOnly, dateFrom, dateTo,
      }),
      getLeadKPIs(user.branchIds),
      getOwnershipKPIs(user.branchIds, user.id),
      getLeadsBySource(user.branchIds),
      getAgingLeads(user.branchIds),
      getFollowUpsDue(user.branchIds),
      getWorkloadDistribution(user.branchIds),
      getAvgDaysToConvert(user.branchIds),
      db.from('branches').select('id, name').in('id', user.branchIds).order('name'),
      db.from('instructors')
        .select('id, branch_id, users!instructors_user_id_fkey(profiles!profiles_user_id_fkey(first_name, last_name))')
        .in('branch_id', user.branchIds)
        .eq('status', 'active')
        .is('deleted_at', null),
    ])

  const branches    = (branchRows.data ?? []) as { id: string; name: string }[]
  const instructors = (instructorRows.data ?? []).map((i: any) => {
    const prof = i.users?.profiles
    return {
      id:   i.id as string,
      name: prof ? [prof.first_name, prof.last_name].filter(Boolean).join(' ') || 'Unknown' : 'Unknown',
    }
  })

  const statusOptions = LEAD_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))
  const sourceOptions = LEAD_SOURCES.map(s => ({ value: s, label: LEAD_SOURCE_LABELS[s] ?? s }))
  const hasFilters    = !!(status || source || search || assignedTo || unassignedOnly)

  return (
    <div className="space-y-6">

      <TopbarAction>
        <Link
          href="/portal/team-leader/leads/new"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 text-[13px] font-semibold text-white transition hover:bg-[#e87c18] active:scale-95"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Lead
        </Link>
      </TopbarAction>

      {/* ── Pipeline KPIs ── */}
      <div>
        <div className="mb-2"><SectionTitle title="Pipeline" /></div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-8">
          <KPICard label="New"            value={kpis.new_leads}      color="text-[#2563EB]"   href="?status=NEW" />
          <KPICard label="Contacted"      value={kpis.contacted}      color="text-yellow-600" href="?status=CONTACTED" />
          <KPICard label="Trial Booked"   value={kpis.trial_booked}   color="text-indigo-600" href="?status=TRIAL_BOOKED" />
          <KPICard label="Trial Attended" value={kpis.trial_attended} color="text-cyan-600"   href="?status=TRIAL_ATTENDED" />
          <KPICard label="Converted"      value={kpis.converted}      color="text-[#10B981]"  href="?status=CONVERTED" />
          <KPICard
            label="Conv. Rate"
            value={`${kpis.conversion_rate}%`}
            sub={`${kpis.converted} / ${kpis.total}`}
            color={kpis.conversion_rate >= 30 ? 'text-[#10B981]' : kpis.conversion_rate >= 15 ? 'text-yellow-600' : 'text-[#EF4444]'}
          />
          <KPICard
            label="Avg Days to Convert"
            value={conversionSpeed.overall != null ? `${conversionSpeed.overall}d` : '—'}
            sub={conversionSpeed.by_source[0] ? `Fastest: ${conversionSpeed.by_source[0].source.replace('_', ' ')} (${conversionSpeed.by_source[0].avg_days}d)` : undefined}
            color={
              conversionSpeed.overall == null ? 'text-[#94A3B8]' :
              conversionSpeed.overall <= 14 ? 'text-[#10B981]' :
              conversionSpeed.overall <= 30 ? 'text-yellow-600' : 'text-[#EF4444]'
            }
          />
          <KPICard
            label="Follow-Ups Today"
            value={kpis.follow_ups_today}
            color={kpis.follow_ups_today > 0 ? 'text-orange-600' : 'text-[#0B1F3A]'}
            alert={kpis.follow_ups_today > 0}
          />
        </div>
      </div>

      {/* ── Ownership KPIs ── */}
      <div>
        <div className="mb-2"><SectionTitle title="Your Ownership" /></div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
          <KPICard
            label="My Leads"
            value={ownerKpis.my_leads}
            href={`?assigned_to=${user.id}`}
          />
          <KPICard
            label="Unassigned"
            value={ownerKpis.unassigned}
            color={ownerKpis.unassigned > 0 ? 'text-orange-600' : 'text-[#0B1F3A]'}
            alert={ownerKpis.unassigned > 0}
            href="?unassigned=1"
          />
          <KPICard
            label="Overdue Follow-Ups"
            value={ownerKpis.overdue_follow_ups}
            color={ownerKpis.overdue_follow_ups > 0 ? 'text-[#EF4444]' : 'text-[#0B1F3A]'}
            alert={ownerKpis.overdue_follow_ups > 0}
          />
          <KPICard
            label="Converted This Month"
            value={ownerKpis.converted_this_month}
            color="text-[#10B981]"
          />
          <KPICard
            label="My Conv. Rate"
            value={`${ownerKpis.my_conversion_rate}%`}
            color={ownerKpis.my_conversion_rate >= 30 ? 'text-[#10B981]' : ownerKpis.my_conversion_rate >= 15 ? 'text-yellow-600' : 'text-[#0B1F3A]'}
          />
        </div>
      </div>

      {/* ── Aging Alerts + Follow-Up Center ── */}
      {(agingLeads.length > 0 || followUpsDue.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">

          {/* Aging Alerts */}
          {agingLeads.length > 0 && (
            <div className="rounded-xl border border-[#FECACA] bg-[#FEE2E2] p-5">
              <div className="mb-3 flex items-center gap-2">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#EF4444]">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#DC2626]">
                  Stage Alerts — {agingLeads.length} stuck lead{agingLeads.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="space-y-2">
                {agingLeads.map(l => (
                  <div key={l.id} className="flex items-center gap-3 rounded-lg bg-white/70 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/portal/team-leader/leads/${l.id}`} className="text-sm font-medium text-[#0B1F3A] hover:underline">
                        {l.child_name}
                      </Link>
                      <p className="text-[11px] text-[#64748B]">
                        {l.assigned_name ?? 'Unassigned'}
                        {l.phone ? ` · ${l.phone}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={l.status} />
                    <span className="shrink-0 rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[11px] font-semibold text-[#DC2626]">
                      {l.days_in_stage}d
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Follow-Up Center */}
          {followUpsDue.length > 0 && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-orange-500">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                  Follow-Ups Due — {followUpsDue.length}
                </p>
              </div>
              <div className="space-y-2">
                {followUpsDue.map(l => (
                  <div key={l.id} className="flex items-center gap-3 rounded-lg bg-white/70 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/portal/team-leader/leads/${l.id}`} className="text-sm font-medium text-[#0B1F3A] hover:underline">
                        {l.child_name}
                      </Link>
                      <p className="text-[11px] text-[#64748B]">
                        {l.assigned_name ?? 'Unassigned'}
                        {l.phone ? ` · ${l.phone}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[11px] font-medium ${l.days_overdue > 0 ? 'text-[#EF4444]' : 'text-orange-600'}`}>
                      {l.days_overdue > 0 ? `${l.days_overdue}d overdue` : 'Due today'}
                    </span>
                    <StatusBadge status={l.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Workload Distribution + Source Analytics ── */}
      {workload.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">

          {/* Workload Distribution */}
          <div className="ds-card p-5">
            <SectionTitle title="Workload Distribution" />
            <div className="mt-3 space-y-2.5">
              {workload.map(o => {
                const pct = o.total > 0 ? Math.round((o.active / o.total) * 100) : 0
                return (
                  <div key={o.user_id ?? 'unassigned'}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[#0B1F3A] truncate">{o.name}</span>
                      <div className="flex items-center gap-3 shrink-0 text-[11px] text-[#64748B]">
                        <span>{o.active} active</span>
                        <span className="font-semibold text-[#10B981]">{o.conversion_rate}%</span>
                        <span className="font-bold text-[#0B1F3A]">{o.total}</span>
                      </div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
                      <div
                        className="h-full rounded-full bg-[#FF8A1F]"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Source Analytics */}
          {bySource.length > 0 && (
            <div className="ds-card p-5">
              <SectionTitle title="Leads by Source" />
              <div className="mt-3 space-y-2.5">
                {bySource.map(s => {
                  const pct = kpis.total > 0 ? Math.round((s.count / kpis.total) * 100) : 0
                  return (
                    <div key={s.source}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <Link
                          href={`?source=${s.source}`}
                          className="text-sm font-medium text-[#0B1F3A] hover:underline"
                        >
                          {LEAD_SOURCE_LABELS[s.source as keyof typeof LEAD_SOURCE_LABELS] ?? s.source}
                        </Link>
                        <span className="shrink-0 text-[11px] font-bold text-[#0B1F3A]">{s.count} <span className="font-normal text-[#94A3B8]">({pct}%)</span></span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
                        <div className="h-full rounded-full bg-[#19C6F4]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Lead Table ── */}
      <div className="ds-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] px-3 py-2.5 sm:px-4 sm:py-3">
          <SearchInput placeholder="Search by name, phone, email…" />
          <FilterSelect name="status"  options={statusOptions} placeholder="All Statuses" value={status ?? ''} />
          <FilterSelect name="source"  options={sourceOptions} placeholder="All Sources"  value={source ?? ''} />
          {unassignedOnly && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
              Unassigned only
              <Link href="/portal/team-leader/leads" className="ml-1 text-orange-400 hover:text-orange-700">×</Link>
            </span>
          )}
          {hasFilters && (
            <Link href="/portal/team-leader/leads" className="text-xs text-[#64748B] hover:underline">
              Clear filters
            </Link>
          )}
        </div>

        {result.data.length === 0 ? (
          <EmptyState
            title="No leads found"
            description={hasFilters ? 'Try different filters.' : 'Leads from the website will appear here automatically.'}
          />
        ) : (
          <>
            <LeadsTableClient
              leads={result.data}
              instructors={instructors}
              branches={branches}
              basePath="/portal/team-leader/leads"
            />

            {result.totalPages > 1 && (
              <div className="border-t border-[#E2E8F0] px-4 py-3">
                <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
