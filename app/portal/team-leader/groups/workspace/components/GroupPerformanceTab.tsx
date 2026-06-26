import type { GroupOperationalRow } from '@/modules/groups/operational'

export function GroupPerformanceTab({ group }: { group: GroupOperationalRow }) {
  const metrics = [
    { label: 'Attendance',   value: group.attendance_avg, desc: 'Group avg attendance rate' },
    { label: 'Assignments',  value: group.assignment_avg, desc: 'Homework completion rate'  },
    { label: 'Portfolio',    value: group.portfolio_avg,  desc: 'Portfolio submission rate'  },
    { label: 'Health Score', value: group.health_score,   desc: 'Overall group health score' },
  ]

  const alerts = [
    group.is_low_attendance && 'Low attendance (< 60%)',
    group.is_low_capacity   && 'Under capacity (< 50% filled)',
    group.is_overloaded     && 'Overloaded (≥ 90% filled)',
    !group.has_instructor   && 'No lead instructor assigned',
    !group.has_course       && 'No course assigned',
  ].filter(Boolean) as string[]

  return (
    <div className="p-4 space-y-4">
      {alerts.length > 0 && (
        <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
          <p className="mb-2 text-[12px] font-semibold text-[#B45309]">Active Alerts</p>
          <ul className="space-y-1">
            {alerts.map(a => (
              <li key={a} className="flex items-center gap-2 text-[12px] text-[#B45309]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B] shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="ds-card p-4 space-y-5">
        {metrics.map(m => (
          <div key={m.label}>
            <div className="flex items-start justify-between mb-1.5">
              <div>
                <p className="text-[13px] font-semibold text-[#374151]">{m.label}</p>
                <p className="text-[11px] text-[#94A3B8]">{m.desc}</p>
              </div>
              <span className={`text-[15px] font-bold ${
                m.value >= 75 ? 'text-[#10B981]' :
                m.value >= 60 ? 'text-[#F59E0B]' :
                m.value > 0   ? 'text-[#EF4444]' : 'text-[#94A3B8]'
              }`}>
                {m.value > 0 ? `${m.value}%` : '—'}
              </span>
            </div>
            {m.value > 0 && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                <div
                  className={`h-full rounded-full ${m.value >= 75 ? 'bg-[#10B981]' : m.value >= 60 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`}
                  style={{ width: `${Math.min(100, m.value)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {alerts.length === 0 && group.health_score >= 75 && (
        <div className="rounded-xl border border-[#A7F3D0] bg-[#E7F8EE] px-4 py-3 text-[13px] text-[#15803D] font-medium">
          This group is performing well ✓
        </div>
      )}
    </div>
  )
}
