import { requirePortalRole }        from '@/modules/rbac/guards'
import { getBranchPerformance }     from '@/modules/tl-dashboard/queries'
import { createServiceClient }      from '@/lib/supabase/service'
import Link                         from 'next/link'

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

function HealthBadge({ score }: { score: number }) {
  const { label, cls } =
    score >= 85 ? { label: 'Excellent', cls: 'bg-emerald-100 text-emerald-700' } :
    score >= 70 ? { label: 'Good',      cls: 'bg-blue-100 text-blue-700'     } :
    score >= 55 ? { label: 'Watch',     cls: 'bg-amber-100 text-amber-700'   } :
    { label: 'At Risk',   cls: 'bg-red-100 text-red-700'   }
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      <span>{score}</span>
      <span>{label}</span>
    </div>
  )
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-emerald-400' : score >= 70 ? 'bg-blue-400' : score >= 55 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
    </div>
  )
}

export default async function ExecutiveOpsDashboard() {
  const user = await requirePortalRole('super_admin')
  const db   = createServiceClient()

  // Fetch all branch performance data + integrity checks
  const [branches, integrityRows, retentionRows] = await Promise.all([
    getBranchPerformance([]),  // empty = all branches (super_admin sees all)
    db.from('v_integrity_audit').select('severity').limit(500).then(r => r.data ?? []),
    db.from('v_retention_analytics').select('course_id, title, dropout_pct, retention_pct, active_enrollments, total_contracted, risk_students').order('active_enrollments', { ascending: false }).limit(10).then(r => r.data ?? []),
  ])

  // Academy-wide KPIs
  const totalStudents  = branches.reduce((s, b) => s + b.active_students, 0)
  const totalRevenue   = branches.reduce((s, b) => s + b.revenue_collected, 0)
  const totalOutstanding = branches.reduce((s, b) => s + b.outstanding, 0)
  const totalOverdue   = branches.reduce((s, b) => s + b.overdue_count, 0)
  const totalRisk      = branches.reduce((s, b) => s + b.risk_students, 0)
  const totalTasks     = branches.reduce((s, b) => s + b.open_tasks, 0)
  const avgHealth      = branches.length > 0
    ? Math.round(branches.reduce((s, b) => s + b.operational_health_score, 0) / branches.length)
    : 0
  const avgCollection  = branches.length > 0
    ? Math.round(branches.reduce((s, b) => s + b.collection_rate_pct, 0) / branches.length)
    : 0

  // Integrity
  const criticalIssues = (integrityRows as any[]).filter(r => r.severity === 'CRITICAL').length
  const highIssues     = (integrityRows as any[]).filter(r => r.severity === 'HIGH').length

  return (
    <div className="space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3">
        <Link href="/admin/system-health" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]">
          System Health →
        </Link>
      </div>

      {/* ── Academy KPI Strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[
          { label: 'Active Students',   value: String(totalStudents),            cls: 'text-[#0B1F3A]',   badge: null },
          { label: 'Revenue Collected', value: `EGP ${fmt(totalRevenue)}`,        cls: 'text-emerald-600', badge: null },
          { label: 'Outstanding',       value: `EGP ${fmt(totalOutstanding)}`,    cls: 'text-amber-600',   badge: null },
          { label: 'Overdue Accounts',  value: String(totalOverdue),              cls: totalOverdue > 0 ? 'text-red-600' : 'text-emerald-600', badge: totalOverdue > 0 ? 'alert' : null },
          { label: 'At-Risk Students',  value: String(totalRisk),                 cls: totalRisk > 0 ? 'text-red-600' : 'text-emerald-600',   badge: totalRisk > 0 ? 'alert' : null },
          { label: 'Open Tasks',        value: String(totalTasks),                cls: totalTasks > 0 ? 'text-amber-600' : 'text-emerald-600', badge: null },
          { label: 'Avg Collection',    value: `${avgCollection}%`,               cls: avgCollection >= 80 ? 'text-emerald-600' : 'text-amber-600', badge: null },
          { label: 'Avg Health Score',  value: String(avgHealth),                 cls: avgHealth >= 80 ? 'text-emerald-600' : avgHealth >= 60 ? 'text-amber-600' : 'text-red-600', badge: null },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border bg-white p-3 ${k.badge === 'alert' ? 'border-red-200' : 'border-[#E2E8F0]'}`}>
            <p className={`text-xl font-bold ${k.cls}`}>{k.value}</p>
            <p className="text-[10px] text-[#64748B]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Integrity Alerts ───────────────────────────────────────────── */}
      {(criticalIssues > 0 || highIssues > 0) && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">Data Integrity Issues Detected</p>
          <p className="mt-1 text-sm text-red-700">
            {criticalIssues > 0 && <span>{criticalIssues} critical · </span>}
            {highIssues > 0 && <span>{highIssues} high severity · </span>}
            <Link href="/admin/system-health" className="underline">View details →</Link>
          </p>
        </div>
      )}

      {/* ── Branch Performance Ranking ─────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-[#0B1F3A]">Branch Ranking</h2>
        {branches.length === 0 ? (
          <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-10 text-center text-sm text-[#94A3B8]">
            No branch data available. Run the Sprint 51 migration first.
          </div>
        ) : (
          <div className="space-y-3">
            {[...branches].sort((a, b) => b.operational_health_score - a.operational_health_score).map((b, idx) => (
              <div key={b.branch_id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#94A3B8]">#{idx + 1}</span>
                      <p className="font-semibold text-[#0B1F3A]">{b.branch_name}</p>
                      {b.critical_tasks > 0 && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                          {b.critical_tasks} critical
                        </span>
                      )}
                    </div>
                    <HealthBar score={b.operational_health_score} />
                  </div>
                  <HealthBadge score={b.operational_health_score} />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6 text-center text-[11px]">
                  {[
                    { label: 'Students',   value: String(b.active_students), cls: 'text-[#0B1F3A]' },
                    { label: 'Collected',  value: `EGP ${fmt(b.revenue_collected)}`, cls: 'text-emerald-600' },
                    { label: 'Outstanding',value: `EGP ${fmt(b.outstanding)}`, cls: b.outstanding > 0 ? 'text-amber-600' : 'text-emerald-600' },
                    { label: 'Collection', value: `${b.collection_rate_pct}%`, cls: b.collection_rate_pct >= 80 ? 'text-emerald-600' : 'text-amber-600' },
                    { label: 'At Risk',    value: String(b.risk_students),   cls: b.risk_students > 0 ? 'text-red-600' : 'text-emerald-600' },
                    { label: 'Open Tasks', value: String(b.open_tasks),       cls: b.open_tasks > 5 ? 'text-amber-600' : 'text-[#0B1F3A]' },
                  ].map(k => (
                    <div key={k.label} className="rounded-lg bg-[#F8FAFC] p-2">
                      <p className={`font-bold ${k.cls}`}>{k.value}</p>
                      <p className="text-[#94A3B8]">{k.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Course Retention Leaderboard ───────────────────────────────── */}
      {retentionRows.length > 0 && (
        <div>
          <h2 className="mb-3 text-[15px] font-semibold text-[#0B1F3A]">Course Retention Analytics</h2>
          <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-left">
                  {['Course', 'Active', 'Revenue', 'Retention', 'Dropout', 'At Risk'].map(h => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(retentionRows as any[]).map(r => (
                  <tr key={r.course_id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3 font-medium text-[#0B1F3A]">{r.title}</td>
                    <td className="px-4 py-3 text-[#64748B]">{r.active_enrollments}</td>
                    <td className="px-4 py-3 font-medium text-emerald-600">EGP {fmt(Number(r.total_contracted ?? 0))}</td>
                    <td className="px-4 py-3">
                      {r.retention_pct != null ? (
                        <span className={`font-semibold ${Number(r.retention_pct) >= 70 ? 'text-emerald-600' : Number(r.retention_pct) >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {r.retention_pct}%
                        </span>
                      ) : <span className="text-[#94A3B8]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${Number(r.dropout_pct) > 20 ? 'text-red-600' : 'text-[#64748B]'}`}>
                        {r.dropout_pct}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {Number(r.risk_students) > 0 ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                          {r.risk_students}
                        </span>
                      ) : (
                        <span className="text-[#94A3B8]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Quick Links ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Finance',    href: '/admin/finance',   icon: '💰' },
          { label: 'Students',   href: '/admin/students',  icon: '🎓' },
          { label: 'Integrity',  href: '/admin/system-health', icon: '🔍' },
          { label: 'Branches',   href: '/admin/branches',  icon: '🏢' },
        ].map(l => (
          <Link key={l.label} href={l.href} className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white p-4 text-sm font-medium text-[#0B1F3A] hover:border-[#FF8A1F] hover:text-[#FF8A1F] transition-colors">
            <span>{l.icon}</span>
            <span>{l.label}</span>
          </Link>
        ))}
      </div>

    </div>
  )
}
