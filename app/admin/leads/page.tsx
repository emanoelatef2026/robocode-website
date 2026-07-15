import { createServiceClient }      from '@/lib/supabase/service'
import { requireAuth }              from '@/modules/rbac/guards'
import { listLeads, getLeadKPIs }   from '@/modules/leads/queries'
import { listBranches }             from '@/modules/branches/queries'
import SearchInput                  from '@/components/admin/SearchInput'
import AdminFilterSelect            from '@/components/admin/AdminFilterSelect'
import Pagination                   from '@/components/admin/Pagination'
import KpiCard                      from '@/components/admin/KpiCard'
import Link                         from 'next/link'
import type { LeadStatus }          from '@/modules/leads/types'
import { TopbarAction }             from '@/components/shared/layout/TopbarActionContext'

// ── Status display ─────────────────────────────────────────────────────────────

const STATUS_META: Record<LeadStatus, { label: string; color: string }> = {
  NEW:           { label: 'New',           color: 'bg-[#F1F5F9] text-[#475569]' },
  CONTACTED:     { label: 'Contacted',     color: 'bg-[#E0F2FE] text-[#0369A1]' },
  INTERESTED:    { label: 'Interested',    color: 'bg-[#F3E8FF] text-[#6B21A8]' },
  TRIAL_BOOKED:  { label: 'Trial Booked',  color: 'bg-[#FFFBEB] text-[#B45309]' },
  TRIAL_ATTENDED:{ label: 'Trial Attended',color: 'bg-[#FFF1E2] text-[#FF8A1F]' },
  FOLLOW_UP:     { label: 'Follow-up',     color: 'bg-[#F3E8FF] text-[#6B21A8]' },
  CONVERTED:     { label: 'Converted',     color: 'bg-[#E7F8EE] text-[#15803D]' },
  LOST:          { label: 'Lost',          color: 'bg-[#FEF2F2] text-[#B91C1C]' },
}

const LEAD_STATUSES: LeadStatus[] = [
  'NEW', 'CONTACTED', 'INTERESTED', 'TRIAL_BOOKED',
  'TRIAL_ATTENDED', 'FOLLOW_UP', 'CONVERTED', 'LOST',
]

const LEAD_SOURCES = [
  'website', 'facebook_ad', 'instagram_ad', 'whatsapp', 'referral', 'walk_in', 'other',
]


// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{
    page?:     string
    q?:        string
    branch?:   string
    status?:   string
    source?:   string
    assigned?: string
  }>
}

export default async function AdminLeadsPage({ searchParams }: Props) {
  const user   = await requireAuth()
  const params = await searchParams

  const isSuperAdmin  = user.globalRole === 'super_admin'
  const branchIds     = isSuperAdmin ? undefined : user.branchIds
  const page          = Number(params.page ?? 1)
  const search        = params.q ?? ''
  const branchFilter  = params.branch
  const statusFilter  = params.status as LeadStatus | undefined
  const sourceFilter  = params.source
  const assignedFilter = params.assigned

  const [result, kpis, branchesResult] = await Promise.all([
    listLeads({
      page,
      perPage: 25,
      search,
      branchIds: branchFilter ? [branchFilter] : branchIds,
      status:    statusFilter,
      source:    sourceFilter,
      assignedTo: assignedFilter,
    }),
    getLeadKPIs(branchIds ?? []),
    listBranches({ perPage: 100 }),
  ])

  // Funnel pipeline counts (quick visual from KPIs)
  const funnelStages = [
    { key: 'new_leads',      label: 'New',      count: kpis.new_leads,      color: 'bg-[#CBD5E1]' },
    { key: 'contacted',      label: 'Contacted', count: kpis.contacted,     color: 'bg-[#38BDF8]' },
    { key: 'trial_booked',   label: 'Trial',     count: kpis.trial_booked,  color: 'bg-[#F59E0B]' },
    { key: 'trial_attended', label: 'Attended',  count: kpis.trial_attended,color: 'bg-orange-400' },
    { key: 'converted',      label: 'Converted', count: kpis.converted,     color: 'bg-[#10B981]' },
  ]

  return (
    <div>
      <TopbarAction>
        <Link
          href="/admin/leads/new"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#FF8A1F] px-4 text-[13px] font-semibold text-white transition hover:bg-[#e87c18] active:scale-95"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Lead
        </Link>
      </TopbarAction>
      <div className="mb-6 flex justify-end">
        <Link
          href="/admin/leads/funnel"
          className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
          </svg>
          Funnel Analysis
        </Link>
      </div>

      {/* ── KPI row ────────────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Total Leads"      value={kpis.total}            barColor="#94A3B8" />
        <KpiCard label="Converted"        value={kpis.converted}        barColor="#10B981" sub={`${kpis.conversion_rate}% rate`} />
        <KpiCard label="Trial Booked"     value={kpis.trial_booked}     barColor="#F59E0B" />
        <KpiCard label="Follow-ups Today" value={kpis.follow_ups_today} barColor={kpis.follow_ups_today > 0 ? '#EF4444' : '#94A3B8'} alert={kpis.follow_ups_today > 0} />
        <KpiCard label="Conversion Rate"  value={`${kpis.conversion_rate}%`} barColor="#A855F7" />
      </div>

      {/* ── Funnel visual ──────────────────────────────────────────────── */}
      <div className="mb-5 ds-card p-4">
        <p className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">Pipeline Funnel</p>
        <div className="flex items-end gap-2">
          {funnelStages.map((stage, i) => {
            const maxCount = Math.max(...funnelStages.map(s => s.count), 1)
            const heightPct = Math.max(10, Math.round((stage.count / maxCount) * 100))
            return (
              <div key={stage.key} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-semibold text-[#0B1F3A]">{stage.count}</span>
                <div
                  className={`w-full rounded-t-md ${stage.color} opacity-80`}
                  style={{ height: `${heightPct * 0.6}px`, minHeight: '6px' }}
                />
                <span className="text-[10px] text-[#64748B]">{stage.label}</span>
                {i < funnelStages.length - 1 && funnelStages[i].count > 0 && (
                  <span className="hidden text-[9px] text-[#94A3B8] sm:block">
                    {Math.round((funnelStages[i + 1].count / funnelStages[i].count) * 100)}%
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Leads table ────────────────────────────────────────────────── */}
      <div className="ds-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#e7ebf1] px-4 py-3 bg-white">
          <SearchInput placeholder="Search leads…" />
          {isSuperAdmin && (
            <AdminFilterSelect
              param="branch"
              placeholder="All branches"
              options={branchesResult.data.map(b => ({ value: b.id, label: b.name }))}
            />
          )}
          <AdminFilterSelect
            param="status"
            placeholder="All statuses"
            options={LEAD_STATUSES.map(s => ({
              value: s,
              label: STATUS_META[s].label,
            }))}
          />
          <AdminFilterSelect
            param="source"
            placeholder="All sources"
            options={LEAD_SOURCES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))}
          />
        </div>

        {result.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <p className="text-sm font-medium text-[#0B1F3A]">No leads found</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              {search ? 'Try a different search term.' : 'Leads from the website and TL portal will appear here.'}
            </p>
          </div>
        ) : (
          <>
            {/* ── Mobile cards (< md) ── */}
            <div className="md:hidden divide-y divide-[#E2E8F0]">
              {result.data.map(lead => {
                const meta  = STATUS_META[lead.status]
                const isOld = lead.days_in_stage > 7 && lead.status !== 'CONVERTED' && lead.status !== 'LOST'
                const hasFU = lead.next_follow_up_at && new Date(lead.next_follow_up_at) < new Date()
                return (
                  <div key={lead.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/leads/${lead.id}`} className="block text-[15px] font-semibold text-[#0B1F3A] leading-tight">
                          {lead.child_name}
                          {lead.age && <span className="ml-1 text-[12px] font-normal text-[#94A3B8]">({lead.age}y)</span>}
                        </Link>
                        {lead.parent_name && (
                          <p className="mt-0.5 text-[12px] text-[#64748B]">{lead.parent_name}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className={`text-[11px] font-semibold ${isOld ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>
                          {lead.days_in_stage}d{isOld && ' ⚠'}
                        </span>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.color}`}>
                          {meta.label}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#64748B]">
                      {lead.phone && <a href={`tel:${lead.phone}`} className="font-medium text-[#0B1F3A]">{lead.phone}</a>}
                      <span className="capitalize">{lead.source.replace(/_/g, ' ')}</span>
                      {lead.branch_name && <span>{lead.branch_name}</span>}
                      <span>{lead.assigned_name ?? 'Unassigned'}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[#94A3B8]">
                        {new Date(lead.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        {hasFU && <span className="ml-1 text-[#EF4444]">● overdue</span>}
                      </span>
                      <Link href={`/admin/leads/${lead.id}`} className="rounded-lg bg-[#FF8A1F]/10 px-3 py-1.5 text-[12px] font-semibold text-[#FF8A1F] min-h-9 flex items-center">
                        View →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Desktop table (≥ md) ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="ds-table-head">
                  <tr>
                    <th>Child</th>
                    <th>Parent</th>
                    <th>Phone</th>
                    <th>Branch</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Owner</th>
                    <th>Days</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map(lead => {
                    const meta   = STATUS_META[lead.status]
                    const isOld  = lead.days_in_stage > 7 && lead.status !== 'CONVERTED' && lead.status !== 'LOST'
                    const hasFU  = lead.next_follow_up_at && new Date(lead.next_follow_up_at) < new Date()

                    return (
                      <tr key={lead.id} className="ds-table-row">
                        <td>
                          <Link href={`/admin/leads/${lead.id}`} className="font-semibold text-[#0B1F3A] hover:text-[#FF8A1F] transition-colors">
                            {lead.child_name}
                          </Link>
                          {lead.age && <span className="ml-1 text-[11px] text-[#94A3B8]">({lead.age}y)</span>}
                        </td>
                        <td className="text-[#64748B]">{lead.parent_name ?? '—'}</td>
                        <td className="text-[#64748B] font-mono text-[12px]">{lead.phone ?? '—'}</td>
                        <td className="text-[#64748B]">{lead.branch_name ?? '—'}</td>
                        <td className="text-[#64748B] capitalize">{lead.source.replace(/_/g, ' ')}</td>
                        <td>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold ${meta.color}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="text-[#64748B]">{lead.assigned_name ?? <span className="text-[#94A3B8]">Unassigned</span>}</td>
                        <td>
                          <span className={`text-[12px] font-semibold ${isOld ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>
                            {lead.days_in_stage}d{isOld && ' ⚠'}
                          </span>
                        </td>
                        <td className="text-[12px] text-[#94A3B8]">
                          {new Date(lead.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          {hasFU && <span className="ml-1 text-[#EF4444]">●</span>}
                        </td>
                        <td className="text-end">
                          <Link href={`/admin/leads/${lead.id}`} className="text-[12px] font-semibold text-[#FF8A1F] hover:text-[#e87c18] transition-colors">
                            View →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              total={result.total}
              perPage={result.perPage}
            />
          </>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 text-[11px] text-[#94A3B8]">
        <span><span className="text-[#EF4444]">⚠</span> Stage &gt;7 days</span>
        <span><span className="text-[#EF4444]">●</span> Follow-up overdue</span>
      </div>
    </div>
  )
}
