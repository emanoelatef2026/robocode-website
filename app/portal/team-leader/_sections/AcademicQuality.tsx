import Link from 'next/link'
import { getAcademicQualityData } from '@/modules/tl-dashboard/dashboard-v2-queries'
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
  const color = value >= 75 ? 'text-emerald-600' : value >= 55 ? 'text-amber-600' : 'text-red-600'
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
  const data = await getAcademicQualityData(branchIds)

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
          colorCls={data.attendance_rate >= 75 ? 'text-emerald-600' : data.attendance_rate >= 55 ? 'text-amber-600' : 'text-red-600'}
        />
        <QualityTile
          label="Homework Rate"
          value={`${data.homework_rate}%`}
          href="/portal/team-leader/assignments"
          colorCls={data.homework_rate >= 75 ? 'text-emerald-600' : data.homework_rate >= 55 ? 'text-amber-600' : 'text-red-600'}
        />
        <QualityTile
          label="Pending Reviews"
          value={String(data.pending_reviews)}
          sub="portfolios"
          href="/portal/team-leader/assignments?filter=pending"
          colorCls={data.pending_reviews > 5 ? 'text-amber-600' : 'text-[#0B1F3A]'}
        />
        <QualityTile
          label="Low Engagement"
          value={String(data.low_engagement_groups)}
          sub="groups < 60% att"
          colorCls={data.low_engagement_groups > 0 ? 'text-red-600' : 'text-emerald-600'}
        />
        <QualityTile
          label="No Session 7d"
          value={String(data.groups_no_session_7d)}
          sub="active groups"
          colorCls={data.groups_no_session_7d > 0 ? 'text-amber-600' : 'text-[#0B1F3A]'}
        />
        <QualityTile
          label="Submission Rate"
          value={`${data.submission_rate}%`}
          href="/portal/team-leader/assignments"
          colorCls={data.submission_rate >= 70 ? 'text-emerald-600' : 'text-amber-600'}
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
    </section>
  )
}
