import Link from 'next/link'
import StatusBadge from '@/components/admin/StatusBadge'
import type { TodaySession } from '@/modules/instructor-portal/types'

const STATUS_ACTION: Record<string, { label: string; style: string }> = {
  scheduled:             { label: 'Start Session',     style: 'bg-[#10B981] text-white hover:bg-emerald-600' },
  ongoing:               { label: 'Continue Session',  style: 'bg-[#FF8A1F] text-white hover:bg-[#e07818]' },
  completed:             { label: 'View Session',      style: 'bg-[#F1F5F9] text-[#0B1F3A] hover:bg-[#E2E8F0]' },
  postponed:             { label: 'View Details',      style: 'bg-[#F1F5F9] text-[#0B1F3A] hover:bg-[#E2E8F0]' },
  cancelled:             { label: 'View Session',      style: 'bg-[#F1F5F9] text-[#94A3B8] hover:bg-[#E2E8F0]' },
  cancelled_with_makeup: { label: 'View Session',      style: 'bg-[#F1F5F9] text-[#94A3B8] hover:bg-[#E2E8F0]' },
}

interface Props {
  session:  TodaySession
  groupId?: string
}

export default function TodaySessionCard({ session, groupId }: Props) {
  const gid    = groupId ?? session.group_id
  const href   = gid
    ? `/portal/instructor/groups/${gid}`
    : '/portal/instructor/groups'
  const action = STATUS_ACTION[session.status] ?? STATUS_ACTION.scheduled

  const time = new Date(session.scheduled_at).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  })
  const endTime = new Date(
    new Date(session.scheduled_at).getTime() + session.duration_minutes * 60_000
  ).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="ds-card flex flex-col gap-3 p-4">
      {/* Top row: group + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[#0B1F3A]">{session.group_name}</p>
          <p className="truncate text-xs text-[#64748B]">{session.course_title}</p>
        </div>
        <StatusBadge status={session.status} />
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <span className="text-[#94A3B8]">Branch</span>
        <span className="font-medium text-[#0B1F3A] truncate">{session.branch_name || '—'}</span>

        <span className="text-[#94A3B8]">Time</span>
        <span className="font-medium text-[#0B1F3A]">{time} – {endTime}</span>

        <span className="text-[#94A3B8]">Duration</span>
        <span className="font-medium text-[#0B1F3A]">{session.duration_minutes} min</span>

        <span className="text-[#94A3B8]">Students</span>
        <span className="font-medium text-[#0B1F3A]">{session.student_count}</span>

        {session.session_number != null && (
          <>
            <span className="text-[#94A3B8]">Session #</span>
            <span className="font-medium text-[#0B1F3A]">#{session.session_number}</span>
          </>
        )}
      </div>

      {/* Action button */}
      <Link
        href={href}
        className={`block rounded-lg px-4 py-2 text-center text-xs font-semibold transition ${action.style}`}
      >
        {action.label}
      </Link>
    </div>
  )
}
