import type { InstructorGroupDetail } from '@/modules/instructors/types'
import { Empty } from '../Empty'
import { SectionLabel } from '../SectionLabel'
import { attColor } from '../../utils'

export function GroupsTab({ groups, canManage, onAssignGroup, onRemoveGroup }: {
  groups:        InstructorGroupDetail[]
  canManage:     boolean
  onAssignGroup: () => void
  onRemoveGroup: (g: InstructorGroupDetail) => void
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel>Groups ({groups.length})</SectionLabel>
        {canManage && (
          <button
            onClick={onAssignGroup}
            className="rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#e87c18] transition"
          >
            + Assign Group
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <Empty text="No groups assigned" sub="Use '+ Assign Group' to link this instructor" />
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {groups.map(g => (
              <div key={g.id} className="ds-card p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#0B1F3A] truncate">{g.name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      {g.code && <span className="font-mono text-[9px] text-[#94A3B8]">{g.code}</span>}
                      <span className="text-[9px] text-[#94A3B8]">{g.branch_name}</span>
                      {g.course_name && <span className="text-[9px] text-[#64748B]">{g.course_name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${g.role === 'lead' ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'bg-[#F1F5F9] text-[#475569]'}`}>{g.role}</span>
                    {canManage && (
                      <button onClick={() => onRemoveGroup(g)} className="text-[10px] text-[#F87171] active:text-[#EF4444]">Remove</button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[12px] font-bold text-[#0B1F3A]">{g.student_count}/{g.capacity || '∞'}</p>
                    <p className="text-[9px] text-[#94A3B8]">Students</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-[#0B1F3A]">{g.sessions_done}/{g.total_sessions}</p>
                    <p className="text-[9px] text-[#94A3B8]">Sessions</p>
                  </div>
                  <div>
                    <p className={`text-[12px] font-bold ${attColor(g.attendance_rate)}`}>{g.attendance_rate}%</p>
                    <p className="text-[9px] text-[#94A3B8]">Att.</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block ds-card overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="ds-table-head">
                <tr>
                  <th>Group</th>
                  <th>Course</th>
                  <th>Branch</th>
                  <th>Students</th>
                  <th>Sessions</th>
                  <th>Att.</th>
                  <th>Role</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#FAFAFA]">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-[#0B1F3A]">{g.name}</p>
                      {g.code && <p className="text-[10px] text-[#94A3B8] font-mono">{g.code}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-[#64748B]">{g.course_name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[10px] text-[#94A3B8]">{g.branch_name}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-[#0B1F3A]">{g.student_count}/{g.capacity || '∞'}</td>
                    <td className="px-3 py-2.5 text-right text-[#64748B]">{g.sessions_done}/{g.total_sessions}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`font-bold ${attColor(g.attendance_rate)}`}>{g.attendance_rate}%</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${g.role === 'lead' ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'bg-[#F1F5F9] text-[#475569]'}`}>
                        {g.role}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-3 py-2.5 text-right">
                        <button onClick={() => onRemoveGroup(g)} className="text-[11px] text-[#F87171] hover:text-[#EF4444] hover:underline">Remove</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="mt-2 text-[11px] text-[#94A3B8]">Students are derived automatically through group memberships.</p>
    </div>
  )
}
