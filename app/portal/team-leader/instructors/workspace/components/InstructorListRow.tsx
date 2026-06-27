import { buildWhatsAppUrl } from '@/lib/phone'
import type { InstructorOperationalRow } from '@/modules/instructors/types'
import { Avatar } from './Avatar'
import { attColor, statusCls, fmtCurrency, displayName } from '../utils'

export function InstructorListRow({
  instructor, selected, onClick, canManage, onAssign, onEdit, onDelete,
}: {
  instructor: InstructorOperationalRow
  selected:   boolean
  onClick:    () => void
  canManage:  boolean
  onAssign:   (e: React.MouseEvent) => void
  onEdit:     (e: React.MouseEvent) => void
  onDelete:   (e: React.MouseEvent) => void
}) {
  const name = displayName(instructor.first_name, instructor.last_name, instructor.user_email)
  const wa   = instructor.phone

  return (
    <tr
      onClick={onClick}
      className={['group cursor-pointer border-b border-[#F1F5F9] transition-colors', selected ? 'bg-[#FFF7ED]' : 'hover:bg-[#F8FAFC]'].join(' ')}
    >
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar first={instructor.first_name} last={instructor.last_name} email={instructor.user_email} size="sm" selected={selected} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[#0B1F3A]">{name}</p>
            {instructor.instructor_code && (
              <span className="font-mono text-[10px] text-[#94A3B8]">{instructor.instructor_code}</span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap gap-1">
          {instructor.branch_names.map(b => (
            <span key={b} className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] text-[#64748B]">{b}</span>
          ))}
        </div>
      </td>
      <td className="px-4 py-2.5 text-center text-[13px] font-semibold text-[#0B1F3A]">{instructor.group_count}</td>
      <td className="px-4 py-2.5 text-center text-[13px] font-semibold text-[#0B1F3A]">{instructor.student_count}</td>
      <td className="px-4 py-2.5 text-center">
        {instructor.today_sessions_count > 0
          ? <span className="rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[11px] font-semibold text-[#B45309]">{instructor.today_sessions_count}</span>
          : <span className="text-[11px] text-[#CBD5E1]">—</span>
        }
      </td>
      <td className="px-4 py-2.5 text-center">
        <span className={`text-[12px] font-bold ${instructor.attendance_compliance > 0 ? attColor(instructor.attendance_compliance) : 'text-[#CBD5E1]'}`}>
          {instructor.attendance_compliance > 0 ? `${instructor.attendance_compliance}%` : '—'}
        </span>
      </td>
      <td className="px-4 py-2.5 text-[12px] text-[#64748B]">
        {instructor.salary_per_session ? fmtCurrency(instructor.salary_per_session) : <span className="text-[#CBD5E1]">—</span>}
      </td>
      <td className="px-4 py-2.5">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusCls(instructor.status)}`}>
          {instructor.status.replace('_', ' ')}
        </span>
      </td>
      {canManage && (
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onAssign} className="rounded bg-[#FF8A1F] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#e87c18] transition">Assign</button>
            <button onClick={onEdit}   className="rounded border border-[#E2E8F0] px-2 py-1 text-[10px] text-[#374151] hover:bg-[#F1F5F9] transition">Edit</button>
            <button onClick={onDelete} className="rounded border border-[#FECACA] px-2 py-1 text-[10px] text-[#EF4444] hover:bg-[#EF4444] hover:text-white transition">Delete</button>
            {wa && buildWhatsAppUrl(wa, null) && (
              <a href={buildWhatsAppUrl(wa, null)!} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                className="rounded border border-[#A7F3D0] bg-[#E7F8EE] px-2 py-1 text-[10px] text-[#10B981] hover:bg-[#E7F8EE] transition">WA</a>
            )}
          </div>
        </td>
      )}
    </tr>
  )
}
