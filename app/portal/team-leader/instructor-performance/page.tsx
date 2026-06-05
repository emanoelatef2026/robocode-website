import { requirePortalRole }          from '@/modules/rbac/guards'
import { getInstructorOpsData }        from '@/modules/tl-dashboard/queries'
import type { InstructorOpsRow }       from '@/modules/tl-dashboard/queries'
import Link                            from 'next/link'

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

function HealthScore({ score }: { score: number }) {
  const cls =
    score >= 85 ? 'bg-emerald-100 text-emerald-700' :
    score >= 70 ? 'bg-blue-100 text-blue-700' :
    score >= 55 ? 'bg-amber-100 text-amber-700' :
    'bg-red-100 text-red-700'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {score}
    </span>
  )
}

function PctBar({ value, warn = 60, good = 80 }: { value: number; warn?: number; good?: number }) {
  const color = value >= good ? 'bg-emerald-500' : value >= warn ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#F1F5F9]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="w-9 text-right text-[12px] font-medium text-[#0B1F3A]">{value}%</span>
    </div>
  )
}

function RatingBadge({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-[13px] text-[#94A3B8]">—</span>
  const cls = rating >= 4.5 ? 'text-emerald-600' : rating >= 4.0 ? 'text-amber-600' : 'text-red-600'
  return <span className={`text-[13px] font-bold ${cls}`}>{rating.toFixed(1)}★</span>
}

export default async function InstructorOperationsPage() {
  const user        = await requirePortalRole('team_leader')
  const instructors = await getInstructorOpsData(user.branchIds)

  const withRating    = instructors.filter(i => i.avg_student_rating != null)
  const avgRating     = withRating.length > 0
    ? Math.round((withRating.reduce((s, i) => s + i.avg_student_rating!, 0) / withRating.length) * 10) / 10
    : null
  const totalStudents = instructors.reduce((s, i) => s + i.active_students, 0)
  const totalRevenue  = instructors.reduce((s, i) => s + i.revenue_managed, 0)
  const totalRisk     = instructors.reduce((s, i) => s + i.risk_students, 0)
  const avgHealth     = instructors.length > 0
    ? Math.round(instructors.reduce((s, i) => s + i.health_score, 0) / instructors.length)
    : 0

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A]">Instructor Operations Center</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            Performance, retention, and operational health · {instructors.length} active instructor{instructors.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/portal/team-leader/instructors" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] font-medium text-[#64748B] hover:border-[#FF8A1F] hover:text-[#FF8A1F]">
          Manage →
        </Link>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────────────── */}
      {instructors.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: 'Avg Rating',       value: avgRating != null ? `${avgRating}★` : '—',       cls: 'text-[#FF8A1F]' },
            { label: 'Active Students',  value: String(totalStudents),                             cls: 'text-[#0B1F3A]' },
            { label: 'Revenue Managed',  value: `EGP ${fmt(totalRevenue)}`,                        cls: 'text-emerald-600' },
            { label: 'At-Risk Students', value: String(totalRisk),                                 cls: totalRisk > 0 ? 'text-red-600' : 'text-emerald-600' },
            { label: 'Avg Health Score', value: String(avgHealth),                                 cls: avgHealth >= 80 ? 'text-emerald-600' : avgHealth >= 60 ? 'text-amber-600' : 'text-red-600' },
          ].map(k => (
            <div key={k.label} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <p className={`text-2xl font-bold ${k.cls}`}>{k.value}</p>
              <p className="mt-0.5 text-[11px] text-[#64748B]">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Instructor Table ────────────────────────────────────────────── */}
      {instructors.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-16 text-center">
          <p className="text-sm text-[#94A3B8]">No active instructors found for your branch.</p>
          <Link href="/portal/team-leader/instructors/new" className="mt-3 inline-block text-sm text-[#FF8A1F] hover:underline">
            Add first instructor →
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-[#E2E8F0] bg-white md:block">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-3.5">
              <p className="text-[13px] font-semibold text-[#0B1F3A]">Instructor Leaderboard</p>
              <p className="text-[11px] text-[#94A3B8]">Ranked by health score</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC] text-left">
                    {['#', 'Instructor', 'Health', 'Students', 'Rating', 'Revenue', 'Retention', 'At-Risk', 'Attendance', 'HW Review'].map(h => (
                      <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {instructors.map((instr, idx) => (
                    <tr key={instr.instructor_id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3">
                        <span className={[
                          'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                          idx === 0 ? 'bg-[#FF8A1F] text-white' : idx === 1 ? 'bg-[#94A3B8] text-white' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-[#F1F5F9] text-[#64748B]',
                        ].join(' ')}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/portal/team-leader/instructors`} className="font-medium text-[#0B1F3A] hover:text-[#FF8A1F]">
                          {instr.instructor_name}
                        </Link>
                        <p className="text-[11px] text-[#94A3B8]">{instr.active_groups} group{instr.active_groups !== 1 ? 's' : ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <HealthScore score={instr.health_score} />
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-[#0B1F3A]">
                        {instr.active_students}
                        {instr.critical_students > 0 && (
                          <span className="ml-1 text-[10px] text-red-500">({instr.critical_students} crit)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <RatingBadge rating={instr.avg_student_rating} />
                      </td>
                      <td className="px-4 py-3 font-medium text-emerald-600">
                        EGP {fmt(instr.revenue_managed)}
                        {instr.outstanding_amount > 0 && (
                          <p className="text-[11px] font-normal text-amber-600">{fmt(instr.outstanding_amount)} due</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {instr.retention_pct != null ? (
                          <span className={`font-medium ${instr.retention_pct >= 70 ? 'text-emerald-600' : instr.retention_pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            {instr.retention_pct}%
                          </span>
                        ) : <span className="text-[#94A3B8]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {instr.risk_students > 0 ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                            {instr.risk_students}
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <PctBar value={instr.attendance_rate} />
                      </td>
                      <td className="px-4 py-3">
                        <PctBar value={instr.homework_review_pct} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {instructors.map((instr, idx) => (
              <div key={instr.instructor_id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#0B1F3A]">
                      <span className="mr-1.5 text-[11px] font-bold text-[#94A3B8]">#{idx + 1}</span>
                      {instr.instructor_name}
                    </p>
                    <p className="text-[12px] text-[#64748B]">{instr.active_groups} groups · {instr.active_students} students</p>
                  </div>
                  <HealthScore score={instr.health_score} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="rounded-lg bg-[#F8FAFC] p-2">
                    <p className="font-bold text-[#FF8A1F]">{instr.avg_student_rating?.toFixed(1) ?? '—'}★</p>
                    <p className="text-[#94A3B8]">Rating</p>
                  </div>
                  <div className="rounded-lg bg-[#F8FAFC] p-2">
                    <p className={`font-bold ${instr.risk_students > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{instr.risk_students}</p>
                    <p className="text-[#94A3B8]">At Risk</p>
                  </div>
                  <div className="rounded-lg bg-[#F8FAFC] p-2">
                    <p className="font-bold text-emerald-600">EGP {fmt(instr.revenue_managed)}</p>
                    <p className="text-[#94A3B8]">Revenue</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#64748B]">Attendance</span>
                    <PctBar value={instr.attendance_rate} />
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#64748B]">HW Review</span>
                    <PctBar value={instr.homework_review_pct} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
