/**
 * Lead → Student Conversion Funnel
 *
 * Visualises the complete admissions pipeline from first contact to active student.
 * All data comes from the leads table.
 */

import { createServiceClient }  from '@/lib/supabase/service'
import { requireAuth }          from '@/modules/rbac/guards'
import { listBranches }         from '@/modules/branches/queries'
import AdminFilterSelect        from '@/components/admin/AdminFilterSelect'
import Link                     from 'next/link'
import type { LeadStatus }      from '@/modules/leads/types'

// ── Funnel stages in order ─────────────────────────────────────────────────────

interface FunnelStage {
  status:       LeadStatus | 'ALL'
  label:        string
  description:  string
  color:        string
  textColor:    string
  bgColor:      string
}

const FUNNEL_STAGES: FunnelStage[] = [
  { status: 'ALL',            label: 'All Leads',       description: 'Total leads created',             color: 'bg-slate-400',   textColor: 'text-slate-700',   bgColor: 'bg-slate-50'   },
  { status: 'NEW',            label: 'New',             description: 'Not yet contacted',               color: 'bg-slate-400',   textColor: 'text-slate-700',   bgColor: 'bg-slate-50'   },
  { status: 'CONTACTED',      label: 'Contacted',       description: 'First contact made',              color: 'bg-blue-400',    textColor: 'text-blue-700',    bgColor: 'bg-blue-50'    },
  { status: 'INTERESTED',     label: 'Interested',      description: 'Expressed interest',              color: 'bg-violet-400',  textColor: 'text-violet-700',  bgColor: 'bg-violet-50'  },
  { status: 'TRIAL_BOOKED',   label: 'Trial Booked',    description: 'Trial session scheduled',         color: 'bg-amber-400',   textColor: 'text-amber-700',   bgColor: 'bg-amber-50'   },
  { status: 'TRIAL_ATTENDED', label: 'Trial Attended',  description: 'Attended trial session',          color: 'bg-orange-400',  textColor: 'text-orange-700',  bgColor: 'bg-orange-50'  },
  { status: 'FOLLOW_UP',      label: 'Follow-up',       description: 'Follow-up in progress',           color: 'bg-purple-400',  textColor: 'text-purple-700',  bgColor: 'bg-purple-50'  },
  { status: 'CONVERTED',      label: 'Converted',       description: 'Enrolled as student',             color: 'bg-emerald-500', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50' },
]

// ── Funnel data ────────────────────────────────────────────────────────────────

interface FunnelData {
  stages:           Array<FunnelStage & { count: number; conversionFromPrev: number | null; dropOffRate: number | null }>
  lost:             number
  totalLeads:       number
  overallConversion: number
  avgDaysToConvert:  number | null
  // By source
  bySource:         Array<{ source: string; total: number; converted: number; rate: number }>
  // By assignee
  byAssignee:       Array<{ name: string; total: number; converted: number; rate: number }>
  // Top drop-off stage
  worstDropOff:     string | null
}

async function getFunnelData(branchIds?: string[], dateFrom?: string, dateTo?: string): Promise<FunnelData> {
  const db = createServiceClient()

  let q = db.from('leads').select('status, source, assigned_to, created_at, stage_entered_at')
  if (branchIds?.length) q = q.in('branch_id', branchIds)
  if (dateFrom)          q = q.gte('created_at', `${dateFrom}T00:00:00`)
  if (dateTo)            q = q.lte('created_at', `${dateTo}T23:59:59`)

  const { data: leads } = await q
  const rows = (leads ?? []) as any[]

  const totalLeads = rows.length
  const converted  = rows.filter(r => r.status === 'CONVERTED').length
  const lost       = rows.filter(r => r.status === 'LOST').length
  const overallConversion = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0

  // Stage counts (cumulative reach)
  const statusCounts: Partial<Record<LeadStatus | 'ALL', number>> = { ALL: totalLeads }
  const statuses: LeadStatus[] = ['NEW','CONTACTED','INTERESTED','TRIAL_BOOKED','TRIAL_ATTENDED','FOLLOW_UP','CONVERTED']
  for (const status of statuses) {
    // Count leads that have EVER been in this stage or beyond
    // Simplified: count leads currently in each status
    statusCounts[status] = rows.filter(r => r.status === status).length
  }

  // Build funnel stages with conversion rates
  const stages = FUNNEL_STAGES.map((stage, idx) => {
    const count = statusCounts[stage.status] ?? 0
    const prevCount = idx > 0 ? (statusCounts[FUNNEL_STAGES[idx - 1].status] ?? 0) : totalLeads
    const conversionFromPrev = prevCount > 0 && idx > 0 ? Math.round((count / prevCount) * 100) : null
    const dropOffRate = prevCount > 0 && idx > 0 ? Math.round(((prevCount - count) / prevCount) * 100) : null
    return { ...stage, count, conversionFromPrev, dropOffRate }
  })

  // Avg days to convert
  const convertedRows = rows.filter(r => r.status === 'CONVERTED' && r.stage_entered_at && r.created_at)
  const avgDaysToConvert = convertedRows.length > 0
    ? Math.round(convertedRows.reduce((sum, r) => {
        return sum + (new Date(r.stage_entered_at).getTime() - new Date(r.created_at).getTime()) / 86400000
      }, 0) / convertedRows.length)
    : null

  // By source
  const sourceMap: Record<string, { total: number; converted: number }> = {}
  for (const r of rows) {
    if (!sourceMap[r.source]) sourceMap[r.source] = { total: 0, converted: 0 }
    sourceMap[r.source].total++
    if (r.status === 'CONVERTED') sourceMap[r.source].converted++
  }
  const bySource = Object.entries(sourceMap)
    .map(([source, d]) => ({ source, ...d, rate: d.total > 0 ? Math.round((d.converted / d.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  // By assignee (resolve names separately)
  const assigneeMap: Record<string, { total: number; converted: number }> = {}
  for (const r of rows) {
    const key = r.assigned_to ?? '__unassigned__'
    if (!assigneeMap[key]) assigneeMap[key] = { total: 0, converted: 0 }
    assigneeMap[key].total++
    if (r.status === 'CONVERTED') assigneeMap[key].converted++
  }
  const assigneeIds = Object.keys(assigneeMap).filter(k => k !== '__unassigned__')
  const nameMap = new Map<string, string>()
  if (assigneeIds.length > 0) {
    const { data: profs } = await db.from('profiles').select('user_id, first_name, last_name').in('user_id', assigneeIds)
    for (const p of profs ?? []) {
      const name = [(p as any).first_name, (p as any).last_name].filter(Boolean).join(' ') || 'Unknown'
      nameMap.set((p as any).user_id, name)
    }
  }
  const byAssignee = Object.entries(assigneeMap)
    .map(([id, d]) => ({
      name:      id === '__unassigned__' ? 'Unassigned' : (nameMap.get(id) ?? 'Unknown'),
      ...d,
      rate:      d.total > 0 ? Math.round((d.converted / d.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // Worst drop-off (excluding first stage)
  const worstDropOff = stages.slice(1).reduce<{ label: string; rate: number } | null>((worst, s) => {
    if (s.dropOffRate === null) return worst
    if (!worst || s.dropOffRate > worst.rate) return { label: s.label, rate: s.dropOffRate }
    return worst
  }, null)

  return {
    stages, lost, totalLeads, overallConversion, avgDaysToConvert,
    bySource, byAssignee, worstDropOff: worstDropOff?.label ?? null,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{ branch?: string; from?: string; to?: string }>
}

export default async function LeadFunnelPage({ searchParams }: Props) {
  const user   = await requireAuth()
  const params = await searchParams

  const isSuperAdmin = user.globalRole === 'super_admin'
  const branchScope  = isSuperAdmin ? undefined : (user.branchIds.length > 0 ? user.branchIds : undefined)
  const branchFilter = params.branch ? [params.branch] : branchScope

  const [data, branchesRes] = await Promise.all([
    getFunnelData(branchFilter, params.from, params.to),
    listBranches({ perPage: 100 }),
  ])

  const maxStageCount = Math.max(...data.stages.map(s => s.count), 1)

  return (
    <div className="max-w-4xl space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/leads" className="text-xs text-[#94A3B8] hover:text-[#FF8A1F]">← Leads</Link>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <AdminFilterSelect param="branch" placeholder="All branches"
              options={branchesRes.data.map(b => ({ value: b.id, label: b.name }))} />
          )}
        </div>
      </div>

      {/* ── Summary KPIs ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Leads',        value: data.totalLeads,           color: 'bg-slate-300' },
          { label: 'Converted',          value: data.stages.find(s => s.status === 'CONVERTED')?.count ?? 0, color: 'bg-emerald-400' },
          { label: 'Overall Conversion', value: `${data.overallConversion}%`, color: data.overallConversion >= 25 ? 'bg-emerald-400' : 'bg-amber-400' },
          { label: 'Avg Days to Convert', value: data.avgDaysToConvert !== null ? `${data.avgDaysToConvert}d` : '—', color: 'bg-blue-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <div className={`mb-2 h-1.5 w-7 rounded-full ${color} opacity-80`} />
            <p className="text-2xl font-bold text-[#0B1F3A]">{value}</p>
            <p className="mt-0.5 text-xs text-[#64748B]">{label}</p>
          </div>
        ))}
      </div>

      {data.worstDropOff && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <span className="font-semibold">Worst drop-off point:</span> {data.worstDropOff} stage.
          Consider improving follow-up or qualification at this stage.
        </div>
      )}

      {/* ── Visual Funnel ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Pipeline Stages</p>

        <div className="space-y-1.5">
          {data.stages.filter(s => s.status !== 'ALL').map((stage, idx) => {
            const widthPct = data.totalLeads > 0 ? Math.max(4, Math.round((stage.count / data.totalLeads) * 100)) : 0
            return (
              <div key={stage.status} className="flex items-center gap-3">
                {/* Stage bar */}
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`text-xs font-semibold ${stage.textColor}`}>{stage.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-[#0B1F3A]">{stage.count}</span>
                      {stage.dropOffRate !== null && stage.dropOffRate > 0 && (
                        <span className="text-[11px] text-red-500">−{stage.dropOffRate}% drop</span>
                      )}
                    </div>
                  </div>
                  <div className="h-6 w-full rounded-lg bg-[#F1F5F9] overflow-hidden">
                    <div
                      className={`h-6 rounded-lg ${stage.color} opacity-80 transition-all flex items-center px-2`}
                      style={{ width: `${widthPct}%`, minWidth: stage.count > 0 ? '24px' : '0' }}
                    >
                      {stage.count > 0 && (
                        <span className="text-[10px] font-bold text-white truncate">
                          {widthPct}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Lost count */}
        {data.lost > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-[#94A3B8]">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            {data.lost} lead{data.lost !== 1 ? 's' : ''} marked as Lost
          </div>
        )}
      </div>

      {/* ── By Source ──────────────────────────────────────────────────── */}
      {data.bySource.length > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Performance by Source</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Source</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Total</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Converted</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.bySource.map(s => (
                  <tr key={s.source} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-4 py-2.5 font-medium capitalize text-[#0B1F3A]">{s.source.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2.5 text-right text-[#64748B]">{s.total}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-emerald-600">{s.converted}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-[#F1F5F9]">
                          <div className={`h-1.5 rounded-full ${s.rate >= 30 ? 'bg-emerald-400' : s.rate >= 15 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${s.rate}%` }} />
                        </div>
                        <span className={`text-xs font-semibold ${s.rate >= 30 ? 'text-emerald-700' : s.rate >= 15 ? 'text-amber-700' : 'text-red-600'}`}>{s.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── By Assignee ────────────────────────────────────────────────── */}
      {data.byAssignee.length > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Team Leader Performance</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Owner</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Leads</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-[#64748B]">Converted</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.byAssignee.map(a => (
                  <tr key={a.name} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">{a.name}</td>
                    <td className="px-4 py-2.5 text-right text-[#64748B]">{a.total}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-emerald-600">{a.converted}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-[#F1F5F9]">
                          <div className={`h-1.5 rounded-full ${a.rate >= 30 ? 'bg-emerald-400' : a.rate >= 15 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${a.rate}%` }} />
                        </div>
                        <span className={`text-xs font-semibold ${a.rate >= 30 ? 'text-emerald-700' : a.rate >= 15 ? 'text-amber-700' : 'text-red-600'}`}>{a.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
