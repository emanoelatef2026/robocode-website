import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { getTLEvaluationOverview }              from '@/modules/tl-analytics/queries'
import { EVALUATION_CRITERION_LABELS }          from '@/modules/student-evaluations/types'
import type { EvaluationCriterion }             from '@/modules/student-evaluations/types'
import Link                                     from 'next/link'
import { StatCard, SectionCard, OperationalTable, MetricPill, EmptyState } from '../_components/ui'

interface Props {
  searchParams: Promise<{ view?: string }>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function completionVariant(pct: number): 'green' | 'amber' | 'red' {
  return pct >= 75 ? 'green' : pct >= 50 ? 'amber' : 'red'
}

export default async function TLEvaluationsPage({ searchParams }: Props) {
  const user = await requirePortalRole('team_leader')
  await requirePermission('manage_evaluations')

  const params = await searchParams
  const view   = params.view ?? 'overview'

  const overview = await getTLEvaluationOverview(user.branchIds)
  const { kpis, by_group, by_instructor, students_missing, recent_activity } = overview

  function tabUrl(v: string) {
    return v === 'overview' ? '/portal/team-leader/evaluations' : `/portal/team-leader/evaluations?view=${v}`
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-bold text-[#0B1F3A]">Evaluation Oversight</h1>
        <p className="mt-0.5 text-[12px] text-[#64748B]">
          Which instructors are evaluating their students, and which students have gone without one.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Completion" value={`${kpis.completion_pct}%`} accent={completionVariant(kpis.completion_pct)} sub={`${kpis.evaluated_recent_count}/${kpis.total_active_students} students`} />
        <StatCard label="Missing"   value={kpis.missing_count}  accent={kpis.missing_count > 0 ? 'red' : 'slate'} sub="never evaluated" />
        <StatCard label="Overdue"   value={kpis.overdue_count}  accent={kpis.overdue_count > 0 ? 'amber' : 'slate'} sub="30+ days stale" />
        <StatCard label="Recent (7d)" value={kpis.recent_evaluations_count} accent="blue" sub="new evaluations" />
        <StatCard label="Active Students" value={kpis.total_active_students} accent="slate" />
      </div>

      {/* View tabs */}
      <div className="flex gap-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1 w-fit">
        {[
          { key: 'overview',    label: 'Overview' },
          { key: 'groups',      label: 'By Group' },
          { key: 'instructors', label: 'By Instructor' },
        ].map(t => (
          <Link
            key={t.key}
            href={tabUrl(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              view === t.key ? 'bg-white text-[#0B1F3A] shadow-sm' : 'text-[#64748B] hover:text-[#0B1F3A]'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
      {view === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title={`Students Needing Attention (${students_missing.length})`} noPad>
            {students_missing.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Nothing missing" description="Every active student has a recent evaluation." />
              </div>
            ) : (
              <OperationalTable
                columns={[
                  { key: 'student', header: 'Student', cell: (r: typeof students_missing[number]) => (
                    <div>
                      <p className="font-medium text-[#0B1F3A]">{r.student_name}</p>
                      <p className="text-[11px] text-[#94A3B8]">{r.group_name ?? '—'}</p>
                    </div>
                  ) },
                  { key: 'status', header: 'Status', cell: (r: typeof students_missing[number]) => (
                    <MetricPill label={r.status === 'missing' ? 'Never evaluated' : 'Overdue'} variant={r.status === 'missing' ? 'red' : 'amber'} />
                  ) },
                  { key: 'last', header: 'Last Evaluated', align: 'right', cell: (r: typeof students_missing[number]) => (
                    <span className="text-[#64748B]">{r.last_activity_at ? formatDate(r.last_activity_at) : '—'}</span>
                  ) },
                ]}
                rows={students_missing}
                keyFn={r => r.student_id}
              />
            )}
          </SectionCard>

          <SectionCard title="Recent Evaluations" noPad>
            {recent_activity.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No recent activity" description="No evaluations submitted in the last 7 days." />
              </div>
            ) : (
              <OperationalTable
                columns={[
                  { key: 'student', header: 'Student', cell: (r: typeof recent_activity[number]) => <span className="font-medium text-[#0B1F3A]">{r.student_name}</span> },
                  { key: 'criterion', header: 'Criterion', cell: (r: typeof recent_activity[number]) => (
                    <MetricPill label={EVALUATION_CRITERION_LABELS[r.criterion as EvaluationCriterion] ?? r.criterion} variant="blue" />
                  ) },
                  { key: 'author', header: 'By', cell: (r: typeof recent_activity[number]) => <span className="text-[#64748B]">{r.author_name}</span> },
                  { key: 'when', header: 'When', align: 'right', cell: (r: typeof recent_activity[number]) => <span className="text-[#64748B]">{formatDate(r.evaluated_at)}</span> },
                ]}
                rows={recent_activity}
                keyFn={r => r.id}
              />
            )}
          </SectionCard>
        </div>
      )}

      {/* ── BY GROUP ─────────────────────────────────────────────────────── */}
      {view === 'groups' && (
        by_group.length === 0 ? (
          <EmptyState title="No group data yet" description="No branch groups have an active instructor assignment." />
        ) : (
          <OperationalTable
            columns={[
              { key: 'group', header: 'Group', cell: (r: typeof by_group[number]) => (
                <Link href={`/portal/team-leader/groups/${r.group_id}`} className="font-medium text-[#0B1F3A] hover:text-[#FF8A1F]">{r.group_name}</Link>
              ) },
              ...(user.branchIds.length > 1 ? [{ key: 'branch', header: 'Branch', cell: (r: typeof by_group[number]) => <span className="text-[#64748B]">{r.branch_name ?? '—'}</span> }] : []),
              { key: 'students', header: 'Students', align: 'right', cell: (r: typeof by_group[number]) => <span className="text-[#64748B]">{r.student_count}</span> },
              { key: 'evaluated', header: 'Evaluated', align: 'right', cell: (r: typeof by_group[number]) => <span className="text-[#64748B]">{r.evaluated_count}</span> },
              { key: 'completion', header: 'Completion', cell: (r: typeof by_group[number]) => <MetricPill label={`${r.completion_pct}%`} variant={completionVariant(r.completion_pct)} /> },
            ]}
            rows={by_group}
            keyFn={r => r.group_id}
          />
        )
      )}

      {/* ── BY INSTRUCTOR ────────────────────────────────────────────────── */}
      {view === 'instructors' && (
        by_instructor.length === 0 ? (
          <EmptyState title="No instructor data yet" description="No branch instructors are currently teaching an active group." />
        ) : (
          <OperationalTable
            columns={[
              { key: 'instructor', header: 'Instructor', cell: (r: typeof by_instructor[number]) => (
                <Link href="/portal/team-leader/instructors" className="font-medium text-[#0B1F3A] hover:text-[#FF8A1F]">{r.instructor_name}</Link>
              ) },
              { key: 'students', header: 'Students', align: 'right', cell: (r: typeof by_instructor[number]) => <span className="text-[#64748B]">{r.student_count}</span> },
              { key: 'evaluated', header: 'Evaluated', align: 'right', cell: (r: typeof by_instructor[number]) => <span className="text-[#64748B]">{r.evaluated_count}</span> },
              { key: 'completion', header: 'Completion', cell: (r: typeof by_instructor[number]) => <MetricPill label={`${r.completion_pct}%`} variant={completionVariant(r.completion_pct)} /> },
            ]}
            rows={by_instructor}
            keyFn={r => r.instructor_id}
          />
        )
      )}
    </div>
  )
}
