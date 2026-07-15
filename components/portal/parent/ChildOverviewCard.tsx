import Link from 'next/link'
import StatusBadge from '@/components/admin/StatusBadge'
import { EVALUATION_CRITERION_LABELS } from '@/modules/student-evaluations/types'
import type { ChildOverviewCard as ChildOverviewCardData } from '@/modules/parents/parent-portal-queries'

function fmt(n: number) {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

export default function ChildOverviewCard({ data }: { data: ChildOverviewCardData }) {
  const initials = data.student_name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?'
  const qs = `?child=${data.student_id}`

  return (
    <div className="ds-card p-4">
      {/* Identity row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {data.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.avatar_url} alt={data.student_name} className="h-11 w-11 shrink-0 rounded-full object-cover" />
          ) : (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #FF8A1F, #0B1F3A)' }}
            >
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-bold text-[#0B1F3A]">{data.student_name}</p>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#64748B]">
              {data.branch_name && <span className="truncate">{data.branch_name}</span>}
              <StatusBadge status={data.status} dot />
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-[#F8FAFC] p-2">
          <p className="text-[15px] font-bold text-[#0B1F3A]">{data.active_courses}</p>
          <p className="text-[10px] text-[#64748B]">{data.active_courses === 1 ? 'Course' : 'Courses'}</p>
        </div>
        <div className="rounded-lg bg-[#F8FAFC] p-2">
          <p className={`text-[15px] font-bold ${
            data.attendance_pct == null ? 'text-[#64748B]' : data.attendance_pct >= 75 ? 'text-[#10B981]' : 'text-[#EF4444]'
          }`}>
            {data.attendance_pct != null ? `${data.attendance_pct}%` : '—'}
          </p>
          <p className="text-[10px] text-[#64748B]">Attendance</p>
        </div>
        <div className="rounded-lg bg-[#F8FAFC] p-2">
          <p className={`text-[15px] font-bold ${
            data.outstanding_balance == null ? 'text-[#64748B]' : data.outstanding_balance > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'
          }`}>
            {data.outstanding_balance != null ? (data.outstanding_balance > 0 ? `EGP ${fmt(data.outstanding_balance)}` : 'Paid ✓') : '—'}
          </p>
          <p className="text-[10px] text-[#64748B]">Balance</p>
        </div>
      </div>

      {/* Latest evaluation + achievement */}
      {(data.latest_evaluation || data.latest_achievement) && (
        <div className="mt-3 space-y-1.5 border-t border-[#F1F5F9] pt-3">
          {data.latest_evaluation && (
            <p className="text-[11.5px] text-[#475569]">
              <span className="font-semibold text-[#0B1F3A]">Latest evaluation:</span>{' '}
              {EVALUATION_CRITERION_LABELS[data.latest_evaluation.criterion as keyof typeof EVALUATION_CRITERION_LABELS] ?? data.latest_evaluation.criterion}
              {data.latest_evaluation.rating != null && ` · ${data.latest_evaluation.rating}★`}
              {data.latest_evaluation.score != null && ` · ${data.latest_evaluation.score}`}
            </p>
          )}
          {data.latest_achievement && (
            <p className="text-[11.5px] text-[#475569]">
              <span className="font-semibold text-[#0B1F3A]">Latest achievement:</span> {data.latest_achievement.title}
            </p>
          )}
        </div>
      )}

      {/* Certificates / Competitions chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {data.certificates_count > 0 && (
          <span className="rounded-full bg-[#FFF7ED] px-2.5 py-1 text-[10.5px] font-semibold text-[#FF8A1F]">
            📜 {data.certificates_count} certificate{data.certificates_count !== 1 ? 's' : ''}
          </span>
        )}
        {data.competitions_count > 0 && (
          <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[10.5px] font-semibold text-purple-700">
            🎖️ {data.competitions_count} competition{data.competitions_count !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Quick actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/portal/parent${qs}`}
          className="rounded-full bg-[#FF8A1F] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#E67A15]"
        >
          View {data.student_name.split(' ')[0]} →
        </Link>
        <Link
          href={`/portal/parent/finance${qs}`}
          className="rounded-full border border-[#E2E8F0] px-3 py-1.5 text-[11px] font-semibold text-[#475569] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
        >
          Payments
        </Link>
      </div>
    </div>
  )
}
