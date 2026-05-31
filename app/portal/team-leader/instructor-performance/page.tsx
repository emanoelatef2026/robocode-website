import { requirePortalRole }          from '@/modules/rbac/guards'
import { getInstructorPerformance }   from '@/modules/tl-dashboard/queries'
import type { InstructorPerf }        from '@/modules/tl-dashboard/queries'
import Link                           from 'next/link'

function RatingBadge({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-[13px] text-[#94A3B8]">—</span>
  const cls = rating >= 4.5 ? 'text-green-600' : rating >= 4.0 ? 'text-yellow-600' : 'text-red-600'
  return (
    <span className={`text-[13px] font-bold ${cls}`}>
      {rating.toFixed(1)}★
    </span>
  )
}

function PctBar({ value, warn = 60, good = 80 }: { value: number; warn?: number; good?: number }) {
  const color = value >= good ? 'bg-green-500' : value >= warn ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F1F5F9]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="w-8 text-right text-[12px] font-medium text-[#0B1F3A]">{value}%</span>
    </div>
  )
}

function StatusChip({ rating }: { rating: number | null }) {
  if (rating == null)   return <span className="rounded-full bg-gray-100  px-2 py-0.5 text-[10px] font-medium text-gray-500">No Data</span>
  if (rating >= 4.5)    return <span className="rounded-full bg-green-100  px-2 py-0.5 text-[10px] font-medium text-green-700">Excellent</span>
  if (rating >= 4.0)    return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700">Good</span>
  return                       <span className="rounded-full bg-red-100    px-2 py-0.5 text-[10px] font-medium text-red-600">Needs Attention</span>
}

export default async function InstructorPerformancePage() {
  const user = await requirePortalRole('team_leader')

  const instructors = await getInstructorPerformance(user.branchIds)

  // Summary aggregates
  const withRating = instructors.filter(i => i.avg_student_rating != null)
  const avgRating  = withRating.length > 0
    ? Math.round((withRating.reduce((s, i) => s + i.avg_student_rating!, 0) / withRating.length) * 10) / 10
    : null

  const excellent = instructors.filter(i => (i.avg_student_rating ?? 0) >= 4.5).length
  const attention = instructors.filter(i => i.avg_student_rating != null && i.avg_student_rating < 4.0).length

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A]">Instructor Performance</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">
          Ranked by student satisfaction · {instructors.length} active instructor{instructors.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Summary KPIs */}
      {instructors.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Avg. Rating</p>
            <p className="mt-1 text-3xl font-bold text-[#FF8A1F]">
              {avgRating != null ? `${avgRating}★` : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Total Instructors</p>
            <p className="mt-1 text-3xl font-bold text-[#0B1F3A]">{instructors.length}</p>
          </div>
          <div className="rounded-xl border border-green-100 bg-green-50 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Excellent (≥4.5★)</p>
            <p className="mt-1 text-3xl font-bold text-green-600">{excellent}</p>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Needs Attention (&lt;4★)</p>
            <p className="mt-1 text-3xl font-bold text-red-600">{attention}</p>
          </div>
        </div>
      )}

      {/* Ranking table */}
      {instructors.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-16 text-center">
          <p className="text-sm text-[#64748B]">No active instructors found for your branch.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
          <div className="border-b border-[#F1F5F9] px-5 py-3.5">
            <p className="text-[13px] font-semibold text-[#0B1F3A]">Instructor Rankings</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC] text-left">
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">#</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Instructor</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Student Rating</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Groups</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Students</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">HW Review</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Portfolio Review</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Attendance Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC]">
                {instructors.map((instr, idx) => (
                  <tr key={instr.instructor_id} className="hover:bg-[#F8FAFC]">
                    <td className="px-5 py-4">
                      <span className={[
                        'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                        idx === 0 ? 'bg-[#FF8A1F] text-white'   :
                        idx === 1 ? 'bg-[#94A3B8] text-white'   :
                        idx === 2 ? 'bg-amber-700 text-white'   :
                        'bg-[#F1F5F9] text-[#64748B]',
                      ].join(' ')}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-[#0B1F3A]">{instr.instructor_name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusChip rating={instr.avg_student_rating} />
                    </td>
                    <td className="px-4 py-4">
                      <RatingBadge rating={instr.avg_student_rating} />
                    </td>
                    <td className="px-4 py-4 text-center font-medium text-[#0B1F3A]">
                      {instr.active_groups}
                    </td>
                    <td className="px-4 py-4 text-center font-medium text-[#0B1F3A]">
                      {instr.active_students}
                    </td>
                    <td className="px-5 py-4 min-w-[120px]">
                      <PctBar value={instr.homework_review_pct} />
                    </td>
                    <td className="px-5 py-4 min-w-[120px]">
                      <PctBar value={instr.portfolio_review_pct} />
                    </td>
                    <td className="px-5 py-4 min-w-[120px]">
                      <PctBar value={instr.attendance_rate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-center">
        <Link
          href="/portal/team-leader/instructors"
          className="text-[13px] text-[#FF8A1F] hover:underline"
        >
          View all instructors →
        </Link>
      </div>
    </div>
  )
}
