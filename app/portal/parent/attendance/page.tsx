import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getParentChildren,
  getChildAttendance,
} from '@/modules/parents/parent-portal-queries'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ child?: string }>
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  present: { label: 'Present', cls: 'bg-[#E7F8EE]  text-[#15803D]'  },
  absent:  { label: 'Absent',  cls: 'bg-[#FEE2E2]    text-[#DC2626]'    },
  late:    { label: 'Late',    cls: 'bg-yellow-100 text-yellow-700' },
  excused: { label: 'Excused', cls: 'bg-[#EFF6FF]   text-[#1D4ED8]'   },
  makeup:  { label: 'Makeup',  cls: 'bg-purple-100 text-purple-700' },
}

function TrendBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-[12px]">
        <span className="text-[#64748B]">{label}</span>
        <span className="font-semibold text-[#0B1F3A]">{pct}% ({count})</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#F1F5F9]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default async function ParentAttendancePage({ searchParams }: Props) {
  const { child } = await searchParams
  const user      = await requirePortalRole('parent')

  const children = await getParentChildren(user.id)

  if (!children.length) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <p className="text-sm text-[#94A3B8]">No children linked to this account.</p>
      </div>
    )
  }

  const studentId = child ?? children[0].student_id
  const selected  = children.find(c => c.student_id === studentId) ?? children[0]

  const attendance = await getChildAttendance(user.id, selected.student_id)

  if (!attendance) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <p className="text-sm text-[#94A3B8]">Unable to load attendance data.</p>
      </div>
    )
  }

  const { summary, records } = attendance
  const attendancePct = summary.attendance_pct
  const showWarning   = summary.total > 0 && attendancePct < 75

  return (
    <div className="mx-auto max-w-3xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A]">Attendance</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">{selected.student_name}</p>
        </div>
        <Link
          href={`/portal/parent?child=${selected.student_id}`}
          className="text-[13px] text-[#FF8A1F] hover:underline"
        >
          ← Dashboard
        </Link>
      </div>

      {/* Low attendance warning */}
      {showWarning && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEE2E2] px-4 py-3">
          <p className="text-sm font-semibold text-[#DC2626]">⚠ Attendance Warning</p>
          <p className="mt-0.5 text-[13px] text-[#EF4444]">
            Attendance is at {attendancePct}%, which is below the 75% minimum requirement.
            Please contact the instructor if you need support.
          </p>
        </div>
      )}

      {/* Overall bar */}
      <div className="ds-card p-5">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-medium text-[#0B1F3A]">Overall Attendance</span>
          <span className={`font-bold ${attendancePct >= 75 ? 'text-[#10B981]' : attendancePct >= 50 ? 'text-yellow-600' : 'text-[#EF4444]'}`}>
            {attendancePct}%
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[#F1F5F9]">
          <div
            className={`h-full rounded-full ${
              attendancePct >= 75 ? 'bg-[#10B981]' :
              attendancePct >= 50 ? 'bg-yellow-500' : 'bg-[#EF4444]'
            }`}
            style={{ width: `${attendancePct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[#94A3B8]">
          Present / Late / Makeup counted as attended · {summary.total} total sessions
        </p>
      </div>

      {/* Attendance trend breakdown */}
      {summary.total > 0 && (
        <div className="ds-card p-5 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Attendance Trend</p>
          <TrendBar label="Present" count={summary.present} total={summary.total} color="bg-[#10B981]"  />
          <TrendBar label="Absent"  count={summary.absent}  total={summary.total} color="bg-[#EF4444]"    />
          <TrendBar label="Late"    count={summary.late}    total={summary.total} color="bg-yellow-500" />
          {summary.excused > 0 && (
            <TrendBar label="Excused" count={summary.excused} total={summary.total} color="bg-[#38BDF8]" />
          )}
          {summary.makeup > 0 && (
            <TrendBar label="Makeup" count={summary.makeup} total={summary.total} color="bg-purple-400" />
          )}
        </div>
      )}

      {/* Records table */}
      {records.length === 0 ? (
        <div className="ds-card px-6 py-12 text-center">
          <p className="text-sm text-[#64748B]">No attendance records yet.</p>
        </div>
      ) : (
        <div className="ds-card overflow-hidden">
          <div className="border-b border-[#F1F5F9] px-5 py-3.5">
            <p className="text-[13px] font-semibold text-[#0B1F3A]">
              All Records ({records.length})
            </p>
          </div>
          {/* Mobile list */}
          <div className="md:hidden divide-y divide-[#F1F5F9]">
            {records.map((r, idx) => {
              const cfg     = STATUS_CONFIG[r.status] ?? { label: r.status, cls: 'bg-[#F3F4F6] text-[#4B5563]' }
              const dateStr = (r.class_date ?? r.recorded_at)
                ? new Date(r.class_date ?? r.recorded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="shrink-0 text-[11px] font-semibold text-[#94A3B8] w-6 text-right">{records.length - idx}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[#0B1F3A]">{dateStr}</p>
                    {r.course_title && <p className="text-[11px] text-[#64748B]">{r.course_title}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="ds-table-head">
                <tr className="border-b border-[#F1F5F9] text-left">
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">#</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Date</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Status</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Course</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC]">
                {records.map((r, idx) => {
                  const cfg     = STATUS_CONFIG[r.status] ?? { label: r.status, cls: 'bg-[#F3F4F6] text-[#4B5563]' }
                  const dateStr = (r.class_date ?? r.recorded_at)
                    ? new Date(r.class_date ?? r.recorded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'
                  return (
                    <tr key={r.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-5 py-3 text-[12px] text-[#94A3B8]">{records.length - idx}</td>
                      <td className="px-5 py-3 text-[#0B1F3A]">{dateStr}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>{cfg.label}</span>
                      </td>
                      <td className="px-5 py-3 text-[#64748B]">{r.course_title ?? '—'}</td>
                      <td className="px-5 py-3 text-[#94A3B8]">{r.note ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
