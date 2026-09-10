import type { GroupOperationalRow } from '@/modules/groups/operational'
import { StatusChip } from './StatusChip'
import { DAYS_FULL, fmt12, fmtDateShort } from '../utils'
import { getCohortLifecycleStage } from '@/modules/groups/lifecycle-stage'

function ProgressMetric({ label, detail, value, color }: { label: string; detail: string; value: number | null; color: string }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value))
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</span>
        <span className="shrink-0 text-[11px] font-bold text-[#0B1F3A]">{detail}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#E2E8F0]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function GroupListItem({ group, selected, onClick }: { group: GroupOperationalRow; selected: boolean; onClick: () => void }) {
  const sessionPct = group.planned_sessions && group.planned_sessions > 0
    ? Math.round((group.completed_sessions / group.planned_sessions) * 100)
    : null
  const sessionDetail = group.planned_sessions != null
    ? `${group.completed_sessions} / ${group.planned_sessions} sessions`
    : group.open_ended ? `${group.completed_sessions} sessions` : 'Not planned'
  const paymentDetail = group.payment_completion_pct != null ? `${group.payment_completion_pct}% collected` : 'No payment plan'
  const paymentStatus = group.payment_completion_pct == null
    ? 'unknown'
    : group.payment_completion_pct < 70 ? 'follow-up'
    : group.payment_completion_pct < 90 ? 'watch'
    : 'healthy'
  const paymentColor = paymentStatus === 'follow-up'
    ? 'bg-[#EF4444]'
    : paymentStatus === 'watch'
      ? 'bg-[#F59E0B]'
      : 'bg-[#10B981]'
  const schedule = group.day_of_week
    ? `${DAYS_FULL[group.day_of_week] ?? group.day_of_week}${group.start_time ? ` · ${fmt12(group.start_time)}` : ''}`
    : 'Schedule not set'
  const stage = getCohortLifecycleStage(group)
  const stageClass = stage === 'running'
    ? 'border-l-4 border-l-[#10B981] bg-[#F0FDF4]/50'
    : stage === 'completed'
      ? 'border-l-4 border-l-[#6366F1] bg-[#EEF2FF]/50'
      : stage === 'draft'
        ? 'border-l-4 border-l-[#F59E0B] bg-[#FFFBEB]/50'
        : 'border-l-4 border-l-[#CBD5E1]'

  return (
    <button onClick={onClick} className={[
      'w-full rounded-xl border bg-white p-2 text-left transition content-visibility-auto',
      stageClass,
      selected ? 'border-[#FF8A1F] ring-2 ring-[#FF8A1F]/15' : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-sm',
    ].join(' ')} data-group-stage={stage} data-payment-status={paymentStatus}>
      <div className="flex flex-col gap-1.5 xl:flex-row xl:items-center">
        <div className="min-w-0 xl:w-[25%]">
          <div className="flex items-center gap-2"><p className="truncate text-[15px] font-bold text-[#0B1F3A]">{group.name}</p><StatusChip group={group} /></div>
          <p className="mt-0.5 truncate text-[11px] text-[#64748B]">{group.course_name ?? 'Course not assigned'} <span className="text-[#CBD5E1]">·</span> {group.branch_name}</p>
          <p className="mt-0.5 text-[11px] font-medium text-[#475569]">{schedule}{group.start_date ? ` · Started ${fmtDateShort(group.start_date)}` : ''}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-[12px] sm:grid-cols-4 xl:w-[35%]">
          <div className="sm:col-span-2"><p className="text-[#94A3B8]">Instructor</p><p className="font-semibold text-[#0B1F3A]">{group.lead_instructor_name ?? 'Unassigned'}</p></div>
          <div><p className="text-[#94A3B8]">Students</p><p className="font-semibold text-[#0B1F3A]">{group.student_count}{group.capacity ? ` / ${group.capacity}` : ''}</p></div>
          <div><p className="text-[#94A3B8]">Attendance</p><p className="font-semibold text-[#0B1F3A]">{group.attendance_avg}%</p></div>
          <div><p className="text-[#94A3B8]">Health</p><p className="font-semibold text-[#0B1F3A]">{group.health_score}%</p></div>
        </div>
        <div className="grid flex-1 gap-2 sm:grid-cols-2 xl:min-w-[23rem]">
          <ProgressMetric label="Sessions" detail={sessionDetail} value={sessionPct} color="bg-[#FF8A1F]" />
          <ProgressMetric label="Fees" detail={paymentDetail} value={group.payment_completion_pct} color={paymentColor} />
        </div>
      </div>
    </button>
  )
}
