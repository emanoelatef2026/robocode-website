import Link from 'next/link'
import { getAcademicQualityData } from '@/modules/tl-dashboard/dashboard-v2-queries'
import { getTLAcademicOverviewKPIs } from '@/modules/tl-analytics/queries'
import { ScoreBar } from '../_components/RiskBadge'

function QualityTile({ label, value, sub, href, colorCls }: {
  label: string; value: string; sub?: string; href?: string; colorCls?: string
}) {
  const inner = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
      <p className={`mt-1.5 text-[22px] font-extrabold leading-none ${colorCls ?? 'text-[#0B1F3A]'}`}>{value}</p>
      {sub && <p className="mt-1 text-[10px] text-[#94A3B8]">{sub}</p>}
    </>
  )

  const cls = 'rounded-2xl border border-[#E2E8F0] bg-white p-4 transition hover:border-[#CBD5E1]'

  if (href) {
    return <Link href={href} className={cls}>{inner}</Link>
  }
  return <div className={cls}>{inner}</div>
}

function MetricRow({ label, value, href }: { label: string; value: number; href?: string }) {
  const color = value >= 75 ? 'text-[#10B981]' : value >= 55 ? 'text-[#F59E0B]' : 'text-[#EF4444]'
  return (
    <div className="flex items-center gap-3 border-b border-[#F1F5F9] px-4 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-[#0B1F3A]">{label}</p>
        <div className="mt-1.5">
          <ScoreBar value={value} />
        </div>
      </div>
      <span className={`shrink-0 text-[13px] font-bold ${color}`}>{value}%</span>
      {href && (
        <Link href={href} className="shrink-0 text-[10px] text-[#FF8A1F] hover:underline">View →</Link>
      )}
    </div>
  )
}

export default async function AcademicQuality({ branchIds }: { branchIds: string[] }) {
  const [data, oversight] = await Promise.all([
    getAcademicQualityData(branchIds),
    getTLAcademicOverviewKPIs(branchIds),
  ])

  return (
    <section id="academic">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-bold text-[#0B1F3A]">Academic Quality</h2>
        <Link href="/portal/team-leader/assignments" className="text-[12px] font-medium text-[#FF8A1F] hover:underline">
          Assignments →
        </Link>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-4">
        <QualityTile
          label="Attendance Rate"
          value={`${data.attendance_rate}%`}
          href="/portal/team-leader/groups"
          colorCls={data.attendance_rate >= 75 ? 'text-[#10B981]' : data.attendance_rate >= 55 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}
        />
        <QualityTile
          label="Homework Rate"
          value={`${data.homework_rate}%`}
          href="/portal/team-leader/assignments"
          colorCls={data.homework_rate >= 75 ? 'text-[#10B981]' : data.homework_rate >= 55 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}
        />
        <QualityTile
          label="Pending Reviews"
          value={String(data.pending_reviews)}
          sub="portfolios"
          href="/portal/team-leader/assignments?filter=pending"
          colorCls={data.pending_reviews > 5 ? 'text-[#F59E0B]' : 'text-[#0B1F3A]'}
        />
        <QualityTile
          label="Low Engagement"
          value={String(data.low_engagement_groups)}
          sub="groups < 60% att"
          colorCls={data.low_engagement_groups > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}
        />
        <QualityTile
          label="No Session 7d"
          value={String(data.groups_no_session_7d)}
          sub="active groups"
          colorCls={data.groups_no_session_7d > 0 ? 'text-[#F59E0B]' : 'text-[#0B1F3A]'}
        />
        <QualityTile
          label="Submission Rate"
          value={`${data.submission_rate}%`}
          href="/portal/team-leader/assignments"
          colorCls={data.submission_rate >= 70 ? 'text-[#10B981]' : 'text-[#F59E0B]'}
        />
      </div>

      {/* Metric bars */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden">
        <div className="border-b border-[#E2E8F0] px-4 py-3">
          <p className="text-[13px] font-semibold text-[#0B1F3A]">Performance Breakdown</p>
        </div>
        <MetricRow label="Monthly Attendance"    value={data.attendance_rate}    href="/portal/team-leader/groups" />
        <MetricRow label="Homework Completion"   value={data.homework_rate}      href="/portal/team-leader/assignments" />
        <MetricRow label="Submission Rate"       value={data.submission_rate}    href="/portal/team-leader/assignments" />
      </div>

      {/* Academic Oversight — evaluations, notes, competitions */}
      <div className="mt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-[#0B1F3A]">Academic Oversight</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
          <QualityTile
            label="Evaluation Completion"
            value={`${oversight.evaluation_completion_pct}%`}
            href="/portal/team-leader/evaluations"
            colorCls={oversight.evaluation_completion_pct >= 75 ? 'text-[#10B981]' : oversight.evaluation_completion_pct >= 50 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}
          />
          <QualityTile
            label="Notes Completion"
            value={`${oversight.notes_completion_pct}%`}
            href="/portal/team-leader/notes"
            colorCls={oversight.notes_completion_pct >= 75 ? 'text-[#10B981]' : oversight.notes_completion_pct >= 50 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}
          />
          <QualityTile
            label="Competition Participation"
            value={`${oversight.competition_participation_pct}%`}
            href="/portal/team-leader/competitions"
            colorCls={oversight.competition_participation_pct >= 50 ? 'text-[#10B981]' : oversight.competition_participation_pct >= 20 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}
          />
          <QualityTile
            label="Homework Completion"
            value={`${oversight.homework_completion_pct}%`}
            href="/portal/team-leader/assignments"
            colorCls={oversight.homework_completion_pct >= 75 ? 'text-[#10B981]' : oversight.homework_completion_pct >= 50 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QualityTile
            label="Missing Evaluations"
            value={String(oversight.students_missing_evaluation)}
            sub="students"
            href="/portal/team-leader/evaluations"
            colorCls={oversight.students_missing_evaluation > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}
          />
          <QualityTile
            label="Missing Notes"
            value={String(oversight.students_missing_notes)}
            sub="students"
            href="/portal/team-leader/notes"
            colorCls={oversight.students_missing_notes > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}
          />
          <QualityTile
            label="Groups Needing Attention"
            value={String(oversight.groups_requiring_attention)}
            sub="< 50% coverage"
            colorCls={oversight.groups_requiring_attention > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'}
          />
          <QualityTile
            label="Instructors Needing Follow-up"
            value={String(oversight.instructors_requiring_attention)}
            sub="< 50% coverage"
            href="/portal/team-leader/instructor-performance"
            colorCls={oversight.instructors_requiring_attention > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'}
          />
        </div>
      </div>
    </section>
  )
}
