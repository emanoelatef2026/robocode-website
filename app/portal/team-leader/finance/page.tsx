import { requirePermission }          from '@/modules/rbac/guards'
import { listStudentOperations, getFilterOptions } from '@/modules/finance/queries'

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

export default async function StudentOperationsPage() {
  const user = await requirePermission('manage_financials')

  if (!user.branchIds.length) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-12 text-center">
        <p className="text-sm font-medium text-[#0B1F3A]">No branch assigned</p>
        <p className="mt-1 text-xs text-[#94A3B8]">Contact your administrator to assign a branch.</p>
      </div>
    )
  }

  // Load data and filter options in parallel
  const [rows, filterOptions] = await Promise.all([
    listStudentOperations(user.branchIds),
    getFilterOptions(user.branchIds),
  ])

  // ── Summary KPIs ────────────────────────────────────────────────────────
  const totalStudents  = rows.length
  const highRisk       = rows.filter(r => r.risk_level === 'HIGH').length
  const mediumRisk     = rows.filter(r => r.risk_level === 'MEDIUM').length
  const overdue        = rows.filter(r => r.financial_status === 'OVERDUE').length
  const totalRemaining = rows.reduce((s, r) => s + r.remaining_amount, 0)
  const totalPaid      = rows.reduce((s, r) => s + r.paid_amount, 0)
  const totalNet       = rows.reduce((s, r) => s + r.net_amount, 0)
  const collectionRate = totalNet > 0 ? Math.round((totalPaid / totalNet) * 100) : 0
  const avgAttendance  = rows.filter(r => r.sessions_attended > 0).length > 0
    ? Math.round(rows.filter(r => r.sessions_attended > 0).reduce((s, r) => s + r.attendance_pct, 0) / rows.filter(r => r.sessions_attended > 0).length)
    : 0

  // Dynamically import the client table to keep server component clean
  const { default: StudentOpsTable } = await import('./StudentOpsTable')

  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Student Operations Center</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            {user.branchIds.length > 1 ? 'All branches' : 'Branch'} — {totalStudents} students monitored
          </p>
        </div>
        <p className="text-xs text-[#94A3B8]">Use the Enroll button in the table to add students.</p>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: 'Students',       value: totalStudents,           color: 'bg-blue-400' },
          { label: 'High Risk',      value: highRisk,                color: highRisk > 0      ? 'bg-red-400'     : 'bg-slate-300' },
          { label: 'Medium Risk',    value: mediumRisk,              color: mediumRisk > 0    ? 'bg-amber-400'   : 'bg-slate-300' },
          { label: 'Overdue',        value: overdue,                 color: overdue > 0       ? 'bg-red-400'     : 'bg-slate-300' },
          { label: 'Collection',     value: `${collectionRate}%`,    color: collectionRate >= 80 ? 'bg-emerald-400' : collectionRate >= 60 ? 'bg-amber-400' : 'bg-red-400' },
          { label: 'Outstanding',    value: `EGP ${fmt(totalRemaining)}`, color: 'bg-amber-400' },
          { label: 'Avg Attendance', value: avgAttendance > 0 ? `${avgAttendance}%` : '—', color: avgAttendance >= 75 ? 'bg-emerald-400' : avgAttendance >= 60 ? 'bg-amber-400' : 'bg-red-400' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
            <div className={`mb-1.5 h-1 w-6 rounded-full ${k.color} opacity-80`} />
            <p className="text-lg font-bold text-[#0B1F3A]">{k.value}</p>
            <p className="text-[11px] text-[#64748B]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Operations table (client component) ───────────────────────────── */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#0B1F3A]">No active students found</p>
          <p className="mt-1 text-xs text-[#94A3B8]">Add students to your branch to begin tracking operations.</p>
        </div>
      ) : (
        <StudentOpsTable
          rows={rows}
          branchIds={user.branchIds}
          branches={filterOptions.branches}
          groups={filterOptions.groups}
          instructors={filterOptions.instructors}
          multiBranch={user.branchIds.length > 1}
        />
      )}
    </div>
  )
}
