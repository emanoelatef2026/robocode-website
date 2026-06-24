import { getCurrentUser }      from '@/modules/rbac/guards'
import { redirect }             from 'next/navigation'
import {
  resolveGroupFilter,
  listCoursePerformance,
} from '@/modules/analytics/queries'
import Link from 'next/link'

function scorePill(score: number) {
  const cls =
    score >= 75 ? 'bg-[#E7F8EE] text-[#15803D]' :
    score >= 50 ? 'bg-[#FFFBEB] text-[#B45309]' :
                  'bg-[#FEE2E2] text-[#EF4444]'
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {score.toFixed(1)}%
    </span>
  )
}

function PerformanceBar({ value }: { value: number }) {
  const color =
    value >= 75 ? 'bg-[#10B981]' :
    value >= 50 ? 'bg-[#F59E0B]' :
                  'bg-[#EF4444]'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full bg-[#F1F5F9] h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs text-[#64748B] tabular-nums w-10 text-right">{value.toFixed(1)}%</span>
    </div>
  )
}

export default async function CoursesAnalyticsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const groupFilter = await resolveGroupFilter(user)
  const courses     = await listCoursePerformance(groupFilter)

  const TOP_N        = 10
  const topCourses    = courses.slice(0, TOP_N)
  const bottomCourses = courses.length > TOP_N ? courses.slice(-TOP_N).reverse() : []

  const totalCourses  = courses.length
  const avgCompletion = totalCourses
    ? Math.round((courses.reduce((s, c) => s + c.avg_completion, 0) / totalCourses) * 10) / 10
    : 0

  return (
    <div className="space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Course Performance</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            Ranked by average completion percentage across all enrolled groups
          </p>
        </div>
        <Link
          href="/dashboard/analytics"
          className="text-sm text-[#FF8A1F] hover:underline"
        >
          ← Overview
        </Link>
      </div>

      {/* ── Summary stat cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="ds-card p-5">
          <p className="text-xs text-[#94A3B8] uppercase tracking-wide">Total Courses</p>
          <p className="mt-1 text-3xl font-bold text-[#0B1F3A]">{totalCourses}</p>
        </div>
        <div className="ds-card p-5">
          <p className="text-xs text-[#94A3B8] uppercase tracking-wide">Avg Completion</p>
          <p className="mt-1 text-3xl font-bold text-[#0B1F3A]">{avgCompletion}%</p>
        </div>
        <div className="ds-card p-5">
          <p className="text-xs text-[#94A3B8] uppercase tracking-wide">Total Students</p>
          <p className="mt-1 text-3xl font-bold text-[#0B1F3A]">
            {courses.reduce((s, c) => s + c.student_count, 0)}
          </p>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="ds-card px-6 py-14 text-center">
          <p className="text-sm text-[#94A3B8]">No course performance data available.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">

          {/* ── Top Performing Courses ────────────────────────────────────── */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-[#0B1F3A]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E7F8EE] text-[#15803D] text-xs font-bold">↑</span>
              Top Performing Courses
            </h2>
            <div className="ds-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="ds-table-head">
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">#</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Course</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Students</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B] w-36">Completion</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Attend.</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Assign.</th>
                  </tr>
                </thead>
                <tbody>
                  {topCourses.map((c, i) => (
                    <tr key={c.course_id} className="ds-table-row">
                      <td className="px-4 py-2.5 text-xs font-bold text-[#94A3B8]">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">{c.course_title}</td>
                      <td className="px-4 py-2.5 text-[#64748B]">{c.student_count}</td>
                      <td className="px-4 py-2.5 w-36">
                        <PerformanceBar value={c.avg_completion} />
                      </td>
                      <td className="px-4 py-2.5">{scorePill(c.avg_attendance)}</td>
                      <td className="px-4 py-2.5">{scorePill(c.avg_assignment)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Lowest Performing Courses ─────────────────────────────────── */}
          {bottomCourses.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-[#0B1F3A]">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FEE2E2] text-[#EF4444] text-xs font-bold">↓</span>
                Lowest Performing Courses
              </h2>
              <div className="ds-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="ds-table-head">
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">#</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Course</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Students</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B] w-36">Completion</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Attend.</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Assign.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bottomCourses.map((c, i) => (
                      <tr key={c.course_id} className="ds-table-row">
                        <td className="px-4 py-2.5 text-xs font-bold text-[#94A3B8]">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">{c.course_title}</td>
                        <td className="px-4 py-2.5 text-[#64748B]">{c.student_count}</td>
                        <td className="px-4 py-2.5 w-36">
                          <PerformanceBar value={c.avg_completion} />
                        </td>
                        <td className="px-4 py-2.5">{scorePill(c.avg_attendance)}</td>
                        <td className="px-4 py-2.5">{scorePill(c.avg_assignment)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Full ranking table ──────────────────────────────────────────────── */}
      {courses.length > TOP_N && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-[#0B1F3A]">All Courses</h2>
          <div className="ds-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="ds-table-head">
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Rank</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Course</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Students</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Completion</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Attendance</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Assignments</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c, i) => (
                  <tr key={c.course_id} className="ds-table-row">
                    <td className="px-4 py-2.5 text-xs font-bold text-[#94A3B8]">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">{c.course_title}</td>
                    <td className="px-4 py-2.5 text-[#64748B]">{c.student_count}</td>
                    <td className="px-4 py-2.5">{scorePill(c.avg_completion)}</td>
                    <td className="px-4 py-2.5">{scorePill(c.avg_attendance)}</td>
                    <td className="px-4 py-2.5">{scorePill(c.avg_assignment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </div>
  )
}
