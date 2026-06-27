import { buildWhatsAppUrl } from '@/lib/phone'
import type { InstructorOperationalRow } from '@/modules/instructors/types'
import { Avatar } from './Avatar'
import { attColor, statusCls, fmtCurrency, displayName, initials } from '../utils'

export function InstructorGridCard({
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
  const name  = displayName(instructor.first_name, instructor.last_name, instructor.user_email)
  const ini   = initials(instructor.first_name, instructor.last_name, instructor.user_email)
  const waUrl = instructor.phone ? buildWhatsAppUrl(instructor.phone, null) : null

  return (
    <div
      onClick={onClick}
      className={[
        'group relative cursor-pointer rounded-xl border bg-white transition-all duration-150',
        selected
          ? 'border-[#FF8A1F] shadow-[0_0_0_2px_rgba(255,138,31,0.20)]'
          : 'border-[#E2E8F0] active:bg-[#F8FAFC] md:hover:border-[#FF8A1F]/50 md:hover:shadow-md md:hover:-translate-y-0.5',
      ].join(' ')}
    >
      {/* Mobile: compact horizontal row */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 md:hidden">
        <div className="relative shrink-0">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${selected ? 'bg-[#FF8A1F] text-white' : 'bg-[#0B1F3A] text-white'}`}>
            {ini}
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-white ${instructor.status === 'active' ? 'bg-[#10B981]' : instructor.status === 'inactive' ? 'bg-[#94A3B8]' : 'bg-[#F59E0B]'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-[#0B1F3A] truncate leading-tight">{name}</p>
          <p className="text-[10px] text-[#64748B] truncate mt-0.5 leading-tight">
            {instructor.branch_names.join(', ')}
            {instructor.instructor_code ? ` · ${instructor.instructor_code}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-center">
            <p className="text-[12px] font-bold text-[#0B1F3A] leading-none">{instructor.group_count}</p>
            <p className="text-[8px] text-[#94A3B8] mt-0.5">Gr</p>
          </div>
          <div className="text-center">
            <p className="text-[12px] font-bold text-[#0B1F3A] leading-none">{instructor.student_count}</p>
            <p className="text-[8px] text-[#94A3B8] mt-0.5">St</p>
          </div>
          {instructor.today_sessions_count > 0 ? (
            <span className="rounded-full bg-[#FFFBEB] px-1.5 py-0.5 text-[9px] font-bold text-[#B45309] shrink-0">
              {instructor.today_sessions_count}↑
            </span>
          ) : (
            <div className="text-center">
              <p className={`text-[12px] font-bold leading-none ${instructor.attendance_compliance > 0 ? attColor(instructor.attendance_compliance) : 'text-[#CBD5E1]'}`}>
                {instructor.attendance_compliance > 0 ? `${instructor.attendance_compliance}%` : '—'}
              </p>
              <p className="text-[8px] text-[#94A3B8] mt-0.5">Att</p>
            </div>
          )}
        </div>
      </div>

      {/* Desktop: vertical card layout */}
      <div className="hidden md:flex flex-col">
        <div className="flex flex-col items-center px-3 pt-4 pb-2">
          <div className="relative mb-2">
            <Avatar first={instructor.first_name} last={instructor.last_name} email={instructor.user_email} size="lg" selected={selected} />
            <span className={`absolute -bottom-1 -right-1 rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase leading-none ${statusCls(instructor.status)}`}>
              {instructor.status === 'on_leave' ? 'Leave' : instructor.status}
            </span>
          </div>
          <p className="text-center text-[13px] font-bold text-[#0B1F3A] leading-tight line-clamp-1">{name}</p>
          <div className="mt-1.5 flex flex-wrap justify-center gap-1">
            {instructor.branch_names.map(b => (
              <span key={b} className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] text-[#64748B]">{b}</span>
            ))}
          </div>
          {instructor.instructor_code && (
            <span className="mt-1 rounded bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-[9px] text-[#94A3B8]">{instructor.instructor_code}</span>
          )}
        </div>
        <div className="mx-3 mb-2 grid grid-cols-3 divide-x divide-[#F1F5F9] rounded-xl border border-[#F1F5F9] bg-[#F8FAFC]">
          <div className="flex flex-col items-center py-2">
            <p className="text-[14px] font-bold text-[#0B1F3A]">{instructor.group_count}</p>
            <p className="text-[9px] text-[#94A3B8]">Groups</p>
          </div>
          <div className="flex flex-col items-center py-2">
            <p className="text-[14px] font-bold text-[#0B1F3A]">{instructor.student_count}</p>
            <p className="text-[9px] text-[#94A3B8]">Students</p>
          </div>
          <div className="flex flex-col items-center py-2">
            <p className={`text-[14px] font-bold ${instructor.attendance_compliance > 0 ? attColor(instructor.attendance_compliance) : 'text-[#CBD5E1]'}`}>
              {instructor.attendance_compliance > 0 ? `${instructor.attendance_compliance}%` : '—'}
            </p>
            <p className="text-[9px] text-[#94A3B8]">Att.</p>
          </div>
        </div>
        <div className="flex items-center justify-between px-3 pb-2.5 text-[10px]">
          {instructor.today_sessions_count > 0
            ? <span className="rounded bg-[#FFFBEB] px-2 py-0.5 font-semibold text-[#B45309]">{instructor.today_sessions_count} today</span>
            : <span className="text-[#CBD5E1]">No sessions today</span>
          }
          {instructor.salary_per_session
            ? <span className="text-[#94A3B8]">{fmtCurrency(instructor.salary_per_session)}/sess</span>
            : <span />
          }
        </div>
        {canManage && (
          <div className="flex gap-1 border-t border-[#F1F5F9] px-2 py-2 opacity-0 transition-opacity group-hover:opacity-100">
            <button onClick={e => { e.stopPropagation(); onClick() }}
              className="flex-1 rounded-lg bg-[#F8FAFC] py-1.5 text-[10px] font-medium text-[#374151] hover:bg-[#F1F5F9] transition">
              View
            </button>
            <button onClick={onAssign}
              className="flex-1 rounded-lg bg-[#FF8A1F] py-1.5 text-[10px] font-semibold text-white hover:bg-[#e87c18] transition">
              Assign
            </button>
            <button onClick={onEdit}
              className="flex-1 rounded-lg bg-[#F8FAFC] py-1.5 text-[10px] font-medium text-[#374151] hover:bg-[#F1F5F9] transition">
              Edit
            </button>
            <button onClick={onDelete}
              className="flex-1 rounded-lg border border-[#FECACA] py-1.5 text-[10px] font-medium text-[#EF4444] hover:bg-[#EF4444] hover:text-white transition">
              Delete
            </button>
            {waUrl && (
              <a href={waUrl} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center justify-center rounded-lg bg-[#E7F8EE] px-2 hover:bg-[#E7F8EE] transition">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 text-[#10B981]">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
