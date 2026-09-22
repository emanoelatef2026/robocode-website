import type { GroupOperationalRow } from '@/modules/groups/operational'
import { StatusChip } from './StatusChip'
import { DAYS_FULL, fmt12, fmtDateShort } from '../utils'
import { getCohortLifecycleStage } from '@/modules/groups/lifecycle-stage'

function ProgressMetric({ label, detail, secondaryDetail, belowDetail, value, color }: {
  label: string
  detail: string
  secondaryDetail?: string
  belowDetail?: string
  value: number | null
  color: string
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value))
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#64748B]">{label}</span>
        <span className="shrink-0 text-[13px] font-semibold text-[#0B1F3A]">{detail}</span>
      </div>
      <p className="mb-1 min-h-4 truncate text-[11px] font-medium text-[#64748B]">
        {secondaryDetail ?? '\u00A0'}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#E2E8F0]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 min-h-4 truncate text-[11px] font-medium text-[#64748B]">
        {belowDetail ?? '\u00A0'}
      </p>
    </div>
  )
}

function formatEgp(amount: number): string {
  return `EGP ${Math.max(0, Math.round(amount)).toLocaleString('en-EG')}`
}

export function GroupListItem({ group, selected, onClick }: { group: GroupOperationalRow; selected: boolean; onClick: () => void }) {
  const sessionPct = group.planned_sessions && group.planned_sessions > 0
    ? Math.round((group.completed_sessions / group.planned_sessions) * 100)
    : null
  const sessionDetail = group.planned_sessions != null
    ? `${group.completed_sessions} / ${group.planned_sessions} sessions`
    : group.open_ended ? `${group.completed_sessions} sessions` : 'Not planned'
  const hasPaymentPlan = group.payment_total_amount > 0
  const paymentDetail = hasPaymentPlan ? `${group.payment_completion_pct ?? 0}% collected` : 'No payment plan'
  const paymentAmounts = hasPaymentPlan
    ? `${formatEgp(group.payment_paid_amount)} paid of ${formatEgp(group.payment_total_amount)}`
    : 'Add a contract to track fees'
  const paymentRemaining = Math.max(0, group.payment_total_amount - group.payment_paid_amount)
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
  return (
    <button onClick={onClick} className={[
      'w-full rounded-xl border border-[#D7E0EA] bg-white p-2 md:p-4 text-left transition-[border-color,box-shadow,background-color] content-visibility-auto',
      selected ? 'border-[#0E7490] bg-[#F7FCFD] ring-2 ring-[#0E7490]/15' : 'hover:border-[#B8C6D6] hover:bg-[#FCFDFE] hover:shadow-sm',
    ].join(' ')} data-group-stage={stage} data-payment-status={paymentStatus}>
      <div className="flex flex-col gap-1.5 xl:flex-row xl:items-center">
        <div className="min-w-0 xl:w-[25%]">
          <div className="flex items-center gap-2"><p className="truncate text-[15px] font-semibold text-[#0B1F3A]">{group.name}</p><StatusChip group={group} /></div>
          <p className="mt-1 truncate text-[13px] text-[#64748B]">{group.course_name ?? 'Course not assigned'} <span className="text-[#CBD5E1]">·</span> {group.branch_name}</p>
          <p className="mt-1 text-[13px] font-medium text-[#475569]">{schedule}{group.start_date ? ` · Started ${fmtDateShort(group.start_date)}` : ''}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-[13px] sm:grid-cols-4 xl:w-[35%]">
          <div className="sm:col-span-2"><p className="text-[#64748B]">Instructor</p><p className="font-semibold text-[#0B1F3A]">{group.lead_instructor_name ?? 'Unassigned'}</p></div>
          <div><p className="text-[#64748B]">Students</p><p className="font-semibold text-[#0B1F3A]">{group.student_count}{group.capacity ? ` / ${group.capacity}` : ''}</p></div>
          <div><p className="text-[#64748B]">Attendance</p><p className="font-semibold text-[#0B1F3A]">{group.attendance_avg}%</p></div>
          <div><p className="text-[#64748B]">Health</p><p className="font-semibold text-[#0B1F3A]">{group.health_score}%</p></div>
        </div>
        <div className="grid flex-1 gap-2 sm:grid-cols-2 xl:min-w-[23rem]">
          <ProgressMetric
            label="Sessions"
            detail={sessionDetail}
            secondaryDetail={group.planned_sessions != null ? `${Math.max(0, group.planned_sessions - group.completed_sessions)} sessions remaining` : undefined}
            value={sessionPct}
            color="bg-[#C2410C]"
          />
          <ProgressMetric
            label="Fees"
            detail={paymentDetail}
            secondaryDetail={paymentAmounts}
            belowDetail={hasPaymentPlan ? `${formatEgp(paymentRemaining)} remaining` : undefined}
            value={group.payment_completion_pct}
            color={paymentColor}
          />
        </div>
      </div>
    </button>
  )
}
