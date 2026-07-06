import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getStudentDashboardData,
  getStudentAttendanceHistory,
} from '@/modules/student-portal/queries'
import Link from 'next/link'
import { formatDateWithWeekday } from '@/lib/format-date'

const STATUS_CONFIG: Record<string, { label: string; emoji: string; tagBg: string; tagFg: string; iconBg: string }> = {
  present: { label: 'Present', emoji: '✓',  tagBg: '#E7F8EE', tagFg: '#15803D', iconBg: '#E7F8EE' },
  absent:  { label: 'Absent',  emoji: '✕',  tagBg: '#FEF2F2', tagFg: '#DC2626', iconBg: '#FEF2F2' },
  late:    { label: 'Late',    emoji: '⏰', tagBg: '#FFF7E6', tagFg: '#B45309', iconBg: '#FEF3C7' },
  excused: { label: 'Excused', emoji: '📋', tagBg: '#E6F6FE', tagFg: '#0369A1', iconBg: '#E6F6FE' },
  makeup:  { label: 'Makeup',  emoji: '🔁', tagBg: '#F3E8FF', tagFg: '#7E22CE', iconBg: '#F3E8FF' },
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
          <p className="text-[17px] font-bold text-[#0B1F3A]">Sessions</p>
          <p className="mt-0.5 text-[12px] text-[#64748B]">
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
          { label: 'Present', value: present, iconBg: '#E7F8EE', valueFg: '#15803D', emoji: '✓' },
          { label: 'Late',    value: late,    iconBg: '#FEF3C7', valueFg: '#B45309', emoji: '⏰' },
          { label: 'Absent',  value: absent,  iconBg: '#FEF2F2', valueFg: '#DC2626', emoji: '✕' },
        ].map(({ label, value, iconBg, valueFg, emoji }) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl border border-[#e7ebf1] bg-white p-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] text-lg"
              style={{ background: iconBg }}
            >
              {emoji}
            </div>
            <div>
              <p className="text-[10.5px] font-semibold text-[#64748B]">{label}</p>
              <p
                className="text-[22px] font-bold leading-tight"
                style={{ fontFamily: 'var(--font-orbitron)', color: valueFg }}
              >
                {value}
              </p>
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
        <div className="overflow-hidden rounded-2xl border border-[#e7ebf1] bg-white">
          <div className="border-b border-[#f1f4f8] px-5 py-4">
            <p className="text-[14px] font-bold text-[#0B1F3A]">Session History</p>
            <p className="mt-0.5 text-[11px] text-[#64748B]">{records.length} session{records.length !== 1 ? 's' : ''} total</p>
          </div>

          <div className="divide-y divide-[#f1f4f8]">
            {records.map((r) => {
              const cfg = r.status ? (STATUS_CONFIG[r.status] ?? { label: r.status, emoji: '•', tagBg: '#F1F5F9', tagFg: '#475569', iconBg: '#F1F5F9' }) : null
              return (
                <div
                  key={`${r.session_num}-${r.date}`}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  {/* Icon */}
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-base"
                    style={{ background: cfg?.iconBg ?? '#F1F5F9' }}
                  >
                    {cfg?.emoji ?? '•'}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-[#0B1F3A]">
                      {r.topic ?? <span className="italic text-[#94A3B8]">Session #{r.session_num}</span>}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#64748B]">
                      #{r.session_num} · {formatDateWithWeekday(r.date)}
                    </p>
                  </div>

                  {/* Status badge */}
                  {cfg && (
                    <span
                      className="shrink-0 rounded-full px-[11px] py-1 text-[10.5px] font-bold"
                      style={{ background: cfg.tagBg, color: cfg.tagFg }}
                    >
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
