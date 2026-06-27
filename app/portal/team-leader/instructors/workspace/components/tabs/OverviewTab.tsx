import type { InstructorDetailData } from '@/modules/instructors/types'
import { StatCard } from '../StatCard'
import { SectionLabel } from '../SectionLabel'
import { fmtDate, fmtTime, fmtCurrency, sessionStatusMeta, isToday, isFuture, attColor } from '../../utils'

export function OverviewTab({ detail }: { detail: InstructorDetailData }) {
  const { instructor, sessions, groups, attendance_stats, performance } = detail

  const todaySessions = sessions.filter(s => isToday(s.scheduled_at))
  const missingAtt    = sessions.filter(s => s.status === 'completed' && !s.attendance_submitted)
  const upcoming      = sessions.filter(s => isFuture(s.scheduled_at) && s.status !== 'cancelled').slice(0, 5)
  const lowAttGroups  = groups.filter(g => g.attendance_rate < 60)

  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekEnd   = new Date(); weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay()))
  const thisWeekSessions = sessions.filter(s => {
    const d = new Date(s.scheduled_at)
    return d >= weekStart && d <= weekEnd
  }).length

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const sessionsThisMonth = sessions.filter(s =>
    s.status === 'completed' && new Date(s.scheduled_at) >= monthStart
  ).length
  const estimatedPayout = (instructor.salary_per_session ?? 0) * sessionsThisMonth

  return (
    <div className="space-y-5">
      {/* Identity card */}
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <div className="grid grid-cols-2 gap-2.5 text-[12px]">
          {instructor.user_email && (
            <div><span className="text-[#94A3B8]">Email: </span><span className="text-[#0B1F3A]">{instructor.user_email}</span></div>
          )}
          {instructor.phone && (
            <div><span className="text-[#94A3B8]">Phone: </span>
              <a href={`tel:${instructor.phone}`} className="text-[#0B1F3A] hover:text-[#FF8A1F]">{instructor.phone}</a>
            </div>
          )}
          {instructor.alt_phone && (
            <div><span className="text-[#94A3B8]">Alt: </span><span className="text-[#0B1F3A]">{instructor.alt_phone}</span></div>
          )}
          {instructor.whatsapp_number && (
            <div><span className="text-[#94A3B8]">WhatsApp: </span><span className="text-[#0B1F3A]">{instructor.whatsapp_number}</span></div>
          )}
          {instructor.hire_date && (
            <div><span className="text-[#94A3B8]">Joined: </span><span className="text-[#0B1F3A]">{fmtDate(instructor.hire_date)}</span></div>
          )}
          {instructor.working_days?.length > 0 && (
            <div><span className="text-[#94A3B8]">Days: </span><span className="text-[#0B1F3A]">{instructor.working_days.join(', ')}</span></div>
          )}
          {instructor.max_weekly_load && (
            <div><span className="text-[#94A3B8]">Max load: </span><span className="text-[#0B1F3A]">{instructor.max_weekly_load} sess/wk</span></div>
          )}
          {instructor.specializations?.length > 0 && (
            <div className="col-span-2 flex flex-wrap gap-1">
              {instructor.specializations.map(s => (
                <span key={s} className="rounded-full bg-[#FF8A1F]/10 px-2 py-0.5 text-[10px] font-medium text-[#FF8A1F]">{s}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-1.5 md:gap-3 sm:grid-cols-6">
        <StatCard label="Groups"      value={performance.group_count}    sub={`${performance.active_groups} active`} />
        <StatCard label="Students"    value={performance.total_students} sub={`${performance.at_risk_students} at risk`} danger={performance.at_risk_students > 0} />
        <StatCard label="Attendance"  value={`${performance.attendance_compliance}%`} sub={`${attendance_stats.sessions_missing_attendance} missing`} danger={attendance_stats.sessions_missing_attendance > 0} />
        <StatCard label="This Week"   value={thisWeekSessions}           sub="sessions" />
        <StatCard label="Salary/Sess" value={instructor.salary_per_session ? fmtCurrency(instructor.salary_per_session, instructor.currency) : '—'} accent />
        <StatCard label="Payout Est." value={estimatedPayout > 0 ? fmtCurrency(estimatedPayout, instructor.currency) : '—'} sub="this month" accent />
      </div>

      {/* Today sessions */}
      {todaySessions.length > 0 && (
        <div>
          <SectionLabel>Today ({todaySessions.length})</SectionLabel>
          <div className="space-y-2">
            {todaySessions.map(s => {
              const meta = sessionStatusMeta(s.status, s.attendance_submitted, s.scheduled_at)
              return (
                <div key={s.id} className="flex items-center gap-3 ds-card px-4 py-2.5">
                  <div className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#0B1F3A]">{s.group_name}</p>
                    <p className="text-[11px] text-[#64748B]">{fmtTime(s.scheduled_at)} · {s.duration_minutes}min · {s.student_count} students</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>{meta.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Missing attendance alerts */}
      {missingAtt.length > 0 && (
        <div>
          <SectionLabel>Missing Attendance ({missingAtt.length})</SectionLabel>
          <div className="space-y-1.5">
            {missingAtt.map(s => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-[#FECACA] bg-[#FEE2E2] px-4 py-2.5">
                <span className="text-[#EF4444] shrink-0">⚠</span>
                <div>
                  <p className="text-[13px] font-medium text-[#991B1B]">{s.group_name}</p>
                  <p className="text-[11px] text-[#EF4444]">{fmtDate(s.scheduled_at)} · {fmtTime(s.scheduled_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low attendance groups */}
      {lowAttGroups.length > 0 && (
        <div>
          <SectionLabel>Low Attendance Groups</SectionLabel>
          <div className="space-y-1.5">
            {lowAttGroups.map(g => (
              <div key={g.id} className="flex items-center justify-between rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-2.5">
                <div>
                  <p className="text-[13px] font-medium text-[#78350F]">{g.name}</p>
                  <p className="text-[11px] text-[#F59E0B]">{g.course_name ?? 'No course'} · {g.student_count} students</p>
                </div>
                <span className="text-[18px] font-bold text-[#F59E0B]">{g.attendance_rate}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming sessions */}
      {upcoming.length > 0 && (
        <div>
          <SectionLabel>Upcoming Sessions</SectionLabel>
          <div className="space-y-2">
            {upcoming.map(s => {
              const meta = sessionStatusMeta(s.status, s.attendance_submitted, s.scheduled_at)
              return (
                <div key={s.id} className="flex items-center gap-3 ds-card px-4 py-2.5">
                  <div className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#0B1F3A]">{s.group_name}</p>
                    <p className="text-[11px] text-[#64748B]">{fmtDate(s.scheduled_at)} · {fmtTime(s.scheduled_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Bio */}
      {instructor.bio && (
        <div>
          <SectionLabel>Bio</SectionLabel>
          <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-[12px] text-[#374151] leading-relaxed">{instructor.bio}</p>
        </div>
      )}
    </div>
  )
}
