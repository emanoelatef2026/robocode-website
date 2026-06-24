import { getCurrentUser }          from '@/modules/rbac/guards'
import { redirect }                from 'next/navigation'
import {
  resolveGroupFilter,
  listAtRiskStudents,
  listCertificateReadiness,
  listMissingAssignments,
  listSemestersForAnalytics,
} from '@/modules/analytics/queries'
import Pagination from '@/components/admin/Pagination'
import Link       from 'next/link'
import type { CertReadinessStatus } from '@/modules/analytics/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function riskBadge(reasons: string[]) {
  return reasons.map(r => (
    <span
      key={r}
      className="inline-block rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-medium text-[#EF4444] mr-1"
    >
      {r === 'low_completion' ? 'Low Overall' : 'Low Attendance'}
    </span>
  ))
}

const READINESS_LABELS: Record<CertReadinessStatus, string> = {
  ready:        'Ready',
  almost_ready: 'Almost Ready',
  not_ready:    'Not Ready',
}

const READINESS_COLORS: Record<CertReadinessStatus, string> = {
  ready:        'bg-[#E7F8EE]  text-[#15803D]  border-[#A7F3D0]',
  almost_ready: 'bg-[#FFFBEB]  text-[#B45309]  border-[#FDE68A]',
  not_ready:    'bg-[#FEE2E2]    text-[#EF4444]    border-[#FECACA]',
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{
    page?:     string
    miss_page?: string
    semester?: string
    sort?:     string
  }>
}

export default async function AnalyticsOverviewPage({ searchParams }: Props) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const params     = await searchParams
  const page       = Number(params.page ?? 1)
  const missPage   = Number(params.miss_page ?? 1)
  const semesterId = params.semester
  const sort       = params.sort === 'attendance' ? 'attendance' : 'completion'

  const groupFilter = await resolveGroupFilter(user)

  const [atRiskResult, certReadiness, missingResult, semesters] = await Promise.all([
    listAtRiskStudents(groupFilter, { semesterId, sort, page, perPage: 15 }),
    listCertificateReadiness(groupFilter, { semesterId }),
    listMissingAssignments(groupFilter, { page: missPage, perPage: 15 }),
    listSemestersForAnalytics(),
  ])

  // Cert readiness summary counts
  const certCounts = certReadiness.reduce(
    (acc, s) => { acc[s.status]++; return acc },
    { ready: 0, almost_ready: 0, not_ready: 0 } as Record<CertReadinessStatus, number>
  )

  // Build filter URL helper
  function filterHref(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    const base = { semester: semesterId, sort, page: '1', miss_page: '1', ...overrides }
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v)
    return `/dashboard/analytics?${p.toString()}`
  }

  return (
    <div className="space-y-8">

      {/* ── Page header + filters ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">Academic Intelligence</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            At-risk students, certificate readiness, and missing assignments
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Semester filter */}
          {semesters.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#64748B]">Semester:</label>
              <div className="flex items-center gap-1 ds-card px-2">
                <Link
                  href={filterHref({ semester: undefined })}
                  className={`px-2 py-1 text-xs rounded ${!semesterId ? 'font-semibold text-[#FF8A1F]' : 'text-[#64748B] hover:text-[#0B1F3A]'}`}
                >
                  All
                </Link>
                {semesters.slice(0, 5).map(s => (
                  <Link
                    key={s.id}
                    href={filterHref({ semester: s.id })}
                    className={`px-2 py-1 text-xs rounded ${semesterId === s.id ? 'font-semibold text-[#FF8A1F]' : 'text-[#64748B] hover:text-[#0B1F3A]'}`}
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Certificate Readiness summary ─────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-[#0B1F3A]">Certificate Readiness</h2>
        <div className="grid grid-cols-3 gap-4">
          {(['ready', 'almost_ready', 'not_ready'] as CertReadinessStatus[]).map(status => (
            <div
              key={status}
              className={`rounded-xl border p-4 ${READINESS_COLORS[status]}`}
            >
              <p className="text-2xl font-bold">{certCounts[status]}</p>
              <p className="mt-1 text-sm font-medium">{READINESS_LABELS[status]}</p>
            </div>
          ))}
        </div>

        {/* Detailed list */}
        {certReadiness.length > 0 && (
          <div className="mt-4 ds-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="ds-table-head">
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Student</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Semester</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Attendance</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Assignments</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Overall</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Courses</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Status</th>
                </tr>
              </thead>
              <tbody>
                {certReadiness.map(s => (
                  <tr key={`${s.student_id}::${s.semester_id}`} className="ds-table-row">
                    <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">
                      <div>{s.student_name}</div>
                      <div className="text-[11px] text-[#94A3B8]">{s.student_email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-[#64748B]">{s.semester_name}</td>
                    <td className="px-4 py-2.5">{scorePill(s.avg_attendance)}</td>
                    <td className="px-4 py-2.5">{scorePill(s.avg_assignment)}</td>
                    <td className="px-4 py-2.5">{scorePill(s.avg_completion)}</td>
                    <td className="px-4 py-2.5 text-[#64748B]">{s.courses_evaluated}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${READINESS_COLORS[s.status]}`}>
                        {READINESS_LABELS[s.status]}
                      </span>
                      {s.failed_thresholds.length > 0 && (
                        <div className="mt-0.5 text-[10px] text-[#94A3B8]">
                          Fails: {s.failed_thresholds.join(', ')}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {certReadiness.length === 0 && (
          <p className="mt-4 text-sm text-[#94A3B8]">No progress data found for the selected filters.</p>
        )}
      </section>

      {/* ── At-Risk Students ──────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#0B1F3A]">At-Risk Students</h2>
            <p className="text-xs text-[#94A3B8]">
              completion &lt; 70% or attendance &lt; 75% — {atRiskResult.total} found
            </p>
          </div>
          {/* Sort toggle */}
          <div className="flex items-center gap-1 ds-card px-2">
            <Link
              href={filterHref({ sort: 'completion', page: '1' })}
              className={`px-2 py-1 text-xs rounded ${sort === 'completion' ? 'font-semibold text-[#FF8A1F]' : 'text-[#64748B] hover:text-[#0B1F3A]'}`}
            >
              Sort: Completion
            </Link>
            <Link
              href={filterHref({ sort: 'attendance', page: '1' })}
              className={`px-2 py-1 text-xs rounded ${sort === 'attendance' ? 'font-semibold text-[#FF8A1F]' : 'text-[#64748B] hover:text-[#0B1F3A]'}`}
            >
              Sort: Attendance
            </Link>
          </div>
        </div>

        {atRiskResult.data.length === 0 ? (
          <div className="ds-card px-6 py-10 text-center">
            <p className="text-sm text-[#94A3B8]">
              {atRiskResult.total === 0 ? 'No at-risk students found.' : 'No results on this page.'}
            </p>
          </div>
        ) : (
          <div className="ds-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="ds-table-head">
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Student</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Group</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Course</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Semester</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Completion</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Attendance</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Assignment</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Portfolio</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Risk</th>
                </tr>
              </thead>
              <tbody>
                {atRiskResult.data.map(s => (
                  <tr key={`${s.student_id}-${s.course_id}`} className="ds-table-row">
                    <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">
                      <div>{s.student_name}</div>
                      <div className="text-[11px] text-[#94A3B8]">{s.student_email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-[#64748B]">{s.group_name}</td>
                    <td className="px-4 py-2.5 text-[#64748B]">{s.course_title}</td>
                    <td className="px-4 py-2.5 text-[#64748B]">{s.semester_name}</td>
                    <td className="px-4 py-2.5">{scorePill(s.completion_percentage)}</td>
                    <td className="px-4 py-2.5">{scorePill(s.attendance_score)}</td>
                    <td className="px-4 py-2.5">{scorePill(s.assignment_score)}</td>
                    <td className="px-4 py-2.5">{scorePill(s.portfolio_score)}</td>
                    <td className="px-4 py-2.5">{riskBadge(s.risk_reasons)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={atRiskResult.page}
              totalPages={atRiskResult.totalPages}
              total={atRiskResult.total}
              perPage={atRiskResult.perPage}
            />
          </div>
        )}
      </section>

      {/* ── Missing Assignments ───────────────────────────────────────────── */}
      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-[#0B1F3A]">Missing Assignments</h2>
          <p className="text-xs text-[#94A3B8]">
            Students with unsubmitted assignments — {missingResult.total} found
          </p>
        </div>

        {missingResult.data.length === 0 ? (
          <div className="ds-card px-6 py-10 text-center">
            <p className="text-sm text-[#94A3B8]">No students with missing assignments.</p>
          </div>
        ) : (
          <div className="ds-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="ds-table-head">
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Student</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Missing</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[#64748B]">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {missingResult.data.map(s => (
                  <tr key={s.student_id} className="ds-table-row">
                    <td className="px-4 py-2.5 font-medium text-[#0B1F3A]">
                      <div>{s.student_name}</div>
                      <div className="text-[11px] text-[#94A3B8]">{s.student_email}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-block rounded-full bg-[#FFFBEB] px-2 py-0.5 text-xs font-semibold text-[#B45309]">
                        {s.missing_count}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {s.overdue_count > 0 ? (
                        <span className="inline-block rounded-full bg-[#FEE2E2] px-2 py-0.5 text-xs font-semibold text-[#EF4444]">
                          {s.overdue_count} overdue
                        </span>
                      ) : (
                        <span className="text-xs text-[#94A3B8]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={missingResult.page}
              totalPages={missingResult.totalPages}
              total={missingResult.total}
              perPage={missingResult.perPage}
            />
          </div>
        )}
      </section>

    </div>
  )
}
