import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getStudentDashboardData,
  getStudentAttendanceHistory,
} from '@/modules/student-portal/queries'
import Link from 'next/link'
import { formatDateWithWeekday } from '@/lib/format-date'

// This page is a topic-first session log ("what did we cover each class?").
// `/portal/student/attendance` is the stats-first view of the same underlying
// records ("how's my attendance rate?") — kept as a separate nav destination
// deliberately, but sharing the same status colors/card styling.
const STATUS_CONFIG: Record<string, { label: string; emoji: string; cls: string; iconBg: string }> = {
  present: { label: 'Present', emoji: '✓',  cls: 'bg-[#E7F8EE] text-[#15803D]', iconBg: 'bg-[#E7F8EE]' },
  absent:  { label: 'Absent',  emoji: '✕',  cls: 'bg-[#FEE2E2] text-[#DC2626]', iconBg: 'bg-[#FEE2E2]' },
  late:    { label: 'Late',    emoji: '⏰', cls: 'bg-yellow-100 text-yellow-700', iconBg: 'bg-[#FEF3C7]' },
  excused: { label: 'Excused', emoji: '📋', cls: 'bg-[#EFF6FF] text-[#1D4ED8]', iconBg: 'bg-[#E6F6FE]' },
  makeup:  { label: 'Makeup',  emoji: '🔁', cls: 'bg-purple-100 text-purple-700', iconBg: 'bg-[#F3E8FF]' },
}

export default async function StudentSessionsPage() {
  const user = await requirePortalRole('student')

  const [data, records] = await Promise.all([
    getStudentDashboardData(user.id),
    getStudentAttendanceHistory(user.id),
  ])

  if (!data) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-[#64748B]">
        No student record found.
      </div>
    )
  }

  const present = records.filter(r => r.status === 'present').length
  const late    = records.filter(r => r.status === 'late').length
  const absent  = records.filter(r => r.status === 'absent').length

  return (
    <div className="mx-auto max-w-3xl space-y-4">

      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-[#0B1F3A]">Sessions</h1>
          <p className="mt-0.5 text-xs text-[#64748B]">
            {data.group_name ?? 'No group enrolled'}{data.course_title ? ` · ${data.course_title}` : ''}
          </p>
        </div>
        <Link href="/portal/student/attendance" className="shrink-0 text-xs font-semibold text-[#FF8A1F] hover:underline">
          View stats →
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Present', value: present, iconBg: 'bg-[#E7F8EE]', valueFg: 'text-[#15803D]', emoji: '✓' },
          { label: 'Late',    value: late,    iconBg: 'bg-[#FEF3C7]', valueFg: 'text-yellow-600', emoji: '⏰' },
          { label: 'Absent',  value: absent,  iconBg: 'bg-[#FEE2E2]', valueFg: 'text-[#EF4444]',  emoji: '✕' },
        ].map(({ label, value, iconBg, valueFg, emoji }) => (
          <div key={label} className="ds-card flex items-center gap-3 p-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] text-lg ${iconBg}`}>
              {emoji}
            </div>
            <div>
              <p className="text-[10.5px] font-semibold text-[#64748B]">{label}</p>
              <p className={`text-xl font-bold leading-tight ${valueFg}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Session list */}
      {records.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-[#E2E8F0] text-sm text-[#64748B]">
          No sessions recorded yet.
        </div>
      ) : (
        <div className="ds-card overflow-hidden">
          <div className="border-b border-[#F1F5F9] px-5 py-3.5">
            <p className="text-sm font-semibold text-[#0B1F3A]">Session History</p>
            <p className="mt-0.5 text-[11px] text-[#64748B]">{records.length} session{records.length !== 1 ? 's' : ''} total</p>
          </div>

          <div className="divide-y divide-[#F1F5F9]">
            {records.map((r) => {
              const cfg = r.status ? (STATUS_CONFIG[r.status] ?? { label: r.status, emoji: '•', cls: 'bg-[#F3F4F6] text-[#4B5563]', iconBg: 'bg-[#F1F5F9]' }) : null
              return (
                <div
                  key={`${r.session_num}-${r.date}`}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  {/* Icon */}
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-base ${cfg?.iconBg ?? 'bg-[#F1F5F9]'}`}>
                    {cfg?.emoji ?? '•'}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-[#0B1F3A]">
                      {r.topic ?? <span className="italic text-[#64748B]">Session #{r.session_num}</span>}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#64748B]">
                      #{r.session_num} · {formatDateWithWeekday(r.date)}
                    </p>
                  </div>

                  {/* Status badge */}
                  {cfg && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
