import type { InstructorDetailData, InstructorGroupDetail } from '@/modules/instructors/types'
import { StatCard } from '../StatCard'
import { SectionLabel } from '../SectionLabel'
import { attColor } from '../../utils'

export function AttendanceTab({ stats, groups }: {
  stats:  InstructorDetailData['attendance_stats']
  groups: InstructorGroupDetail[]
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1.5 md:gap-3 md:grid-cols-4">
        <StatCard label="Compliance" value={`${stats.compliance_rate}%`} accent={stats.compliance_rate >= 80} danger={stats.compliance_rate < 60} />
        <StatCard label="Total"      value={stats.total_sessions} />
        <StatCard label="Completed"  value={stats.sessions_completed} />
        <StatCard label="Missing"    value={stats.sessions_missing_attendance} danger={stats.sessions_missing_attendance > 0} />
      </div>

      <div>
        <SectionLabel>Submission Compliance</SectionLabel>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <div className="flex justify-between text-[12px] mb-2">
            <span className="text-[#64748B]">{stats.sessions_with_attendance} sessions with attendance</span>
            <span className={`font-bold ${attColor(stats.compliance_rate)}`}>{stats.compliance_rate}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${stats.compliance_rate >= 75 ? 'bg-[#10B981]' : stats.compliance_rate >= 55 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`}
              style={{ width: `${stats.compliance_rate}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-[#94A3B8]">
            <span>{stats.sessions_with_attendance} submitted</span>
            <span>{stats.sessions_missing_attendance} missing</span>
          </div>
        </div>
      </div>

      {groups.length > 0 && (
        <div>
          <SectionLabel>Per-Group Attendance</SectionLabel>
          <div className="space-y-2">
            {groups.map(g => (
              <div key={g.id} className="ds-card p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <p className="text-[13px] font-semibold text-[#0B1F3A]">{g.name}</p>
                    <p className="text-[10px] text-[#94A3B8]">{g.sessions_done} sessions · {g.student_count} students · {g.branch_name}</p>
                  </div>
                  <span className={`text-[18px] font-bold ${attColor(g.attendance_rate)}`}>{g.attendance_rate}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${g.attendance_rate >= 75 ? 'bg-[#10B981]' : g.attendance_rate >= 55 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`}
                    style={{ width: `${g.attendance_rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
