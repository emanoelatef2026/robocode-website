import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getStudentDashboardData,
  getStudentAttendanceHistory,
} from '@/modules/student-portal/queries'
import Link from 'next/link'

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  present: { label: 'Present', cls: 'bg-green-100  text-green-700'  },
  absent:  { label: 'Absent',  cls: 'bg-red-100    text-red-700'    },
  late:    { label: 'Late',    cls: 'bg-yellow-100 text-yellow-700' },
  excused: { label: 'Excused', cls: 'bg-blue-100   text-blue-700'   },
  makeup:  { label: 'Makeup',  cls: 'bg-purple-100 text-purple-700' },
}

export default async function StudentAttendancePage() {
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

  const attendancePct = data.att_pct

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-[#0B1F3A]">Attendance</h1>
          <p className="text-xs text-[#64748B]">{data.group_name ?? 'No group enrolled'}</p>
        </div>
        <Link href="/portal/student" className="shrink-0 text-xs text-[#FF8A1F] hover:underline">← Dashboard</Link>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Present', value: data.att_present, color: 'text-green-600' },
          { label: 'Absent',  value: data.att_absent,  color: 'text-red-600'   },
          { label: 'Late',    value: data.att_late,    color: 'text-yellow-600' },
          { label: 'Total',   value: data.att_total,   color: 'text-[#0B1F3A]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-[#E2E8F0] bg-white p-3 text-center">
            <p className={`text-xl font-bold leading-none ${color}`}>{value}</p>
            <p className="mt-1 text-[10px] text-[#94A3B8]">{label}</p>
          </div>
        ))}
      </div>

      {/* Attendance rate bar */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[#0B1F3A]">Attendance Rate</p>
          <span className={`text-base font-bold ${attendancePct >= 75 ? 'text-green-600' : attendancePct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
            {attendancePct}%
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F1F5F9]">
          <div
            className={`h-full rounded-full transition-all ${attendancePct >= 75 ? 'bg-green-500' : attendancePct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${attendancePct}%` }}
          />
        </div>
      </div>

      {/* Session-by-session list */}
      {records.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] text-sm text-[#64748B]">
          No sessions recorded yet.
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="border-b border-[#E2E8F0] px-4 py-2.5">
            <p className="text-sm font-semibold text-[#0B1F3A]">{records.length} session{records.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Table header — desktop only */}
          <div className="hidden grid-cols-[64px_110px_1fr_90px] gap-3 border-b border-[#F1F5F9] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8] sm:grid">
            <span>#</span>
            <span>Date</span>
            <span>Topic</span>
            <span>Status</span>
          </div>

          <div className="divide-y divide-[#F1F5F9]">
            {records.map((r) => {
              const cfg = r.status ? (STATUS_CONFIG[r.status] ?? { label: r.status, cls: 'bg-gray-100 text-gray-600' }) : null
              return (
                <div
                  key={`${r.session_num}-${r.date}`}
                  className="flex items-center gap-3 px-4 py-3 sm:grid sm:grid-cols-[64px_110px_1fr_90px] sm:gap-3"
                >
                  <span className="text-sm font-semibold text-[#0B1F3A] shrink-0">#{r.session_num}</span>
                  <span className="hidden text-xs text-[#64748B] sm:block">
                    {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="flex-1 text-sm text-[#0B1F3A] truncate">
                    {r.topic ?? <span className="italic text-[#94A3B8]">No topic</span>}
                  </span>
                  {/* Mobile: date below topic */}
                  <span className="block text-[10px] text-[#94A3B8] sm:hidden absolute">
                    {/* hidden — shown in layout below */}
                  </span>
                  {cfg ? (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                  ) : (
                    <span className="text-xs text-[#94A3B8]">—</span>
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
