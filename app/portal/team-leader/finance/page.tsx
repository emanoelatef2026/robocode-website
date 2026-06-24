import { requirePermission }          from '@/modules/rbac/guards'
import { listStudentOperations, getFilterOptions } from '@/modules/finance/queries'

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

export default async function StudentOperationsPage() {
  const user = await requirePermission('manage_financials')

  if (!user.branchIds.length) {
    return (
      <div className="ds-card px-6 py-12 text-center">
        <p className="text-sm font-medium text-[#0B1F3A]">No branch assigned</p>
        <p className="mt-1 text-xs text-[#94A3B8]">Contact your administrator to assign a branch.</p>
      </div>
    )
  }

  const [rows, filterOptions] = await Promise.all([
    listStudentOperations(user.branchIds),
    getFilterOptions(user.branchIds),
  ])

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const totalStudents     = rows.length
  const activePackages    = rows.filter(r => r.enrolled_sessions > 0 && r.remaining_sessions > 0).length
  const exhaustedPackages = rows.filter(r => r.enrolled_sessions > 0 && r.remaining_sessions <= 0).length
  const totalRemaining    = rows.reduce((s, r) => s + r.remaining_amount, 0)
  const totalPaid         = rows.reduce((s, r) => s + r.paid_amount, 0)
  const totalNet          = rows.reduce((s, r) => s + r.net_amount, 0)
  const collectionRate    = totalNet > 0 ? Math.round((totalPaid / totalNet) * 100) : 0
  const attendedRows      = rows.filter(r => r.sessions_attended > 0)
  const avgAttendance     = attendedRows.length > 0
    ? Math.round(attendedRows.reduce((s, r) => s + r.attendance_pct, 0) / attendedRows.length)
    : 0

  const { default: StudentOpsTable } = await import('./StudentOpsTable')

  return (
    <div className="space-y-5">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3">
        <p className="text-xs text-[#94A3B8]">Use the Add Payment button in the table to create contracts.</p>
      </div>

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {
            label: 'Total Students',
            value: totalStudents,
            color: 'bg-[#38BDF8]',
          },
          {
            label: 'Active Packages',
            value: activePackages,
            color: activePackages > 0 ? 'bg-[#10B981]' : 'bg-[#CBD5E1]',
          },
          {
            label: 'Exhausted Packages',
            value: exhaustedPackages,
            color: exhaustedPackages > 0 ? 'bg-purple-400' : 'bg-[#CBD5E1]',
          },
          {
            label: 'Outstanding',
            value: `EGP ${fmt(totalRemaining)}`,
            color: totalRemaining > 0 ? 'bg-[#F59E0B]' : 'bg-[#10B981]',
          },
          {
            label: 'Collection Rate',
            value: `${collectionRate}%`,
            color: collectionRate >= 80 ? 'bg-[#10B981]' : collectionRate >= 60 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]',
          },
          {
            label: 'Avg Attendance',
            value: avgAttendance > 0 ? `${avgAttendance}%` : '—',
            color: avgAttendance >= 75 ? 'bg-[#10B981]' : avgAttendance >= 60 ? 'bg-[#F59E0B]' : avgAttendance > 0 ? 'bg-[#EF4444]' : 'bg-[#CBD5E1]',
          },
        ].map(k => (
          <div key={k.label} className="ds-card p-3">
            <div className={`mb-1.5 h-1 w-6 rounded-full ${k.color} opacity-80`} />
            <p className="text-lg font-bold text-[#0B1F3A]">{k.value}</p>
            <p className="text-[11px] text-[#64748B]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Operations table ─────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="ds-card px-6 py-12 text-center">
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
