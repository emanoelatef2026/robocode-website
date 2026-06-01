import { createServiceClient }      from '@/lib/supabase/service'
import { requireAuth }              from '@/modules/rbac/guards'
import { listLeads, getLeadKPIs }   from '@/modules/leads/queries'
import { listBranches }             from '@/modules/branches/queries'
import PageHeader                   from '@/components/admin/PageHeader'
import SearchInput                  from '@/components/admin/SearchInput'
import AdminFilterSelect            from '@/components/admin/AdminFilterSelect'
import Pagination                   from '@/components/admin/Pagination'
import Link                         from 'next/link'
import type { LeadStatus }          from '@/modules/leads/types'

// ── Status display ─────────────────────────────────────────────────────────────

const STATUS_META: Record<LeadStatus, { label: string; color: string }> = {
  NEW:           { label: 'New',           color: 'bg-slate-100 text-slate-700' },
  CONTACTED:     { label: 'Contacted',     color: 'bg-blue-100 text-blue-700' },
  INTERESTED:    { label: 'Interested',    color: 'bg-violet-100 text-violet-700' },
  TRIAL_BOOKED:  { label: 'Trial Booked',  color: 'bg-amber-100 text-amber-700' },
  TRIAL_ATTENDED:{ label: 'Trial Attended',color: 'bg-orange-100 text-orange-700' },
  FOLLOW_UP:     { label: 'Follow-up',     color: 'bg-purple-100 text-purple-700' },
  CONVERTED:     { label: 'Converted',     color: 'bg-emerald-100 text-emerald-700' },
  LOST:          { label: 'Lost',          color: 'bg-red-100 text-red-700' },
}

const LEAD_STATUSES: LeadStatus[] = [
  'NEW', 'CONTACTED', 'INTERESTED', 'TRIAL_BOOKED',
  'TRIAL_ATTENDED', 'FOLLOW_UP', 'CONVERTED', 'LOST',
]

const LEAD_SOURCES = [
  'website', 'facebook_ad', 'instagram_ad', 'whatsapp', 'referral', 'walk_in', 'other',
]

// ── KPI cards ─────────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, color = 'bg-slate-300',
}: {
  label: string; value: number | string; sub?: string; color?: string
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <div className={`mb-2.5 h-1.5 w-7 rounded-full ${color} opacity-80`} />
      <p className="text-2xl font-bold text-[#0B1F3A]">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-[#64748B]">{label}</p>
      {sub && <p className="mt-1 text-[11px] text-[#94A3B8]">{sub}</p>}
    </div>
  )
}

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
    { key: 'new_leads',      label: 'New',      count: kpis.new_leads,      color: 'bg-slate-300' },
    { key: 'contacted',      label: 'Contacted', count: kpis.contacted,     color: 'bg-blue-400' },
    { key: 'trial_booked',   label: 'Trial',     count: kpis.trial_booked,  color: 'bg-amber-400' },
    { key: 'trial_attended', label: 'Attended',  count: kpis.trial_attended,color: 'bg-orange-400' },
    { key: 'converted',      label: 'Converted', count: kpis.converted,     color: 'bg-emerald-500' },
  ]

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Leads Pipeline</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">{result.total} lead{result.total !== 1 ? 's' : ''} total</p>
        </div>
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
        <KPICard label="Total Leads"      value={kpis.total}            color="bg-slate-300" />
        <KPICard label="Converted"        value={kpis.converted}        color="bg-emerald-400"
          sub={`${kpis.conversion_rate}% rate`} />
        <KPICard label="Trial Booked"     value={kpis.trial_booked}     color="bg-amber-400" />
        <KPICard label="Follow-ups Today" value={kpis.follow_ups_today} color={kpis.follow_ups_today > 0 ? 'bg-red-400' : 'bg-slate-300'} />
        <KPICard label="Conversion Rate"  value={`${kpis.conversion_rate}%`} color="bg-violet-400" />
      </div>

      {/* ── Funnel visual ──────────────────────────────────────────────── */}
      <div className="mb-5 rounded-xl border border-[#E2E8F0] bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Pipeline Funnel</p>
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
      <div className="rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] px-4 py-3">
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Child</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Parent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Owner</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Days</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B]">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map(lead => {
                    const meta   = STATUS_META[lead.status]
                    const isOld  = lead.days_in_stage > 7 && lead.status !== 'CONVERTED' && lead.status !== 'LOST'
                    const hasFU  = lead.next_follow_up_at && new Date(lead.next_follow_up_at) < new Date()

                    return (
                      <tr key={lead.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3">
                          <Link href={`/admin/leads/${lead.id}`} className="font-medium text-[#0B1F3A] hover:text-[#FF8A1F]">
                            {lead.child_name}
                          </Link>
                          {lead.age && <span className="ml-1 text-[11px] text-[#94A3B8]">({lead.age}y)</span>}
                        </td>
                        <td className="px-4 py-3 text-[#64748B]">{lead.parent_name ?? '—'}</td>
                        <td className="px-4 py-3 text-[#64748B] font-mono text-xs">{lead.phone ?? '—'}</td>
                        <td className="px-4 py-3 text-[#64748B]">{lead.branch_name ?? '—'}</td>
                        <td className="px-4 py-3 text-[#64748B] capitalize">{lead.source.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.color}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#64748B]">{lead.assigned_name ?? <span className="text-[#94A3B8]">Unassigned</span>}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${isOld ? 'text-red-600' : 'text-[#64748B]'}`}>
                            {lead.days_in_stage}d
                            {isOld && ' ⚠'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#94A3B8]">
                          {new Date(lead.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          {hasFU && <span className="ml-1 text-red-500">●</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/admin/leads/${lead.id}`} className="text-xs font-medium text-[#FF8A1F] hover:underline">
                            View
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
        <span><span className="text-red-500">⚠</span> Stage &gt;7 days</span>
        <span><span className="text-red-500">●</span> Follow-up overdue</span>
      </div>
    </div>
  )
}
