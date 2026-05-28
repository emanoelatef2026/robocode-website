import { getCurrentUser }      from '@/modules/rbac/guards'
import { redirect, notFound }   from 'next/navigation'
import {
  resolveGroupFilter,
  getSemesterOverview,
} from '@/modules/analytics/queries'
import Link from 'next/link'

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
      <p className="text-xs text-[#94A3B8] uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-3xl font-bold text-[#0B1F3A]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[#94A3B8]">{sub}</p>}
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 75 ? 'bg-green-400' :
    value >= 50 ? 'bg-amber-400' :
                  'bg-red-400'
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-[#64748B]">{label}</span>
        <span className="font-semibold text-[#0B1F3A]">{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-[#F1F5F9]">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  )
}

export default async function SemesterOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const groupFilter = await resolveGroupFilter(user)
  const overview    = await getSemesterOverview(id, groupFilter)

  if (!overview) notFound()

  const passRate = overview.total_students
    ? Math.round((overview.completed_students / overview.total_students) * 100)
    : 0

  return (
    <div className="space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#0B1F3A]">{overview.semester_name}</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">Semester overview</p>
        </div>
        <Link
          href="/dashboard/analytics"
          className="text-sm text-[#FF8A1F] hover:underline"
        >
          ← Overview
        </Link>
      </div>

      {/* ── Student status cards ────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-[#0B1F3A]">Student Status</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Students" value={overview.total_students} />
          <StatCard
            label="Active"
            value={overview.active_students}
            sub={`${overview.total_students ? Math.round((overview.active_students / overview.total_students) * 100) : 0}% of total`}
          />
          <StatCard
            label="Completed"
            value={overview.completed_students}
            sub={`${passRate}% pass rate`}
          />
          <StatCard
            label="Failed"
            value={overview.failed_students}
            sub={`${overview.total_students ? Math.round((overview.failed_students / overview.total_students) * 100) : 0}% of total`}
          />
        </div>
      </div>

      {/* ── Average scores ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-[#0B1F3A]">Average Scores</h2>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-5">
          <ScoreBar label="Completion"  value={overview.avg_completion}  />
          <ScoreBar label="Attendance"  value={overview.avg_attendance}  />
          <ScoreBar label="Assignments" value={overview.avg_assignment}  />
          <ScoreBar label="Portfolio"   value={overview.avg_portfolio}   />
        </div>
      </div>

      {/* ── Score summary pills ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Avg Completion',  value: overview.avg_completion  },
          { label: 'Avg Attendance',  value: overview.avg_attendance  },
          { label: 'Avg Assignments', value: overview.avg_assignment  },
          { label: 'Avg Portfolio',   value: overview.avg_portfolio   },
        ].map(({ label, value }) => {
          const cls =
            value >= 75 ? 'bg-green-50 text-green-700' :
            value >= 50 ? 'bg-amber-50 text-amber-700' :
                          'bg-red-50 text-red-600'
          return (
            <div key={label} className="rounded-xl border border-[#E2E8F0] bg-white p-5">
              <p className="text-xs text-[#94A3B8] uppercase tracking-wide">{label}</p>
              <p className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-bold ${cls}`}>
                {value.toFixed(1)}%
              </p>
            </div>
          )
        })}
      </div>

    </div>
  )
}
