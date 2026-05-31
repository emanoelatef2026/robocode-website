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
      <div className="flex h-64 items-center justify-center text-[#64748B]">
        No student record found.
      </div>
    )
  }

  const attendancePct = data.att_pct

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A]">Attendance</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">{data.group_name ?? 'No group enrolled'}</p>
        </div>
        <Link href="/portal/student" className="text-sm text-[#FF8A1F] hover:underline">← Dashboard</Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Present', value: data.att_present, color: 'text-green-600' },
          { label: 'Absent',  value: data.att_absent,  color: 'text-red-600'   },
          { label: 'Late',    value: data.att_late,    color: 'text-yellow-600' },
          { label: 'Total',   value: data.att_total,   color: 'text-[#0B1F3A]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="mt-0.5 text-xs text-[#94A3B8]">{label}</p>
          </div>
        ))}
      </div>

      {/* Attendance rate bar */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[#0B1F3A]">Attendance Rate</p>
          <span className={`text-lg font-bold ${attendancePct >= 75 ? 'text-green-600' : attendancePct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
            {attendancePct}%
          </span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#F1F5F9]">
          <div
            className={`h-full rounded-full transition-all ${attendancePct >= 75 ? 'bg-green-500' : attendancePct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${attendancePct}%` }}
          />
        </div>
      </div>

      {/* Session-by-session table */}
      {records.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] text-sm text-[#64748B]">
          No sessions recorded yet.
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="border-b border-[#E2E8F0] px-5 py-3">
            <p className="text-sm font-semibold text-[#0B1F3A]">{records.length} session{records.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Table header (desktop) */}
          <div className="hidden grid-cols-[80px_120px_1fr_100px] gap-4 border-b border-[#F1F5F9] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8] sm:grid">
            <span>Session</span>
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
                  className="flex flex-col gap-1 px-5 py-3.5 sm:grid sm:grid-cols-[80px_120px_1fr_100px] sm:items-center sm:gap-4"
                >
                  <span className="text-sm font-semibold text-[#0B1F3A]">#{r.session_num}</span>
                  <span className="text-xs text-[#64748B]">
                    {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="text-sm text-[#0B1F3A]">
                    {r.topic ?? <span className="italic text-[#94A3B8]">No topic</span>}
                  </span>
                  {cfg ? (
                    <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>
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
