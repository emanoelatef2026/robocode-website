import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getInstructorByUserId,
  listInstructorGroups,
  getStudentsRequiringAttention,
  getTopStudentsAcrossInstructorGroups,
  getStudentsMissingEvaluation,
  getInstructorPerformanceSummary,
  getCertReadyStudentsForInstructor,
  getPortfolioStatusBreakdown,
  getCompetitionActivityForInstructor,
  getInstructorWorkloadThisMonth,
} from '@/modules/instructor-portal/queries'
import { PROJECT_STATUS_CONFIG } from '@/modules/portfolio/types'
import Link from 'next/link'
import EmptyState from '@/components/admin/EmptyState'

function StatTile({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'good' | 'bad' | 'neutral' }) {
  const color = tone === 'good' ? 'text-[#10B981]' : tone === 'bad' ? 'text-[#EF4444]' : 'text-[#0B1F3A]'
  return (
    <div className="ds-card px-4 py-3.5 text-center">
      <p className={`text-xl font-bold leading-none ${color}`}>{value}</p>
      <p className="mt-1.5 text-[11px] text-[#94A3B8]">{label}</p>
    </div>
  )
}

export default async function PerformanceCenterPage() {
  const user       = await requirePortalRole('instructor')
  const instructor = await getInstructorByUserId(user.id)

  if (!instructor) {
    return (
      <EmptyState
        title="No instructor record found"
        description="Contact your team leader to link your account."
      />
    )
  }

  const [
    groups,
    attention,
    topStudents,
    missingEvaluations,
    perf,
    certReady,
    portfolioBreakdown,
    competitions,
    sessionsThisMonth,
  ] = await Promise.all([
    listInstructorGroups(instructor.id),
    getStudentsRequiringAttention(instructor.id, 10),
    getTopStudentsAcrossInstructorGroups(instructor.id, 10),
    getStudentsMissingEvaluation(instructor.id, 10),
    getInstructorPerformanceSummary(instructor),
    getCertReadyStudentsForInstructor(instructor, 6),
    getPortfolioStatusBreakdown(instructor.id),
    getCompetitionActivityForInstructor(instructor.id, 6),
    getInstructorWorkloadThisMonth(instructor),
  ])

  const activeGroups = groups.filter((g) => !!g.course_title)
  const totalPortfolioItems = portfolioBreakdown.reduce((sum, p) => sum + p.count, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0B1F3A]">Performance Center</h1>
        <p className="mt-0.5 text-sm text-[#64748B]">How your groups and students are doing, across your whole teaching load.</p>
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-[#0B1F3A]">Overview</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Active groups" value={activeGroups.length} />
          <StatTile label="Active students" value={perf?.active_students ?? groups.reduce((s, g) => s + g.student_count, 0)} />
          <StatTile
            label="Attendance rate"
            value={perf ? `${perf.attendance_rate}%` : '—'}
            tone={perf ? (perf.attendance_rate >= 85 ? 'good' : perf.attendance_rate < 60 ? 'bad' : 'neutral') : 'neutral'}
          />
          <StatTile
            label="Homework reviewed"
            value={perf ? `${perf.homework_review_pct}%` : '—'}
            tone={perf ? (perf.homework_review_pct >= 85 ? 'good' : perf.homework_review_pct < 60 ? 'bad' : 'neutral') : 'neutral'}
          />
          <StatTile
            label="Portfolio reviewed"
            value={perf ? `${perf.portfolio_review_pct}%` : '—'}
            tone={perf ? (perf.portfolio_review_pct >= 85 ? 'good' : perf.portfolio_review_pct < 60 ? 'bad' : 'neutral') : 'neutral'}
          />
          <StatTile label="Sessions this month" value={sessionsThisMonth} />
        </div>
        {perf?.avg_student_rating != null && (
          <p className="mt-2 text-xs text-[#64748B]">
            Average student feedback rating: <span className="font-semibold text-[#0B1F3A]">{perf.avg_student_rating.toFixed(1)} / 5</span>
          </p>
        )}
      </section>

      {/* ── Students needing attention / top performers ─────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[#0B1F3A]">
            Students Needing Attention <span className="text-[#94A3B8] font-normal">({attention.length})</span>
          </h2>
          {attention.length === 0 ? (
            <div className="ds-card px-4 py-3 text-sm text-[#94A3B8]">No attendance concerns right now.</div>
          ) : (
            <div className="ds-card divide-y divide-[#F1F5F9] overflow-hidden">
              {attention.map((a) => (
                <Link key={a.student_id} href={a.href} className="flex items-center justify-between gap-2 px-4 py-2.5 transition hover:bg-[#F8FAFC]">
                  <p className="truncate text-sm font-medium text-[#0B1F3A]">{a.student_name}</p>
                  <span className="shrink-0 text-xs text-[#EF4444]">{a.reason}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[#0B1F3A]">
            Top Performers <span className="text-[#94A3B8] font-normal">({topStudents.length})</span>
          </h2>
          {topStudents.length === 0 ? (
            <div className="ds-card px-4 py-3 text-sm text-[#94A3B8]">No XP activity recorded yet.</div>
          ) : (
            <div className="ds-card divide-y divide-[#F1F5F9] overflow-hidden">
              {topStudents.map((s, i) => (
                <Link
                  key={s.student_id}
                  href={`/portal/instructor/groups/${s.group_id}/students/${s.student_id}`}
                  className="flex items-center gap-2 px-4 py-2.5 transition hover:bg-[#F8FAFC]"
                >
                  <span className="w-4 shrink-0 text-xs font-bold text-[#94A3B8]">#{i + 1}</span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#0B1F3A]">{s.student_name}</p>
                  <span className="shrink-0 text-xs font-semibold text-[#FF8A1F]">{s.total_xp.toLocaleString()} XP</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Evaluation coverage / Certificate readiness ─────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0B1F3A]">
              Never Evaluated <span className="text-[#94A3B8] font-normal">({missingEvaluations.length})</span>
            </h2>
            <Link href="/portal/instructor/review" className="text-xs font-medium text-[#FF8A1F] hover:underline">Review Center →</Link>
          </div>
          {missingEvaluations.length === 0 ? (
            <div className="ds-card px-4 py-3 text-sm text-[#94A3B8]">Every student has at least one evaluation on record.</div>
          ) : (
            <div className="ds-card divide-y divide-[#F1F5F9] overflow-hidden">
              {missingEvaluations.map((m) => (
                <Link key={m.student_id} href={m.href} className="flex items-center justify-between gap-2 px-4 py-2.5 transition hover:bg-[#F8FAFC]">
                  <p className="truncate text-sm font-medium text-[#0B1F3A]">{m.student_name}</p>
                  <span className="shrink-0 text-xs text-[#94A3B8]">{m.group_name}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[#0B1F3A]">
            Certificate Ready <span className="text-[#94A3B8] font-normal">({certReady.length})</span>
          </h2>
          {certReady.length === 0 ? (
            <div className="ds-card px-4 py-3 text-sm text-[#94A3B8]">No students at 90%+ course completion yet.</div>
          ) : (
            <div className="ds-card divide-y divide-[#F1F5F9] overflow-hidden">
              {certReady.map((c) => (
                <div key={c.student_id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#0B1F3A]">{c.student_name}</p>
                    <p className="truncate text-xs text-[#94A3B8]">{c.group_name}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-[#15803D]">{c.completion_pct}%</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Portfolio / Competitions ─────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[#0B1F3A]">
            Portfolio Completion <span className="text-[#94A3B8] font-normal">({totalPortfolioItems} projects)</span>
          </h2>
          {totalPortfolioItems === 0 ? (
            <div className="ds-card px-4 py-3 text-sm text-[#94A3B8]">No portfolio projects submitted yet.</div>
          ) : (
            <div className="ds-card px-4 py-3.5">
              <div className="space-y-2">
                {portfolioBreakdown.filter((p) => p.count > 0).map((p) => {
                  const cfg = PROJECT_STATUS_CONFIG[p.status]
                  const pct = Math.round((p.count / totalPortfolioItems) * 100)
                  return (
                    <div key={p.status} className="flex items-center gap-3">
                      <span className={`w-28 shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-medium ${cfg.cls}`}>{cfg.label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F1F5F9]">
                        <div className="h-full rounded-full bg-[#FF8A1F]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-xs text-[#64748B]">{p.count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[#0B1F3A]">Competition Activity</h2>
          <div className="ds-card px-4 py-3.5">
            <div className="mb-3 flex items-center gap-4 text-sm">
              <span><span className="font-bold text-[#0B1F3A]">{competitions.total_records}</span> <span className="text-[#94A3B8]">records</span></span>
              <span><span className="font-bold text-[#0B1F3A]">{competitions.students_with_competitions}</span> <span className="text-[#94A3B8]">students</span></span>
            </div>
            {competitions.recent.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">No competitions logged for your students yet.</p>
            ) : (
              <div className="divide-y divide-[#F1F5F9]">
                {competitions.recent.map((c, i) => (
                  <div key={`${c.student_id}-${i}`} className="flex items-center justify-between gap-2 py-2">
                    <p className="min-w-0 flex-1 truncate text-sm text-[#0B1F3A]">{c.student_name} · {c.competition_name}</p>
                    <span className="shrink-0 text-xs text-[#94A3B8]">{c.year}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Class / course summary ───────────────────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-[#0B1F3A]">Class Summary</h2>
        {activeGroups.length === 0 ? (
          <div className="ds-card px-4 py-3 text-sm text-[#94A3B8]">No active groups yet.</div>
        ) : (
          <div className="ds-card divide-y divide-[#F1F5F9] overflow-hidden">
            {activeGroups.map((g) => (
              <Link key={g.group_id} href={`/portal/instructor/groups/${g.group_id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-[#F8FAFC]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#0B1F3A]">{g.group_name}</p>
                  <p className="truncate text-xs text-[#64748B]">{g.course_title} · {g.student_count} students</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-[#94A3B8]">
                  {g.completed_sessions}/{g.total_sessions ?? '—'} sessions
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
