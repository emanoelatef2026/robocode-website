import { requirePortalRole } from '@/modules/rbac/guards'
import {
  listLeads, getLeadKPIs, getLeadsBySource,
  getOwnershipKPIs, getAgingLeads, getFollowUpsDue,
  getWorkloadDistribution, getAvgDaysToConvert,
} from '@/modules/leads/queries'
import { assignLeadToMeFormAction } from '@/modules/leads/actions'
import { LEAD_STATUSES, LEAD_SOURCES } from '@/modules/leads/schemas'
import { AGING_THRESHOLDS } from '@/modules/leads/types'
import PageHeader   from '@/components/admin/PageHeader'
import EmptyState   from '@/components/admin/EmptyState'
import Pagination   from '@/components/admin/Pagination'
import SearchInput  from '@/components/admin/SearchInput'
import FilterSelect from '@/components/admin/FilterSelect'
import Link         from 'next/link'

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

// ── Shared constants ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  NEW:            'bg-blue-100  text-blue-700',
  CONTACTED:      'bg-yellow-100 text-yellow-700',
  INTERESTED:     'bg-purple-100 text-purple-700',
  TRIAL_BOOKED:   'bg-indigo-100 text-indigo-700',
  TRIAL_ATTENDED: 'bg-cyan-100  text-cyan-700',
  FOLLOW_UP:      'bg-orange-100 text-orange-700',
  CONVERTED:      'bg-green-100 text-green-700',
  LOST:           'bg-red-100  text-red-700',
}

const SOURCE_LABELS: Record<string, string> = {
  website: 'Website', facebook_ad: 'Facebook Ad', instagram_ad: 'Instagram Ad',
  whatsapp: 'WhatsApp', referral: 'Referral', walk_in: 'Walk-In', other: 'Other',
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-700'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function DaysBadge({ days, status }: { days: number; status: string }) {
  const threshold = AGING_THRESHOLDS[status as keyof typeof AGING_THRESHOLDS]
  const isAging   = threshold != null && days > threshold
  const cls = isAging
    ? 'bg-red-100 text-red-700 font-semibold'
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

  const [result, kpis, ownerKpis, bySource, agingLeads, followUpsDue, workload, conversionSpeed] =
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
    ])

  const statusOptions = LEAD_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))
  const sourceOptions = LEAD_SOURCES.map(s => ({ value: s, label: SOURCE_LABELS[s] ?? s }))
  const hasFilters    = !!(status || source || search || assignedTo || unassignedOnly)

  return (
    <div className="space-y-6">

      <PageHeader
        title="Leads"
        description={`${kpis.total} total · ${ownerKpis.my_leads} mine · ${ownerKpis.unassigned} unassigned`}
        action={
          <Link
            href="/portal/team-leader/leads/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e87c18]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Lead
          </Link>
        }
      />

      {/* ── Pipeline KPIs ── */}
      <div>
        <div className="mb-2"><SectionTitle title="Pipeline" /></div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-8">
          <KPICard label="New"            value={kpis.new_leads}      color="text-blue-600"   href="?status=NEW" />
          <KPICard label="Contacted"      value={kpis.contacted}      color="text-yellow-600" href="?status=CONTACTED" />
          <KPICard label="Trial Booked"   value={kpis.trial_booked}   color="text-indigo-600" href="?status=TRIAL_BOOKED" />
          <KPICard label="Trial Attended" value={kpis.trial_attended} color="text-cyan-600"   href="?status=TRIAL_ATTENDED" />
          <KPICard label="Converted"      value={kpis.converted}      color="text-green-600"  href="?status=CONVERTED" />
          <KPICard
            label="Conv. Rate"
            value={`${kpis.conversion_rate}%`}
            sub={`${kpis.converted} / ${kpis.total}`}
            color={kpis.conversion_rate >= 30 ? 'text-green-600' : kpis.conversion_rate >= 15 ? 'text-yellow-600' : 'text-red-600'}
          />
          <KPICard
            label="Avg Days to Convert"
            value={conversionSpeed.overall != null ? `${conversionSpeed.overall}d` : '—'}
            sub={conversionSpeed.by_source[0] ? `Fastest: ${conversionSpeed.by_source[0].source.replace('_', ' ')} (${conversionSpeed.by_source[0].avg_days}d)` : undefined}
            color={
              conversionSpeed.overall == null ? 'text-[#94A3B8]' :
              conversionSpeed.overall <= 14 ? 'text-green-600' :
              conversionSpeed.overall <= 30 ? 'text-yellow-600' : 'text-red-600'
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
            color={ownerKpis.overdue_follow_ups > 0 ? 'text-red-600' : 'text-[#0B1F3A]'}
            alert={ownerKpis.overdue_follow_ups > 0}
          />
          <KPICard
            label="Converted This Month"
            value={ownerKpis.converted_this_month}
            color="text-green-600"
          />
          <KPICard
            label="My Conv. Rate"
            value={`${ownerKpis.my_conversion_rate}%`}
            color={ownerKpis.my_conversion_rate >= 30 ? 'text-green-600' : ownerKpis.my_conversion_rate >= 15 ? 'text-yellow-600' : 'text-[#0B1F3A]'}
          />
        </div>
      </div>

      {/* ── Aging Alerts + Follow-Up Center ── */}
      {(agingLeads.length > 0 || followUpsDue.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">

          {/* Aging Alerts */}
          {agingLeads.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-red-500">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
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
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
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
                    <span className={`shrink-0 text-[11px] font-medium ${l.days_overdue > 0 ? 'text-red-600' : 'text-orange-600'}`}>
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
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
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
                        <span className="font-semibold text-green-600">{o.conversion_rate}%</span>
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
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
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
                          {SOURCE_LABELS[s.source] ?? s.source}
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
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
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
            {/* ── Mobile cards (< md) ── */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {result.data.map(lead => {
                const followUpDate    = lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null
                const followUpOverdue = followUpDate && followUpDate < new Date()
                return (
                  <div key={lead.id} className="px-4 py-4">
                    {/* Row 1: name + status + days */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/portal/team-leader/leads/${lead.id}`}
                          className="block text-[15px] font-semibold text-[#0B1F3A] leading-tight"
                        >
                          {lead.child_name}
                        </Link>
                        {lead.parent_name && (
                          <p className="mt-0.5 text-[12px] text-[#64748B]">{lead.parent_name}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <DaysBadge days={lead.days_in_stage} status={lead.status} />
                        <StatusBadge status={lead.status} />
                      </div>
                    </div>

                    {/* Row 2: phone · source · owner */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#64748B]">
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="font-medium text-[#0B1F3A]">
                          {lead.phone}
                        </a>
                      )}
                      <span>{SOURCE_LABELS[lead.source] ?? lead.source}</span>
                      {lead.assigned_name ? (
                        <span className="text-[#64748B]">{lead.assigned_name}</span>
                      ) : (
                        <form action={assignLeadToMeFormAction} className="inline">
                          <input type="hidden" name="lead_id" value={lead.id} />
                          <button type="submit" className="font-medium text-[#FF8A1F]">
                            Assign to me
                          </button>
                        </form>
                      )}
                    </div>

                    {/* Row 3: follow-up + manage */}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {followUpDate ? (
                        <span className={`text-[11px] font-medium ${followUpOverdue ? 'text-red-600' : 'text-[#64748B]'}`}>
                          Follow-up: {followUpDate.toLocaleDateString('en-GB')}
                          {followUpOverdue && ' ⚠'}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#94A3B8]">No follow-up set</span>
                      )}
                      <Link
                        href={`/portal/team-leader/leads/${lead.id}`}
                        className="rounded-lg bg-[#FF8A1F]/10 px-3 py-1.5 text-[12px] font-semibold text-[#FF8A1F] min-h-9 flex items-center"
                      >
                        Manage →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Desktop table (≥ md) ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Child</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Owner</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">In Stage</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Follow-Up</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map(lead => {
                    const followUpDate    = lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null
                    const followUpOverdue = followUpDate && followUpDate < new Date()
                    return (
                      <tr key={lead.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                          {lead.child_name}
                          {lead.parent_name && (
                            <p className="text-[11px] font-normal text-[#94A3B8]">{lead.parent_name}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#64748B]">{lead.phone ?? '—'}</td>
                        <td className="px-4 py-3">
                          {lead.assigned_name ? (
                            <span className="text-sm text-[#0B1F3A]">{lead.assigned_name}</span>
                          ) : (
                            <form action={assignLeadToMeFormAction}>
                              <input type="hidden" name="lead_id" value={lead.id} />
                              <button type="submit" className="text-[11px] font-medium text-[#FF8A1F] hover:underline">
                                Assign to me
                              </button>
                            </form>
                          )}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                        <td className="px-4 py-3">
                          <DaysBadge days={lead.days_in_stage} status={lead.status} />
                        </td>
                        <td className="px-4 py-3 text-[#64748B]">{SOURCE_LABELS[lead.source] ?? lead.source}</td>
                        <td className="px-4 py-3">
                          {followUpDate ? (
                            <span className={`text-xs font-medium ${followUpOverdue ? 'text-red-600' : 'text-[#64748B]'}`}>
                              {followUpDate.toLocaleDateString('en-GB')}
                              {followUpOverdue && ' ⚠'}
                            </span>
                          ) : <span className="text-[#94A3B8]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-[#94A3B8]">
                          {new Date(lead.created_at).toLocaleDateString('en-GB')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/portal/team-leader/leads/${lead.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">
                            Manage
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

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
