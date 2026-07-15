import Link from 'next/link'
import type { LearningCard as LearningCardData } from '@/modules/student-portal/types'

const DAY_LABELS: Record<string, string> = {
  sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
}

function formatTime(t: string | null): string {
  if (!t) return ''
  try {
    const [h, m] = t.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const hour   = h % 12 || 12
    return `${hour}:${m.toString().padStart(2, '0')} ${period}`
  } catch {
    return t
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function MiniBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

const CERT_STATUS_CONFIG = {
  issued:      { label: 'Certificate issued',  cls: 'bg-[#E7F8EE] text-[#15803D]' },
  eligible:    { label: 'Certificate ready 🎉', cls: 'bg-[#FFFBEB] text-[#B45309]' },
  in_progress: { label: 'In progress',          cls: 'bg-[#F1F5F9] text-[#64748B]' },
} as const

export default function LearningCard({ data }: { data: LearningCardData }) {
  const sessionPct = data.enrolled_sessions > 0
    ? Math.round((data.consumed_sessions / data.enrolled_sessions) * 100)
    : 0

  const nextClassLabel = data.day_of_week
    ? `${DAY_LABELS[data.day_of_week.toLowerCase()] ?? data.day_of_week}${data.group_time ? ` ${formatTime(data.group_time)}` : ''}`
    : null

  const cert = CERT_STATUS_CONFIG[data.certificate_status]

  return (
    <div className="ds-card p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold text-[#0B1F3A]">
            {data.course_title ?? 'General Sessions'}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] text-[#64748B]">
            {data.group_name ?? '—'}{data.instructor_name ? ` · ${data.instructor_name}` : ''}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${cert.cls}`}>
          {cert.label}
        </span>
      </div>

      {/* Sessions progress */}
      <div className="mt-3">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[11px] font-semibold text-[#64748B]">Sessions</span>
          <span className="text-[11px] font-bold text-[#0B1F3A]">
            {data.consumed_sessions}/{data.enrolled_sessions || '—'}
          </span>
        </div>
        <MiniBar value={sessionPct} color="#FF8A1F" />
      </div>

      {/* Attendance + Progress mini stats */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[10.5px] font-semibold text-[#64748B]">Attendance</span>
            <span className="text-[10.5px] font-bold text-[#15803D]">{data.att_pct}%</span>
          </div>
          <MiniBar value={data.att_pct} color="#10B981" />
        </div>
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[10.5px] font-semibold text-[#64748B]">Progress</span>
            <span className="text-[10.5px] font-bold text-[#1D4ED8]">
              {data.progress_pct != null ? `${Math.round(data.progress_pct)}%` : '—'}
            </span>
          </div>
          <MiniBar value={data.progress_pct ?? 0} color="#3B82F6" />
        </div>
      </div>

      {/* Upcoming session */}
      <div className="mt-3 rounded-xl bg-[#F8FAFC] px-3 py-2">
        {data.next_session_at ? (
          <p className="text-[11.5px] text-[#0B1F3A]">
            Next class: <span className="font-bold">{formatDate(data.next_session_at)}</span>
            {data.next_session_topic && <span className="text-[#64748B]"> · {data.next_session_topic}</span>}
          </p>
        ) : nextClassLabel ? (
          <p className="text-[11.5px] text-[#0B1F3A]">
            Regular schedule: <span className="font-bold">{nextClassLabel}</span>
          </p>
        ) : (
          <p className="text-[11.5px] text-[#64748B]">No upcoming session scheduled.</p>
        )}
      </div>

      {/* Quick actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/portal/student/attendance"
          className="rounded-full border border-[#E2E8F0] px-3 py-1.5 text-[11px] font-semibold text-[#475569] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
        >
          View Attendance
        </Link>
        {data.certificate_status !== 'in_progress' && (
          <Link
            href="/portal/student/certificates"
            className="rounded-full border border-[#E2E8F0] px-3 py-1.5 text-[11px] font-semibold text-[#475569] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
          >
            {data.certificate_status === 'issued' ? 'Download Certificate' : 'Claim Certificate'}
          </Link>
        )}
        <Link
          href="/portal/student/assignments"
          className="rounded-full bg-[#FF8A1F] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#E67A15]"
        >
          Continue Learning →
        </Link>
      </div>
    </div>
  )
}
