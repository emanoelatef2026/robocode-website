import { requirePortalRole, requirePermission } from '@/modules/rbac/guards'
import { getTLCompetitionOverview }             from '@/modules/tl-analytics/queries'
import Link                                     from 'next/link'
import { StatCard, SectionCard, OperationalTable, MetricPill, EmptyState } from '../_components/ui'

interface Props {
  searchParams: Promise<{ view?: string }>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function rateVariant(pct: number): 'green' | 'amber' | 'red' {
  return pct >= 50 ? 'green' : pct >= 20 ? 'amber' : 'red'
}

export default async function TLCompetitionsPage({ searchParams }: Props) {
  const user = await requirePortalRole('team_leader')
  await requirePermission('manage_competitions')

  const params = await searchParams
  const view   = params.view ?? 'overview'

  const overview = await getTLCompetitionOverview(user.branchIds)
  const { kpis, by_group, by_instructor, winners, recent_activity } = overview

  function tabUrl(v: string) {
    return v === 'overview' ? '/portal/team-leader/competitions' : `/portal/team-leader/competitions?view=${v}`
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-bold text-[#0B1F3A]">Competition Oversight</h1>
        <p className="mt-0.5 text-[12px] text-[#64748B]">
          Read-only view of recorded competition participation and results across your branches.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Participation" value={`${kpis.participation_pct}%`} accent={rateVariant(kpis.participation_pct)} sub={`${kpis.participating_count}/${kpis.total_active_students} students`} />
        <StatCard label="Winners"        value={kpis.winners_count} accent={kpis.winners_count > 0 ? 'green' : 'slate'} sub="rank or award recorded" />
        <StatCard label="This Year"      value={kpis.recent_count}  accent="blue" sub={`recorded in ${new Date().getFullYear()}`} />
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
          <SectionCard title={`Winners (${winners.length})`} noPad>
            {winners.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No results recorded yet" description="No students have a rank or award on record." />
              </div>
            ) : (
              <OperationalTable
                columns={[
                  { key: 'student', header: 'Student', cell: (r: typeof winners[number]) => <span className="font-medium text-[#0B1F3A]">{r.student_name}</span> },
                  { key: 'competition', header: 'Competition', cell: (r: typeof winners[number]) => (
                    <div>
                      <p className="text-[#374151]">{r.competition_name}</p>
                      <p className="text-[11px] text-[#94A3B8]">{r.year}</p>
                    </div>
                  ) },
                  { key: 'result', header: 'Result', cell: (r: typeof winners[number]) => (
                    <span className="text-[#374151]">{[r.rank, r.award].filter(Boolean).join(' · ') || '—'}</span>
                  ) },
                ]}
                rows={winners}
                keyFn={r => r.id}
              />
            )}
          </SectionCard>

          <SectionCard title="Recent Activity" noPad>
            {recent_activity.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No competition records" description="No competition history recorded for your branches yet." />
              </div>
            ) : (
              <OperationalTable
                columns={[
                  { key: 'student', header: 'Student', cell: (r: typeof recent_activity[number]) => <span className="font-medium text-[#0B1F3A]">{r.student_name}</span> },
                  { key: 'competition', header: 'Competition', cell: (r: typeof recent_activity[number]) => <span className="text-[#374151]">{r.competition_name}</span> },
                  { key: 'result', header: 'Result', cell: (r: typeof recent_activity[number]) => (
                    r.rank || r.award
                      ? <MetricPill label={[r.rank, r.award].filter(Boolean).join(' · ')} variant="green" />
                      : <span className="text-[11px] text-[#94A3B8]">Recorded</span>
                  ) },
                  { key: 'when', header: 'When', align: 'right', cell: (r: typeof recent_activity[number]) => <span className="text-[#64748B]">{formatDate(r.created_at)}</span> },
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
              { key: 'participating', header: 'Participating', align: 'right', cell: (r: typeof by_group[number]) => <span className="text-[#64748B]">{r.participating_count}</span> },
              { key: 'rate', header: 'Participation', cell: (r: typeof by_group[number]) => <MetricPill label={`${r.participation_pct}%`} variant={rateVariant(r.participation_pct)} /> },
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
              { key: 'participating', header: 'Participating', align: 'right', cell: (r: typeof by_instructor[number]) => <span className="text-[#64748B]">{r.participating_count}</span> },
              { key: 'rate', header: 'Participation', cell: (r: typeof by_instructor[number]) => <MetricPill label={`${r.participation_pct}%`} variant={rateVariant(r.participation_pct)} /> },
            ]}
            rows={by_instructor}
            keyFn={r => r.instructor_id}
          />
        )
      )}
    </div>
  )
}
