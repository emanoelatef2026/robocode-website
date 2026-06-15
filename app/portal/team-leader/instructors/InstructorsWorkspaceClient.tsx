'use client'

import { useState, useTransition, useCallback, useRef, useEffect } from 'react'
import { buildWhatsAppUrl } from '@/lib/phone'
import {
  getInstructorDetailAction,
  createInstructorModalAction,
  updateInstructorModalAction,
  archiveInstructorAction,
  assignGroupModalAction,
  removeGroupModalAction,
  refreshInstructorListAction,
  saveNoteAction,
  deleteNoteAction,
  deleteInstructorAction,
} from '@/modules/instructors/modal-actions'
import type {
  InstructorOperationalRow,
  FullInstructor,
  InstructorDetailData,
  InstructorGroupDetail,
  InstructorFormOptions,
  InstructorNote,
} from '@/modules/instructors/types'

// ═══════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

const SPECIALIZATIONS_LIST = ['LEGO', 'Scratch', 'Roblox', 'Python', 'Arduino', 'Minecraft', 'AI Tools', 'VR', 'JavaScript', 'Game Dev', 'Robotics', 'Electronics']
const WORKING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const NOTE_CATEGORIES: { key: string; label: string }[] = [
  { key: 'general',              label: 'General'       },
  { key: 'strengths',            label: 'Strength'      },
  { key: 'weaknesses',           label: 'Weakness'      },
  { key: 'communication',        label: 'Communication' },
  { key: 'reliability',          label: 'Reliability'   },
  { key: 'classroom_management', label: 'Classroom'     },
]

type TabKey = 'overview' | 'groups' | 'attendance' | 'finance' | 'notes'
type ViewMode = 'grid' | 'list'
type QuickFilter = '' | 'active' | 'inactive' | 'on_leave' | 'no_groups'
type FormSection = 'basic' | 'account' | 'financial' | 'social' | 'availability'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview',   label: 'Overview'   },
  { key: 'groups',     label: 'Groups'     },
  { key: 'attendance', label: 'Attendance' },
  { key: 'finance',    label: 'Finance'    },
  { key: 'notes',      label: 'Notes'      },
]

// ═══════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function fmtCurrency(n: number, currency = 'EGP'): string {
  if (!n) return '—'
  return n.toLocaleString('en-EG', { style: 'currency', currency, maximumFractionDigits: 0 })
}

function initials(first: string | null, last: string | null, email: string): string {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase()
  if (first) return first.slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

function displayName(first: string | null, last: string | null, email: string): string {
  if (first && last) return `${first} ${last}`
  if (first) return first
  return email
}

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString()
}

function isFuture(iso: string): boolean {
  return new Date(iso) > new Date()
}

function attColor(rate: number) {
  if (rate >= 75) return 'text-emerald-600'
  if (rate >= 55) return 'text-amber-600'
  return 'text-red-600'
}

function statusCls(status: string) {
  if (status === 'active')   return 'bg-emerald-100 text-emerald-700'
  if (status === 'inactive') return 'bg-slate-100 text-slate-500'
  return 'bg-amber-100 text-amber-700'
}

function sessionStatusMeta(status: string, attendance_submitted: boolean, scheduled_at: string) {
  if (status === 'completed' && !attendance_submitted)
    return { label: 'Missing Att.', cls: 'bg-red-100 text-red-700', dot: 'bg-red-500' }
  if (status === 'completed')
    return { label: 'Done',      cls: 'bg-green-100 text-green-700',  dot: 'bg-green-500' }
  if (status === 'ongoing')
    return { label: 'Live',      cls: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500 animate-pulse' }
  if (status === 'cancelled')
    return { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500',  dot: 'bg-slate-400' }
  if (isFuture(scheduled_at))
    return { label: 'Upcoming',  cls: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400' }
  return { label: 'Scheduled', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' }
}

function filterInstructors(
  list: InstructorOperationalRow[],
  q: string,
  branchId: string,
  qf: QuickFilter,
): InstructorOperationalRow[] {
  return list.filter(i => {
    if (branchId && !i.branch_ids.includes(branchId)) return false
    if (qf === 'active'    && i.status !== 'active')   return false
    if (qf === 'inactive'  && i.status !== 'inactive') return false
    if (qf === 'on_leave'  && i.status !== 'on_leave') return false
    if (qf === 'no_groups' && i.group_count > 0)       return false
    if (q) {
      const hay = [i.first_name, i.last_name, i.user_email, i.instructor_code, ...i.branch_names]
        .filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q.toLowerCase())) return false
    }
    return true
  })
}

// ═══════════════════════════════════════════════════════════════════════
//  SHARED ATOMS
// ═══════════════════════════════════════════════════════════════════════

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#FF8A1F] border-t-transparent" />
    </div>
  )
}

function Empty({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <p className="text-[13px] font-medium text-[#94A3B8]">{text}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[#CBD5E1]">{sub}</p>}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">{children}</p>
}

function StatCard({ label, value, sub, accent, danger }: {
  label: string; value: string | number; sub?: string; accent?: boolean; danger?: boolean
}) {
  return (
    <div className={`min-w-0 rounded-xl border px-2 py-1.5 md:p-3 ${accent ? 'border-[#FF8A1F]/30 bg-[#FFF7ED]' : danger ? 'border-red-200 bg-red-50' : 'border-[#E2E8F0] bg-white'}`}>
      <p className={`truncate text-[8px] font-medium leading-tight md:text-[11px] ${accent ? 'text-[#FF8A1F]/70' : danger ? 'text-red-400' : 'text-[#64748B]'}`}>{label}</p>
      <p className={`mt-0.5 truncate text-[13px] font-bold leading-none md:text-[20px] ${accent ? 'text-[#FF8A1F]' : danger ? 'text-red-600' : 'text-[#0B1F3A]'}`}>{value}</p>
      {sub && <p className={`mt-0.5 truncate text-[8px] leading-tight md:text-[10px] ${accent ? 'text-[#FF8A1F]/60' : danger ? 'text-red-400' : 'text-[#94A3B8]'}`}>{sub}</p>}
    </div>
  )
}

function Avatar({ first, last, email, size = 'md', selected = false }: {
  first: string | null; last: string | null; email: string
  size?: 'sm' | 'md' | 'lg'; selected?: boolean
}) {
  const ini = initials(first, last, email)
  const sizeMap = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-[12px]', lg: 'h-12 w-12 text-[16px]' }
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full font-bold ${sizeMap[size]} ${selected ? 'bg-[#FF8A1F] text-white' : 'bg-[#0B1F3A] text-white'}`}>
      {ini}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  GRID CARD
// ═══════════════════════════════════════════════════════════════════════

function InstructorGridCard({
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
  const ini  = initials(instructor.first_name, instructor.last_name, instructor.user_email)

  const waUrl = wa ? buildWhatsAppUrl(wa, null) : null

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
      {/* ── MOBILE: compact horizontal row ── */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 md:hidden">
        {/* Avatar with status dot */}
        <div className="relative shrink-0">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${selected ? 'bg-[#FF8A1F] text-white' : 'bg-[#0B1F3A] text-white'}`}>
            {ini}
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-white ${instructor.status === 'active' ? 'bg-emerald-500' : instructor.status === 'inactive' ? 'bg-slate-400' : 'bg-amber-400'}`} />
        </div>
        {/* Name + branch/code */}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-[#0B1F3A] truncate leading-tight">{name}</p>
          <p className="text-[10px] text-[#64748B] truncate mt-0.5 leading-tight">
            {instructor.branch_names.join(', ')}
            {instructor.instructor_code ? ` · ${instructor.instructor_code}` : ''}
          </p>
        </div>
        {/* Inline stats */}
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
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 shrink-0">
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

      {/* ── DESKTOP: vertical card layout ── */}
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
            ? <span className="rounded bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">{instructor.today_sessions_count} today</span>
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
              className="flex-1 rounded-lg border border-red-200 py-1.5 text-[10px] font-medium text-red-500 hover:bg-red-500 hover:text-white transition">
              Delete
            </button>
            {waUrl && (
              <a href={waUrl} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center justify-center rounded-lg bg-green-50 px-2 hover:bg-green-100 transition">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 text-green-600">
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

// ═══════════════════════════════════════════════════════════════════════
//  LIST ROW
// ═══════════════════════════════════════════════════════════════════════

function InstructorListRow({
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
    <tr onClick={onClick}
      className={['group cursor-pointer border-b border-[#F1F5F9] transition-colors', selected ? 'bg-[#FFF7ED]' : 'hover:bg-[#F8FAFC]'].join(' ')}>
      {/* Instructor */}
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
      {/* Branches */}
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap gap-1">
          {instructor.branch_names.map(b => (
            <span key={b} className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] text-[#64748B]">{b}</span>
          ))}
        </div>
      </td>
      {/* Groups */}
      <td className="px-4 py-2.5 text-center text-[13px] font-semibold text-[#0B1F3A]">{instructor.group_count}</td>
      {/* Students */}
      <td className="px-4 py-2.5 text-center text-[13px] font-semibold text-[#0B1F3A]">{instructor.student_count}</td>
      {/* Today sessions */}
      <td className="px-4 py-2.5 text-center">
        {instructor.today_sessions_count > 0
          ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{instructor.today_sessions_count}</span>
          : <span className="text-[11px] text-[#CBD5E1]">—</span>
        }
      </td>
      {/* Attendance */}
      <td className="px-4 py-2.5 text-center">
        <span className={`text-[12px] font-bold ${instructor.attendance_compliance > 0 ? attColor(instructor.attendance_compliance) : 'text-[#CBD5E1]'}`}>
          {instructor.attendance_compliance > 0 ? `${instructor.attendance_compliance}%` : '—'}
        </span>
      </td>
      {/* Salary/session */}
      <td className="px-4 py-2.5 text-[12px] text-[#64748B]">
        {instructor.salary_per_session ? fmtCurrency(instructor.salary_per_session) : <span className="text-[#CBD5E1]">—</span>}
      </td>
      {/* Status */}
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
            <button onClick={onDelete} className="rounded border border-red-200 px-2 py-1 text-[10px] text-red-500 hover:bg-red-500 hover:text-white transition">Delete</button>
            {wa && buildWhatsAppUrl(wa, null) && (
              <a href={buildWhatsAppUrl(wa, null)!} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                className="rounded border border-green-200 bg-green-50 px-2 py-1 text-[10px] text-green-600 hover:bg-green-100 transition">WA</a>
            )}
          </div>
        </td>
      )}
    </tr>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  POPUP — TAB: OVERVIEW
// ═══════════════════════════════════════════════════════════════════════

function OverviewTab({ detail }: { detail: InstructorDetailData }) {
  const { instructor, sessions, groups, attendance_stats, performance } = detail

  const todaySessions  = sessions.filter(s => isToday(s.scheduled_at))
  const missingAtt     = sessions.filter(s => s.status === 'completed' && !s.attendance_submitted)
  const upcoming       = sessions.filter(s => isFuture(s.scheduled_at) && s.status !== 'cancelled').slice(0, 5)
  const lowAttGroups   = groups.filter(g => g.attendance_rate < 60)

  // This week sessions count
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekEnd   = new Date(); weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay()))
  const thisWeekSessions = sessions.filter(s => {
    const d = new Date(s.scheduled_at)
    return d >= weekStart && d <= weekEnd
  }).length

  // Estimated payout this month (salary × sessions completed in month)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const sessionsThisMonth = sessions.filter(s => {
    return s.status === 'completed' && new Date(s.scheduled_at) >= monthStart
  }).length
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
        <StatCard label="Groups"       value={performance.group_count}     sub={`${performance.active_groups} active`} />
        <StatCard label="Students"     value={performance.total_students}  sub={`${performance.at_risk_students} at risk`} danger={performance.at_risk_students > 0} />
        <StatCard label="Attendance"   value={`${performance.attendance_compliance}%`} sub={`${attendance_stats.sessions_missing_attendance} missing`} danger={attendance_stats.sessions_missing_attendance > 0} />
        <StatCard label="This Week"    value={thisWeekSessions}            sub="sessions" />
        <StatCard label="Salary/Sess"  value={instructor.salary_per_session ? fmtCurrency(instructor.salary_per_session, instructor.currency) : '—'} accent />
        <StatCard label="Payout Est."  value={estimatedPayout > 0 ? fmtCurrency(estimatedPayout, instructor.currency) : '—'} sub="this month" accent />
      </div>

      {/* Today sessions */}
      {todaySessions.length > 0 && (
        <div>
          <SectionLabel>Today ({todaySessions.length})</SectionLabel>
          <div className="space-y-2">
            {todaySessions.map(s => {
              const meta = sessionStatusMeta(s.status, s.attendance_submitted, s.scheduled_at)
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5">
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
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
                <span className="text-red-500 shrink-0">⚠</span>
                <div>
                  <p className="text-[13px] font-medium text-red-800">{s.group_name}</p>
                  <p className="text-[11px] text-red-500">{fmtDate(s.scheduled_at)} · {fmtTime(s.scheduled_at)}</p>
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
              <div key={g.id} className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                <div>
                  <p className="text-[13px] font-medium text-amber-900">{g.name}</p>
                  <p className="text-[11px] text-amber-600">{g.course_name ?? 'No course'} · {g.student_count} students</p>
                </div>
                <span className="text-[18px] font-bold text-amber-600">{g.attendance_rate}%</span>
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
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5">
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

// ═══════════════════════════════════════════════════════════════════════
//  POPUP — TAB: GROUPS
// ═══════════════════════════════════════════════════════════════════════

function GroupsTab({ groups, canManage, onAssignGroup, onRemoveGroup }: {
  groups: InstructorGroupDetail[]; canManage: boolean
  onAssignGroup: () => void; onRemoveGroup: (g: InstructorGroupDetail) => void
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel>Groups ({groups.length})</SectionLabel>
        {canManage && (
          <button onClick={onAssignGroup} className="rounded-lg bg-[#FF8A1F] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#e87c18] transition">
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
              <div key={g.id} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
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
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${g.role === 'lead' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{g.role}</span>
                    {canManage && (
                      <button onClick={() => onRemoveGroup(g)} className="text-[10px] text-red-400 active:text-red-600">Remove</button>
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
          <div className="hidden md:block rounded-xl border border-[#E2E8F0] overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#64748B]">Group</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#64748B]">Course</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#64748B]">Branch</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#64748B]">Students</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#64748B]">Sessions</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#64748B]">Att.</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#64748B]">Role</th>
                  {canManage && <th className="px-3 py-2.5" />}
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
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${g.role === 'lead' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {g.role}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-3 py-2.5 text-right">
                        <button onClick={() => onRemoveGroup(g)} className="text-[11px] text-red-400 hover:text-red-600 hover:underline">Remove</button>
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

// ═══════════════════════════════════════════════════════════════════════
//  POPUP — TAB: ATTENDANCE
// ═══════════════════════════════════════════════════════════════════════

function AttendanceTab({ stats, groups }: {
  stats: InstructorDetailData['attendance_stats']
  groups: InstructorGroupDetail[]
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1.5 md:gap-3 md:grid-cols-4">
        <StatCard label="Compliance"  value={`${stats.compliance_rate}%`} accent={stats.compliance_rate >= 80} danger={stats.compliance_rate < 60} />
        <StatCard label="Total"       value={stats.total_sessions} />
        <StatCard label="Completed"   value={stats.sessions_completed} />
        <StatCard label="Missing"     value={stats.sessions_missing_attendance} danger={stats.sessions_missing_attendance > 0} />
      </div>
      <div>
        <SectionLabel>Submission Compliance</SectionLabel>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <div className="flex justify-between text-[12px] mb-2">
            <span className="text-[#64748B]">{stats.sessions_with_attendance} sessions with attendance</span>
            <span className={`font-bold ${attColor(stats.compliance_rate)}`}>{stats.compliance_rate}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
            <div className={`h-full rounded-full transition-all ${stats.compliance_rate >= 75 ? 'bg-emerald-500' : stats.compliance_rate >= 55 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${stats.compliance_rate}%` }} />
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
              <div key={g.id} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <p className="text-[13px] font-semibold text-[#0B1F3A]">{g.name}</p>
                    <p className="text-[10px] text-[#94A3B8]">{g.sessions_done} sessions · {g.student_count} students · {g.branch_name}</p>
                  </div>
                  <span className={`text-[18px] font-bold ${attColor(g.attendance_rate)}`}>{g.attendance_rate}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div className={`h-full rounded-full ${g.attendance_rate >= 75 ? 'bg-emerald-400' : g.attendance_rate >= 55 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${g.attendance_rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  POPUP — TAB: FINANCE
// ═══════════════════════════════════════════════════════════════════════

function FinanceTab({ detail }: { detail: InstructorDetailData }) {
  const { instructor, finance, attendance_stats } = detail
  const sessionsCompleted = attendance_stats.sessions_completed
  const salaryPerSession  = instructor.salary_per_session ?? 0
  const estimatedPayout   = salaryPerSession * sessionsCompleted
  const currency          = instructor.currency ?? 'EGP'

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1.5 md:gap-3">
        <StatCard label="Salary / Session"  value={salaryPerSession > 0 ? fmtCurrency(salaryPerSession, currency) : '—'} accent />
        <StatCard label="Sessions Taught"   value={sessionsCompleted} />
        <StatCard label="Estimated Payout"  value={estimatedPayout > 0 ? fmtCurrency(estimatedPayout, currency) : '—'} accent />
        <StatCard label="Currency"          value={currency} />
      </div>

      <div>
        <SectionLabel>Payment Details</SectionLabel>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3 text-[12px]">
          <div className="flex justify-between">
            <span className="text-[#94A3B8]">Instapay</span>
            <span className="font-medium text-[#0B1F3A]">{instructor.instapay_number || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#94A3B8]">Wallet</span>
            <span className="font-medium text-[#0B1F3A]">{instructor.wallet_number || '—'}</span>
          </div>
          {instructor.payment_notes && (
            <div>
              <span className="text-[#94A3B8] block mb-1">Notes</span>
              <p className="text-[#374151] leading-relaxed">{instructor.payment_notes}</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <SectionLabel>Student Finance (via Groups)</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5 md:gap-3">
          <StatCard label="Active Contracts"  value={finance.active_contracts} />
          <StatCard label="With Balance"      value={finance.students_with_balance} danger={finance.students_with_balance > 0} />
          <StatCard label="Total Outstanding" value={finance.total_outstanding > 0 ? fmtCurrency(finance.total_outstanding) : '—'} danger={finance.total_outstanding > 0} />
          <StatCard label="Total Revenue"     value={finance.total_revenue > 0 ? fmtCurrency(finance.total_revenue) : '—'} />
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  POPUP — TAB: NOTES
// ═══════════════════════════════════════════════════════════════════════

function NotesTab({ instructorId, notes, onRefresh }: {
  instructorId: string; notes: InstructorNote[]; onRefresh: () => void
}) {
  const [content, setContent]        = useState('')
  const [category, setCategory]      = useState('general')
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)

  function handleAdd() {
    if (!content.trim()) return
    setError(null)
    const fd = new FormData()
    fd.append('instructor_id', instructorId)
    fd.append('content', content.trim())
    fd.append('category', category)
    startTransition(async () => {
      const res = await saveNoteAction(fd)
      if (res.success) { setContent(''); onRefresh() }
      else setError(res.error?.message ?? 'Failed to save.')
    })
  }

  function handleDelete(noteId: string) {
    if (!confirm('Delete this note?')) return
    startTransition(async () => {
      await deleteNoteAction(noteId)
      onRefresh()
    })
  }

  const catCls = (cat: string) => {
    if (cat === 'strengths')            return 'bg-emerald-100 text-emerald-700'
    if (cat === 'weaknesses')           return 'bg-red-100 text-red-700'
    if (cat === 'communication')        return 'bg-blue-100 text-blue-700'
    if (cat === 'reliability')          return 'bg-purple-100 text-purple-700'
    if (cat === 'classroom_management') return 'bg-amber-100 text-amber-700'
    return 'bg-slate-100 text-slate-600'
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
        <SectionLabel>Add Note</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {NOTE_CATEGORIES.map(c => (
            <button key={c.key} type="button" onClick={() => setCategory(c.key)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition border ${category === c.key ? 'bg-[#FF8A1F] border-[#FF8A1F] text-white' : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#FF8A1F]'}`}>
              {c.label}
            </button>
          ))}
        </div>
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={3}
          placeholder="Write a note…"
          className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#FF8A1F] resize-none"
        />
        {error && <p className="text-[11px] text-red-500">{error}</p>}
        <button onClick={handleAdd} disabled={isPending || !content.trim()}
          className="rounded-lg bg-[#FF8A1F] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#e87c18] disabled:opacity-50 transition">
          {isPending ? 'Saving…' : 'Add Note'}
        </button>
      </div>

      {notes.length === 0 ? (
        <Empty text="No notes yet" sub="Add the first note above" />
      ) : (
        <div className="space-y-2.5">
          {notes.map(n => (
            <div key={n.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${catCls(n.category)}`}>
                    {NOTE_CATEGORIES.find(c => c.key === n.category)?.label ?? n.category}
                  </span>
                  <span className="text-[10px] text-[#94A3B8]">{n.author_name ?? 'Admin'} · {fmtDate(n.created_at)}</span>
                </div>
                <button onClick={() => handleDelete(n.id)} className="text-[11px] text-red-400 hover:text-red-600 shrink-0">Delete</button>
              </div>
              <p className="text-[13px] text-[#374151] leading-relaxed whitespace-pre-wrap">{n.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  INSTRUCTOR POPUP MODAL
// ═══════════════════════════════════════════════════════════════════════

const WA_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"

function InstructorPopup({
  instructor, detail, loading, activeTab, onTabChange, canManage,
  onEdit, onAssignGroup, onArchive, onDelete, onRemoveGroup, onClose, onRefreshDetail,
}: {
  instructor:      InstructorOperationalRow
  detail:          InstructorDetailData | null
  loading:         boolean
  activeTab:       TabKey
  onTabChange:     (t: TabKey) => void
  canManage:       boolean
  onEdit:          () => void
  onAssignGroup:   () => void
  onArchive:       () => void
  onDelete:        () => void
  onRemoveGroup:   (g: InstructorGroupDetail) => void
  onClose:         () => void
  onRefreshDetail: () => void
}) {
  const [overflowOpen, setOverflowOpen] = useState(false)
  const name  = displayName(instructor.first_name, instructor.last_name, instructor.user_email)
  const phone = detail?.instructor.phone ?? instructor.phone
  const wa    = detail?.instructor.whatsapp_number ?? phone
  const waUrl = wa ? buildWhatsAppUrl(wa, null) : null

  function tabCount(key: TabKey): number | null {
    if (!detail) return null
    if (key === 'groups') return detail.groups.length
    if (key === 'notes')  return detail.notes.length
    return null
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />

      {/* Mobile: full-screen bottom sheet | Desktop: centered modal */}
      <div
        className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center md:p-4"
        onClick={onClose}
      >
        <div
          className="w-full flex flex-col bg-white shadow-2xl overflow-hidden rounded-t-2xl h-[95dvh] md:rounded-2xl md:h-[90vh] md:max-w-[1100px]"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Mobile drag handle ── */}
          <div className="flex justify-center pt-2.5 pb-0.5 md:hidden shrink-0">
            <div className="h-1 w-10 rounded-full bg-[#E2E8F0]" />
          </div>

          {/* ── Header ── */}
          <div className="shrink-0 border-b border-[#E2E8F0] bg-white">

            {/* ── Mobile header (compact) ── */}
            <div className="md:hidden px-4 pt-2 pb-3 space-y-2.5">
              {/* Row 1: avatar + name/status + close */}
              <div className="flex items-start gap-2.5">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold bg-[#0B1F3A] text-white`}>
                  {initials(instructor.first_name, instructor.last_name, instructor.user_email)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="text-[14px] font-bold text-[#0B1F3A] leading-tight">{name}</h2>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold capitalize ${statusCls(instructor.status)}`}>
                      {instructor.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    {instructor.instructor_code && (
                      <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-[9px] text-[#94A3B8]">{instructor.instructor_code}</span>
                    )}
                    {instructor.branch_names.map(b => (
                      <span key={b} className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] text-[#64748B]">{b}</span>
                    ))}
                    {phone && (
                      <a href={`tel:${phone}`} className="text-[9px] text-[#64748B]">{phone}</a>
                    )}
                  </div>
                </div>
                <button onClick={onClose} className="shrink-0 mt-0.5 rounded-full border border-[#E2E8F0] p-1.5 text-[#94A3B8] active:bg-[#F1F5F9] transition">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                </button>
              </div>

              {/* Row 2: compact stats strip */}
              <div className="flex items-center gap-2.5 text-[11px]">
                <span><strong className="text-[#0B1F3A]">{instructor.group_count}</strong> <span className="text-[#94A3B8]">groups</span></span>
                <span className="text-[#E2E8F0]">·</span>
                <span><strong className="text-[#0B1F3A]">{instructor.student_count}</strong> <span className="text-[#94A3B8]">students</span></span>
                {instructor.today_sessions_count > 0 && (
                  <>
                    <span className="text-[#E2E8F0]">·</span>
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">{instructor.today_sessions_count} today</span>
                  </>
                )}
              </div>

              {/* Row 3: primary actions + overflow menu */}
              <div className="flex items-center gap-1.5">
                {waUrl && (
                  <a href={waUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg bg-green-500 px-2.5 py-1.5 text-[11px] font-medium text-white active:bg-green-600 transition">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 shrink-0"><path d={WA_PATH}/></svg>
                    WA
                  </a>
                )}
                {canManage && (
                  <button onClick={onAssignGroup}
                    className="flex-1 rounded-lg bg-[#FF8A1F] px-2.5 py-1.5 text-[11px] font-semibold text-white active:bg-[#e87c18] transition text-center">
                    + Assign Group
                  </button>
                )}
                {canManage && (
                  <div className="relative">
                    <button
                      onClick={() => setOverflowOpen(v => !v)}
                      className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[11px] text-[#374151] active:bg-[#F8FAFC] transition flex items-center gap-1"
                    >
                      More
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 shrink-0">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                      </svg>
                    </button>
                    {overflowOpen && (
                      <>
                        <div className="fixed inset-0 z-[51]" onClick={() => setOverflowOpen(false)} />
                        <div className="absolute right-0 top-full mt-1 z-[52] w-36 rounded-xl border border-[#E2E8F0] bg-white shadow-xl overflow-hidden">
                          <button onClick={() => { setOverflowOpen(false); onEdit() }}
                            className="flex w-full items-center px-4 py-3 text-[12px] font-medium text-[#374151] active:bg-[#F8FAFC]">
                            Edit
                          </button>
                          <div className="h-px bg-[#F1F5F9]" />
                          <button onClick={() => { setOverflowOpen(false); onArchive() }}
                            className="flex w-full items-center px-4 py-3 text-[12px] font-medium text-amber-600 active:bg-amber-50">
                            Archive
                          </button>
                          <div className="h-px bg-[#F1F5F9]" />
                          <button onClick={() => { setOverflowOpen(false); onDelete() }}
                            className="flex w-full items-center px-4 py-3 text-[12px] font-medium text-red-600 active:bg-red-50">
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {!canManage && (
                  <button onClick={onClose} className="ml-auto rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[11px] text-[#64748B] active:bg-[#F8FAFC] transition">
                    Close
                  </button>
                )}
              </div>
            </div>

            {/* ── Desktop header (full) ── */}
            <div className="hidden md:block px-6 py-4">
              <div className="flex items-start gap-4">
                <Avatar first={instructor.first_name} last={instructor.last_name} email={instructor.user_email} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-[16px] font-bold text-[#0B1F3A]">{name}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusCls(instructor.status)}`}>
                      {instructor.status.replace('_', ' ')}
                    </span>
                    {instructor.instructor_code && (
                      <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-[10px] text-[#94A3B8]">{instructor.instructor_code}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {instructor.branch_names.map(b => (
                      <span key={b} className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] text-[#64748B]">{b}</span>
                    ))}
                  </div>
                  {phone && (
                    <p className="mt-0.5 text-[12px] text-[#64748B]">
                      <a href={`tel:${phone}`} className="hover:text-[#FF8A1F]">{phone}</a>
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-[11px]">
                    <span className="text-[#64748B]"><strong className="text-[#0B1F3A]">{instructor.group_count}</strong> groups</span>
                    <span className="text-[#64748B]"><strong className="text-[#0B1F3A]">{instructor.student_count}</strong> students</span>
                    {instructor.today_sessions_count > 0 && (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        {instructor.today_sessions_count} today
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 flex-wrap justify-end">
                  {waUrl && (
                    <a href={waUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-lg bg-green-500 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-green-600 transition">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3"><path d={WA_PATH}/></svg>
                      WA
                    </a>
                  )}
                  {canManage && (
                    <>
                      <button onClick={onAssignGroup} className="rounded-lg bg-[#FF8A1F] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#e87c18] transition">Assign Group</button>
                      <button onClick={onEdit} className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[11px] text-[#374151] hover:bg-[#F8FAFC] transition">Edit</button>
                      <button onClick={onArchive} className="rounded-lg border border-red-100 px-2.5 py-1.5 text-[11px] text-red-500 hover:bg-red-50 transition">Archive</button>
                      <button onClick={onDelete} className="rounded-lg border border-red-500 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-600 hover:text-white transition">Delete</button>
                    </>
                  )}
                  <button onClick={onClose} className="rounded-lg border border-[#E2E8F0] p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9] transition">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Tab bar ── */}
          <div className="flex shrink-0 border-b border-[#E2E8F0] bg-white">
            {TABS.map(tab => {
              const count = tabCount(tab.key)
              return (
                <button key={tab.key} onClick={() => onTabChange(tab.key)}
                  className={`flex flex-1 md:flex-none items-center justify-center gap-1 md:gap-1.5 whitespace-nowrap px-2 md:px-5 py-2.5 md:py-3 text-[11px] md:text-[12px] font-medium border-b-2 transition ${activeTab === tab.key ? 'border-[#FF8A1F] text-[#FF8A1F]' : 'border-transparent text-[#64748B] hover:text-[#0B1F3A]'}`}>
                  {tab.label}
                  {count !== null && count > 0 && (
                    <span className={`rounded-full px-1 py-0.5 text-[9px] font-bold ${activeTab === tab.key ? 'bg-[#FF8A1F] text-white' : 'bg-[#F1F5F9] text-[#64748B]'}`}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── Tab content ── */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-5" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
            {loading ? <Spinner /> : !detail ? (
              <div className="flex items-center justify-center py-16 text-[12px] text-[#94A3B8]">Failed to load instructor data</div>
            ) : (
              <>
                {activeTab === 'overview'   && <OverviewTab detail={detail} />}
                {activeTab === 'groups'     && <GroupsTab groups={detail.groups} canManage={canManage} onAssignGroup={onAssignGroup} onRemoveGroup={onRemoveGroup} />}
                {activeTab === 'attendance' && <AttendanceTab stats={detail.attendance_stats} groups={detail.groups} />}
                {activeTab === 'finance'    && <FinanceTab detail={detail} />}
                {activeTab === 'notes'      && <NotesTab instructorId={detail.instructor.id} notes={detail.notes} onRefresh={onRefreshDetail} />}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  INSTRUCTOR FORM MODAL
// ═══════════════════════════════════════════════════════════════════════

function FormField({ label, value, onChange, type = 'text', placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F] transition"
      />
    </div>
  )
}

function InstructorFormModal({ instructor, options, onClose, onSaved }: {
  instructor:       FullInstructor | null
  options:          InstructorFormOptions
  defaultBranchIds?: string[]
  onClose:          () => void
  onSaved:          (id: string) => void
}) {
  const isEdit = !!instructor
  const [section, setSection]        = useState<FormSection>('basic')
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)

  const [email, setEmail]               = useState(instructor?.user_email ?? '')
  const [password, setPassword]         = useState('')
  const [firstName, setFirstName]       = useState(instructor?.first_name ?? '')
  const [lastName, setLastName]         = useState(instructor?.last_name ?? '')
  const [phone, setPhone]               = useState(instructor?.phone ?? '')
  const [altPhone, setAltPhone]         = useState(instructor?.alt_phone ?? '')
  const [branchIds, setBranchIds]       = useState<string[]>(
    instructor?.branch_ids?.length ? instructor.branch_ids : []
  )
  const [status, setStatus]             = useState<string>(instructor?.status ?? 'active')
  const [employeeId, setEmployeeId]     = useState(instructor?.employee_id ?? '')
  const [hireDate, setHireDate]         = useState(instructor?.hire_date ?? '')
  const [bio, setBio]                   = useState(instructor?.bio ?? '')
  const [instagram, setInstagram]       = useState(instructor?.instagram_url ?? '')
  const [facebook, setFacebook]         = useState(instructor?.facebook_url ?? '')
  const [whatsapp, setWhatsapp]         = useState(instructor?.whatsapp_number ?? '')
  const [salary, setSalary]             = useState(instructor?.salary_per_session?.toString() ?? '')
  const [currency, setCurrency]         = useState(instructor?.currency ?? 'EGP')
  const [wallet, setWallet]             = useState(instructor?.wallet_number ?? '')
  const [instapay, setInstapay]         = useState(instructor?.instapay_number ?? '')
  const [paymentNotes, setPaymentNotes] = useState(instructor?.payment_notes ?? '')
  const [specs, setSpecs]               = useState(instructor?.specializations?.join(', ') ?? '')
  const [workingDays, setWorkingDays]   = useState<string[]>(instructor?.working_days ?? [])
  const [maxLoad, setMaxLoad]           = useState(instructor?.max_weekly_load?.toString() ?? '')
  const [internalNotes, setInternalNotes] = useState(instructor?.internal_notes ?? '')

  const SECTIONS: { key: FormSection; label: string }[] = [
    { key: 'basic',        label: 'Basic'        },
    { key: 'account',      label: 'Account'      },
    { key: 'financial',    label: 'Financial'    },
    { key: 'social',       label: 'Social'       },
    { key: 'availability', label: 'Availability' },
  ]

  function handleSubmit() {
    if (!firstName.trim() || !lastName.trim()) { setError('Full name is required.'); return }
    if (!email.trim()) { setError('Email is required.'); return }
    if (branchIds.length === 0) { setError('Select at least one branch.'); return }
    setError(null)

    const fd = new FormData()
    if (isEdit) fd.append('id', instructor!.id)
    fd.append('email', email)
    fd.append('first_name', firstName)
    fd.append('last_name', lastName)
    if (password) fd.append('password', password)
    fd.append('phone', phone)
    fd.append('alt_phone', altPhone)
    branchIds.forEach(id => fd.append('branch_ids', id))
    fd.append('status', status)
    fd.append('employee_id', employeeId)
    fd.append('hire_date', hireDate)
    fd.append('bio', bio)
    fd.append('instagram_url', instagram)
    fd.append('facebook_url', facebook)
    fd.append('whatsapp_number', whatsapp)
    fd.append('salary_per_session', salary)
    fd.append('currency', currency)
    fd.append('wallet_number', wallet)
    fd.append('instapay_number', instapay)
    fd.append('payment_notes', paymentNotes)
    fd.append('specializations', specs)
    workingDays.forEach(d => fd.append('working_days', d))
    fd.append('max_weekly_load', maxLoad)
    fd.append('internal_notes', internalNotes)

    startTransition(async () => {
      const res = isEdit ? await updateInstructorModalAction(fd) : await createInstructorModalAction(fd)
      if (res.success) {
        onSaved(isEdit ? instructor!.id : (res.data as { id: string })?.id ?? '')
      } else {
        setError(res.error?.message ?? 'Failed to save.')
      }
    })
  }

  function toggleBranch(id: string) {
    setBranchIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/50 md:items-center md:justify-center md:p-4">
      <div className="w-full flex flex-col bg-white shadow-2xl overflow-hidden rounded-t-2xl h-[95dvh] md:rounded-2xl md:h-[88vh] md:max-w-2xl">
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 pb-0.5 md:hidden shrink-0">
          <div className="h-1 w-10 rounded-full bg-[#E2E8F0]" />
        </div>

        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 md:px-6 py-3 md:py-4 shrink-0">
          <h2 className="text-[14px] md:text-[15px] font-bold text-[#0B1F3A]">
            {isEdit ? `Edit — ${displayName(instructor!.first_name, instructor!.last_name, instructor!.user_email)}` : 'New Instructor'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#F1F5F9]">✕</button>
        </div>

        <div className="flex border-b border-[#E2E8F0] px-2 md:px-4 shrink-0 overflow-x-auto">
          {SECTIONS.map(s => (
            <button key={s.key} onClick={() => setSection(s.key)}
              className={`flex-1 md:flex-none px-2 md:px-3 py-2.5 text-[11px] md:text-[12px] font-medium border-b-2 transition whitespace-nowrap text-center ${section === s.key ? 'border-[#FF8A1F] text-[#FF8A1F]' : 'border-transparent text-[#64748B] hover:text-[#0B1F3A]'}`}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-5 space-y-4">
          {section === 'basic' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="First Name" value={firstName} onChange={setFirstName} required />
                <FormField label="Last Name"  value={lastName}  onChange={setLastName}  required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Phone"      value={phone}    onChange={setPhone}    placeholder="+20 1XX XXX XXXX" />
                <FormField label="Alt. Phone" value={altPhone} onChange={setAltPhone} />
              </div>

              {/* Multi-select branches */}
              <div>
                <label className="mb-2 block text-[12px] font-medium text-[#374151]">
                  Branches <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {options.branches.map(b => {
                    const active = branchIds.includes(b.id)
                    return (
                      <button key={b.id} type="button" onClick={() => toggleBranch(b.id)}
                        className={`rounded-full px-3 py-1.5 text-[12px] font-medium border transition ${active ? 'bg-[#0B1F3A] border-[#0B1F3A] text-white' : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#0B1F3A]'}`}>
                        {b.name}
                      </button>
                    )
                  })}
                </div>
                {branchIds.length === 0 && (
                  <p className="mt-1 text-[11px] text-red-400">Select at least one branch</p>
                )}
                {branchIds.length > 0 && (
                  <p className="mt-1 text-[11px] text-[#94A3B8]">Primary branch: {options.branches.find(b => b.id === branchIds[0])?.name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F]">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on_leave">On Leave</option>
                  </select>
                </div>
                <FormField label="Employee ID" value={employeeId} onChange={setEmployeeId} />
              </div>
              <FormField label="Hire Date" value={hireDate} onChange={setHireDate} type="date" />
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">Bio</label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Short instructor biography…"
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F] resize-none" />
              </div>
            </>
          )}

          {section === 'account' && (
            <>
              <FormField label={`Email${isEdit ? ' (changes login)' : ''}`} type="email" value={email} onChange={setEmail} required />
              <FormField label={isEdit ? 'New Password (leave blank to keep)' : 'Password'} type="password" value={password} onChange={setPassword} placeholder="min. 6 characters" required={!isEdit} />
              <div>
                <label className="mb-2 block text-[12px] font-medium text-[#374151]">Specializations</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {SPECIALIZATIONS_LIST.map(s => {
                    const active = specs.split(',').map(x => x.trim()).includes(s)
                    return (
                      <button key={s} type="button"
                        onClick={() => {
                          const cur = specs.split(',').map(x => x.trim()).filter(Boolean)
                          setSpecs(active ? cur.filter(x => x !== s).join(', ') : [...cur, s].join(', '))
                        }}
                        className={`rounded-full px-3 py-1 text-[12px] font-medium border transition ${active ? 'bg-[#FF8A1F] border-[#FF8A1F] text-white' : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#FF8A1F]'}`}>
                        {s}
                      </button>
                    )
                  })}
                </div>
                <input value={specs} onChange={e => setSpecs(e.target.value)} placeholder="Or type comma-separated…"
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[12px] outline-none focus:border-[#FF8A1F]" />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">Internal Notes</label>
                <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={4} placeholder="Private admin notes…"
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F] resize-none" />
              </div>
            </>
          )}

          {section === 'financial' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Salary per Session" type="number" value={salary} onChange={setSalary} />
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">Currency</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F]">
                    <option value="EGP">EGP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              <FormField label="Instapay Number" value={instapay}      onChange={setInstapay}     placeholder="01X XXXX XXXX" />
              <FormField label="Wallet Number"   value={wallet}        onChange={setWallet}       />
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">Payment Notes</label>
                <textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} rows={2}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F] resize-none" />
              </div>
            </>
          )}

          {section === 'social' && (
            <>
              <FormField label="WhatsApp Number" value={whatsapp}  onChange={setWhatsapp}  placeholder="+20 1XX XXX XXXX" />
              <FormField label="Instagram URL"   value={instagram} onChange={setInstagram} placeholder="https://instagram.com/…" />
              <FormField label="Facebook URL"    value={facebook}  onChange={setFacebook}  placeholder="https://facebook.com/…" />
            </>
          )}

          {section === 'availability' && (
            <>
              <div>
                <label className="mb-2 block text-[12px] font-medium text-[#374151]">Working Days</label>
                <div className="flex flex-wrap gap-2">
                  {WORKING_DAYS.map(d => (
                    <button key={d} type="button"
                      onClick={() => setWorkingDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                      className={`rounded-full px-3 py-1 text-[12px] font-medium border transition ${workingDays.includes(d) ? 'bg-[#0B1F3A] border-[#0B1F3A] text-white' : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#0B1F3A]'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <FormField label="Max Weekly Load (sessions)" type="number" value={maxLoad} onChange={setMaxLoad} />
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 md:px-6 py-3 md:py-4 shrink-0">
          {error ? <p className="text-[12px] text-red-500 flex-1 mr-4">{error}</p> : <div />}
          <div className="flex gap-2 shrink-0">
            <button onClick={onClose} className="rounded-lg border border-[#E2E8F0] px-3 md:px-4 py-2 text-[12px] md:text-[13px] text-[#64748B] hover:bg-[#F8FAFC] transition">Cancel</button>
            <button onClick={handleSubmit} disabled={isPending}
              className="rounded-lg bg-[#FF8A1F] px-4 md:px-5 py-2 text-[12px] md:text-[13px] font-semibold text-white hover:bg-[#e87c18] disabled:opacity-50 transition">
              {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Instructor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  ASSIGN GROUP MODAL
// ═══════════════════════════════════════════════════════════════════════

function AssignGroupModal({ instructorId, currentGroupIds, options, onClose, onAssigned }: {
  instructorId:    string
  currentGroupIds: string[]
  options:         InstructorFormOptions
  onClose:         () => void
  onAssigned:      () => void
}) {
  const [groupId, setGroupId]              = useState('')
  const [role, setRole]                    = useState<'lead' | 'assistant'>('lead')
  const [q, setQ]                          = useState('')
  const [allocatedSessions, setAllocated]  = useState<string>('')
  const [isPending, startTransition]       = useTransition()
  const [error, setError]                  = useState<string | null>(null)

  const selectedGroup = options.groups.find(g => g.id === groupId) ?? null
  // Use canonical allocation-range-based handoff point (immune to cancelled/deleted schedules).
  const fromSession   = selectedGroup ? selectedGroup.next_from_session : 1
  const remaining     = selectedGroup ? Math.max(0, (selectedGroup.total_sessions ?? 0) - fromSession + 1) : 0

  // options.groups is already scoped to the TL's branches at page-load time.
  // Filtering further by the instructor's home branch would wrongly exclude
  // groups from branches the instructor teaches cross-branch but hasn't been
  // formally added to via instructor_branches.
  const eligible = options.groups.filter(g =>
    g.status !== 'cancelled' &&
    g.status !== 'archived' &&
    !currentGroupIds.includes(g.id) &&
    (!q || g.name.toLowerCase().includes(q.toLowerCase()) || (g.code ?? '').toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/50 md:items-center md:justify-center md:p-4">
      <div className="w-full flex flex-col bg-white shadow-2xl overflow-hidden rounded-t-2xl max-h-[90dvh] md:rounded-2xl md:max-h-none md:max-w-lg">
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 pb-0.5 md:hidden shrink-0">
          <div className="h-1 w-10 rounded-full bg-[#E2E8F0]" />
        </div>

        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 md:px-6 py-3 md:py-4 shrink-0">
          <h2 className="text-[14px] md:text-[15px] font-bold text-[#0B1F3A]">Assign Group</h2>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0B1F3A]">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">Role</label>
            <div className="flex gap-2">
              {(['lead', 'assistant'] as const).map(r => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={`flex-1 rounded-lg border py-2 text-[13px] font-medium capitalize transition ${role === r ? 'border-[#FF8A1F] bg-[#FFF7ED] text-[#FF8A1F]' : 'border-[#E2E8F0] text-[#64748B] hover:border-[#FF8A1F]'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">Search Groups</label>
            <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Group name or code…"
              className="mb-2 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F]"
            />
            <div className="max-h-64 overflow-y-auto rounded-xl border border-[#E2E8F0]">
              {eligible.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12px] text-[#94A3B8]">
                  {q ? 'No groups match' : currentGroupIds.length > 0 ? 'All eligible groups already assigned' : 'No active groups available to assign'}
                </p>
              ) : (
                eligible.map(g => (
                  <button key={g.id} type="button" onClick={() => { setGroupId(g.id); setAllocated('') }}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left border-b border-[#F1F5F9] last:border-0 transition ${groupId === g.id ? 'bg-[#FFF7ED]' : 'hover:bg-[#F8FAFC]'}`}>
                    <div>
                      <p className="text-[13px] font-semibold text-[#0B1F3A]">{g.name}</p>
                      <p className="text-[11px] text-[#64748B]">{g.branch_name}{g.code ? ` · ${g.code}` : ''}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-[12px] text-[#64748B]">{g.student_count} students</p>
                      {g.has_instructor && <p className="text-[10px] text-amber-500">Has instructor</p>}
                      {groupId === g.id && <div className="mt-0.5 h-2 w-2 rounded-full bg-[#FF8A1F] mx-auto" />}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
          {/* Session allocation — only shown after a group is selected */}
          {selectedGroup && (
            remaining <= 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
                All {selectedGroup.total_sessions ?? '?'} sessions are already allocated to other instructors. Assigning this instructor will give them an open-ended range.
              </div>
            ) : (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">From Session</label>
                  <div className="flex h-9 items-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[13px] text-[#64748B]">
                    {fromSession}
                    <span className="ml-1 text-[11px] text-[#94A3B8]">of {selectedGroup.total_sessions ?? '∞'}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-[#94A3B8]">Computed from existing allocations</p>
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">
                    Sessions to Teach
                    <span className="ml-1 text-[11px] font-normal text-[#94A3B8]">({remaining} left)</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={remaining}
                    placeholder={String(remaining)}
                    value={allocatedSessions}
                    onChange={e => setAllocated(e.target.value)}
                    className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] outline-none focus:border-[#FF8A1F]"
                  />
                  {allocatedSessions !== '' && Number(allocatedSessions) > 0 && (
                    <p className="mt-0.5 text-[10px] text-[#64748B]">
                      Will teach sessions {fromSession}–{fromSession + Number(allocatedSessions) - 1}
                    </p>
                  )}
                </div>
              </div>
            )
          )}
          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>

        {/* Sticky footer — always visible */}
        <div className="shrink-0 border-t border-[#E2E8F0] p-4 md:p-4 flex gap-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button onClick={onClose} className="flex-1 rounded-lg border border-[#E2E8F0] py-2.5 text-[13px] text-[#64748B] hover:bg-[#F8FAFC] transition">Cancel</button>
          <button
            onClick={() => {
              if (!groupId) { setError('Select a group.'); return }
              const parsed = allocatedSessions !== '' ? parseInt(allocatedSessions, 10) : undefined
              if (parsed !== undefined && (isNaN(parsed) || parsed < 1)) { setError('Sessions to teach must be a positive number.'); return }
              startTransition(async () => {
                const res = await assignGroupModalAction(instructorId, groupId, role, fromSession, parsed)
                if (res.success) onAssigned()
                else setError(res.error?.message ?? 'Failed.')
              })
            }}
            disabled={isPending || !groupId}
            className="flex-1 rounded-lg bg-[#FF8A1F] py-2.5 text-[13px] font-semibold text-white hover:bg-[#e87c18] disabled:opacity-50 transition">
            {isPending ? 'Assigning…' : 'Assign Group'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  CONFIRM ARCHIVE
// ═══════════════════════════════════════════════════════════════════════

function ConfirmArchive({ name, onConfirm, onCancel, isPending }: {
  name: string; onConfirm: () => void; onCancel: () => void; isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-[15px] font-bold text-[#0B1F3A]">Archive Instructor</h2>
        <p className="mt-2 text-[13px] text-[#64748B]">
          Archive <strong>{name}</strong>? They will be marked inactive and lose portal access.
        </p>
        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] text-[#64748B] hover:bg-[#F8FAFC] transition">Cancel</button>
          <button onClick={onConfirm} disabled={isPending}
            className="flex-1 rounded-lg bg-red-500 py-2 text-[13px] font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition">
            {isPending ? 'Archiving…' : 'Archive'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════════════════

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-6 right-6 z-[100] flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-medium shadow-lg ${
      type === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-red-200 bg-red-50 text-red-700'
    }`}>
      {type === 'success' ? (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
        </svg>
      )}
      {msg}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  CONFIRM DELETE
// ═══════════════════════════════════════════════════════════════════════

function ConfirmDelete({
  name, instructorCode, branchNames, groupCount, studentCount,
  activeGroupCount, futureSessionCount,
  onConfirm, onCancel, onArchiveInstead, isPending,
}: {
  name:               string
  instructorCode:     string | null
  branchNames:        string[]
  groupCount:         number
  studentCount:       number
  activeGroupCount:   number
  futureSessionCount: number
  onConfirm:          () => void
  onCancel:           () => void
  onArchiveInstead:   () => void
  isPending:          boolean
}) {
  const [confirmText, setConfirmText] = useState('')
  const isBlocked  = activeGroupCount > 0 || futureSessionCount > 0
  const canConfirm = !isBlocked && confirmText === 'DELETE' && !isPending

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="border-b border-red-100 bg-red-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-red-600">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0B1F3A]">Delete Instructor</h2>
              <p className="text-[12px] text-red-500">This action cannot be undone</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold text-[#0B1F3A]">{name}</p>
              {instructorCode && (
                <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-[10px] text-[#94A3B8]">{instructorCode}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {branchNames.map(b => (
                <span key={b} className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] text-[#64748B]">{b}</span>
              ))}
            </div>
            <div className="flex gap-4 text-[11px] text-[#64748B]">
              <span><strong className="text-[#0B1F3A]">{groupCount}</strong> groups</span>
              <span><strong className="text-[#0B1F3A]">{studentCount}</strong> students affected</span>
            </div>
          </div>

          {isBlocked ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-1.5">
              <p className="text-[12px] font-semibold text-amber-800">Cannot delete — active obligations remain:</p>
              {activeGroupCount > 0 && (
                <p className="text-[12px] text-amber-700">• {activeGroupCount} active group(s) still assigned</p>
              )}
              {futureSessionCount > 0 && (
                <p className="text-[12px] text-amber-700">• {futureSessionCount} upcoming session(s) scheduled</p>
              )}
              <p className="mt-1 text-[11px] text-amber-600">Remove from active groups and cancel upcoming sessions first, or archive to preserve the record.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-red-100 bg-red-50 p-3">
                <p className="text-[12px] text-red-700">
                  This permanently removes the instructor and operational history links. The auth account will be disabled. Audit data is preserved.
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[#374151]">
                  Type <strong className="font-mono text-red-600">DELETE</strong> to confirm
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  autoFocus
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 font-mono text-[13px] outline-none focus:border-red-400 transition"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 border-t border-[#E2E8F0] px-6 py-4">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] text-[#64748B] hover:bg-[#F8FAFC] transition">
            Cancel
          </button>
          {isBlocked ? (
            <button onClick={onArchiveInstead} className="flex-1 rounded-lg bg-amber-500 py-2 text-[13px] font-semibold text-white hover:bg-amber-600 transition">
              Archive Instead
            </button>
          ) : (
            <button
              onClick={onConfirm}
              disabled={!canConfirm}
              className="flex-1 rounded-lg border border-red-500 bg-white py-2 text-[13px] font-semibold text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition">
              {isPending ? 'Deleting…' : 'Delete Permanently'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN CLIENT
// ═══════════════════════════════════════════════════════════════════════

export default function InstructorsWorkspaceClient({
  instructors: initialInstructors,
  options:     initialOptions,
  branchIds,
  canManage,
}: {
  instructors: InstructorOperationalRow[]
  options:     InstructorFormOptions
  branchIds:   string[]
  canManage:   boolean
}) {
  const [instructors, setInstructors] = useState(initialInstructors)
  const [options]                     = useState(initialOptions)

  const [viewMode, setViewMode]         = useState<ViewMode>('grid')
  const [searchQ, setSearchQ]           = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [quickFilter, setQuickFilter]   = useState<QuickFilter>('')

  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [detail, setDetail]               = useState<InstructorDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeTab, setActiveTab]         = useState<TabKey>('overview')

  const [showForm, setShowForm]                   = useState(false)
  const [editingInstructor, setEditingInstructor] = useState<FullInstructor | null>(null)
  const [showAssignGroup, setShowAssignGroup]     = useState(false)
  const [showArchive, setShowArchive]             = useState(false)
  const [isArchiving, startArchiveTransition]     = useTransition()
  const [showDelete, setShowDelete]               = useState(false)
  const [isDeleting, startDeleteTransition]       = useTransition()
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const selectedInstructor = instructors.find(i => i.id === selectedId) ?? null
  const visible = filterInstructors(instructors, searchQ, branchFilter, quickFilter)

  const totalActive    = instructors.filter(i => i.status === 'active').length
  const totalAssigned  = instructors.filter(i => i.group_count > 0).length
  const totalUnassigned = instructors.filter(i => i.group_count === 0).length

  const pendingEditRef   = useRef(false)
  const pendingDeleteRef = useRef(false)

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    setDetail(null)
    const res = await getInstructorDetailAction(id)
    if (res.success) {
      setDetail(res.data)
      if (pendingEditRef.current) {
        setEditingInstructor(res.data.instructor)
        setShowForm(true)
        pendingEditRef.current = false
      }
      if (pendingDeleteRef.current) {
        setShowDelete(true)
        pendingDeleteRef.current = false
      }
    }
    setDetailLoading(false)
  }, [])

  function selectInstructor(i: InstructorOperationalRow) {
    setSelectedId(i.id)
    setActiveTab('overview')
    loadDetail(i.id)
  }

  function openAssignForInstructor(i: InstructorOperationalRow, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedId(i.id)
    loadDetail(i.id)
    setShowAssignGroup(true)
  }

  function openEditForInstructor(i: InstructorOperationalRow, e: React.MouseEvent) {
    e.stopPropagation()
    if (selectedId === i.id && detail) {
      setEditingInstructor(detail.instructor)
      setShowForm(true)
    } else {
      setSelectedId(i.id)
      setActiveTab('overview')
      pendingEditRef.current = true
      loadDetail(i.id)
    }
  }

  function refreshDetail() { if (selectedId) loadDetail(selectedId) }

  async function refreshList() {
    const res = await refreshInstructorListAction(branchIds)
    if (res.success) setInstructors(res.data)
  }

  function handleSaved(id: string) {
    setShowForm(false)
    refreshList()
    if (selectedId === id) refreshDetail()
  }

  function handleAssigned() { setShowAssignGroup(false); refreshDetail(); refreshList() }

  function handleRemoveGroup(g: InstructorGroupDetail) {
    if (!selectedId || !confirm(`Remove instructor from "${g.name}"?`)) return
    removeGroupModalAction(selectedId, g.id).then(res => {
      if (res.success) { refreshDetail(); refreshList() }
    })
  }

  function confirmArchive() {
    if (!selectedId) return
    startArchiveTransition(async () => {
      const res = await archiveInstructorAction(selectedId)
      if (res.success) {
        setShowArchive(false)
        setSelectedId(null)
        setDetail(null)
        refreshList()
      }
    })
  }

  function openDeleteForInstructor(i: InstructorOperationalRow, e: React.MouseEvent) {
    e.stopPropagation()
    if (selectedId === i.id && detail) {
      setShowDelete(true)
    } else {
      setSelectedId(i.id)
      setActiveTab('overview')
      pendingDeleteRef.current = true
      loadDetail(i.id)
    }
  }

  function confirmDelete() {
    if (!selectedId) return
    const deletedId = selectedId
    startDeleteTransition(async () => {
      const res = await deleteInstructorAction(deletedId)
      if (res.success) {
        setShowDelete(false)
        setSelectedId(null)
        setDetail(null)
        setInstructors(prev => prev.filter(i => i.id !== deletedId))
        setToast({ msg: 'Instructor permanently deleted.', type: 'success' })
      } else {
        setShowDelete(false)
        setToast({ msg: res.error?.message ?? 'Delete failed.', type: 'error' })
      }
    })
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const currentGroupIds = detail?.groups.map(g => g.id) ?? []

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-[#F8FAFC]">

      {/* ── TOP BAR ── */}
      <div className="shrink-0 border-b border-[#E2E8F0] bg-white px-4 md:px-6 py-2 md:py-3">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[#0B1F3A]">Instructors</h1>
            <p className="text-xs text-[#64748B] md:text-[11px]">{instructors.length} total · {totalActive} active · {totalAssigned} assigned · {totalUnassigned} unassigned</p>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            {/* View toggle */}
            <div className="flex rounded-lg border border-[#E2E8F0] overflow-hidden">
              <button onClick={() => setViewMode('grid')}
                className={`px-2.5 md:px-3 py-1.5 transition ${viewMode === 'grid' ? 'bg-[#0B1F3A] text-white' : 'bg-white text-[#64748B] hover:bg-[#F8FAFC]'}`}
                title="Grid view">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
                </svg>
              </button>
              <button onClick={() => setViewMode('list')}
                className={`px-2.5 md:px-3 py-1.5 transition ${viewMode === 'list' ? 'bg-[#0B1F3A] text-white' : 'bg-white text-[#64748B] hover:bg-[#F8FAFC]'}`}
                title="List view">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M3 4a1 1 0 000 2h14a1 1 0 100-2H3zm0 4a1 1 0 000 2h14a1 1 0 100-2H3zm0 4a1 1 0 000 2h14a1 1 0 100-2H3zm0 4a1 1 0 000 2h14a1 1 0 100-2H3z" clipRule="evenodd"/>
                </svg>
              </button>
            </div>
            {canManage && (
              <button
                onClick={() => { setEditingInstructor(null); setShowForm(true) }}
                className="flex items-center gap-1 rounded-lg bg-[#FF8A1F] px-2.5 md:px-3 py-1.5 md:py-2 text-[13px] font-semibold text-white hover:bg-[#e87c18] active:scale-[0.98] transition">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/>
                </svg>
                <span className="hidden sm:inline">Add Instructor</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <div className="shrink-0 border-b border-[#E2E8F0] bg-white px-3 md:px-6 py-2 md:py-2.5">
        <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-3">
          {/* Row 1: search + mobile count */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <svg viewBox="0 0 20 20" fill="currentColor" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#CBD5E1]">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
              </svg>
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Search name, code, branch…"
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] pl-8 pr-3 py-1.5 text-[11px] md:text-[12px] outline-none focus:border-[#FF8A1F] focus:bg-white transition"
              />
            </div>
            <span className="md:hidden text-[10px] text-[#94A3B8] shrink-0 whitespace-nowrap">
              {visible.length !== instructors.length ? `${visible.length}/${instructors.length}` : `${instructors.length}`}
            </span>
          </div>
          {/* Row 2: selects + clear + desktop count */}
          <div className="flex items-center gap-1.5 md:gap-3">
            {options.branches.length > 1 && (
              <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
                className="flex-1 md:flex-none rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 md:px-3 py-1 md:py-1.5 text-[11px] md:text-[12px] text-[#374151] outline-none focus:border-[#FF8A1F] focus:bg-white transition">
                <option value="">All Branches</option>
                {options.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            <select value={quickFilter} onChange={e => setQuickFilter(e.target.value as QuickFilter)}
              className={`flex-1 md:flex-none rounded-lg border px-2 md:px-3 py-1 md:py-1.5 text-[11px] md:text-[12px] outline-none transition ${quickFilter ? 'border-[#FF8A1F] bg-[#FFF7ED] text-[#FF8A1F]' : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#374151] focus:border-[#FF8A1F] focus:bg-white'}`}>
              <option value="">All Status</option>
              <option value="active">Active ({instructors.filter(i => i.status === 'active').length})</option>
              <option value="inactive">Inactive ({instructors.filter(i => i.status === 'inactive').length})</option>
              <option value="on_leave">On Leave ({instructors.filter(i => i.status === 'on_leave').length})</option>
              <option value="no_groups">No Groups ({instructors.filter(i => i.group_count === 0).length})</option>
            </select>
            {(searchQ || branchFilter || quickFilter) && (
              <button onClick={() => { setSearchQ(''); setBranchFilter(''); setQuickFilter('') }}
                className="rounded-lg border border-[#E2E8F0] px-2 md:px-3 py-1 md:py-1.5 text-[11px] md:text-[12px] text-[#64748B] hover:bg-[#F1F5F9] transition shrink-0">
                Clear
              </button>
            )}
            <span className="hidden md:block ml-auto text-[11px] text-[#94A3B8] whitespace-nowrap">
              {visible.length !== instructors.length ? `${visible.length} of ${instructors.length}` : `${instructors.length} instructors`}
            </span>
          </div>
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div className="flex-1 overflow-y-auto pb-bottom-nav md:pb-0">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mb-4 h-12 w-12 text-[#E2E8F0]">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            <p className="text-[15px] font-semibold text-[#94A3B8]">No instructors found</p>
            <p className="mt-1 text-[12px] text-[#CBD5E1]">Try adjusting your filters</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="p-2 md:p-5 grid grid-cols-1 gap-1.5 md:gap-3 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {visible.map(i => (
              <InstructorGridCard
                key={i.id}
                instructor={i}
                selected={selectedId === i.id}
                onClick={() => selectInstructor(i)}
                canManage={canManage}
                onAssign={e => openAssignForInstructor(i, e)}
                onEdit={e => openEditForInstructor(i, e)}
                onDelete={e => openDeleteForInstructor(i, e)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[#E2E8F0] bg-white">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#64748B]">Instructor</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#64748B]">Branches</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-[#64748B]">Groups</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-[#64748B]">Students</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-[#64748B]">Today</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-[#64748B]">Att.%</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#64748B]">Salary/Sess</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#64748B]">Status</th>
                  {canManage && <th className="px-3 py-3 text-[11px] font-semibold text-[#64748B]">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map(i => (
                  <InstructorListRow
                    key={i.id}
                    instructor={i}
                    selected={selectedId === i.id}
                    onClick={() => selectInstructor(i)}
                    canManage={canManage}
                    onAssign={e => openAssignForInstructor(i, e)}
                    onEdit={e => openEditForInstructor(i, e)}
                    onDelete={e => openDeleteForInstructor(i, e)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── INSTRUCTOR POPUP ── */}
      {selectedId && selectedInstructor && (
        <InstructorPopup
          instructor={selectedInstructor}
          detail={detail}
          loading={detailLoading}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          canManage={canManage}
          onEdit={() => { setEditingInstructor(detail?.instructor ?? null); setShowForm(true) }}
          onAssignGroup={() => setShowAssignGroup(true)}
          onArchive={() => setShowArchive(true)}
          onDelete={() => setShowDelete(true)}
          onRemoveGroup={handleRemoveGroup}
          onClose={() => { setSelectedId(null); setDetail(null) }}
          onRefreshDetail={refreshDetail}
        />
      )}

      {/* ── MODALS ── */}
      {showForm && (
        <InstructorFormModal
          instructor={editingInstructor}
          options={options}
          defaultBranchIds={branchIds}
          onClose={() => { setShowForm(false); setEditingInstructor(null) }}
          onSaved={handleSaved}
        />
      )}
      {showAssignGroup && selectedId && (
        <AssignGroupModal
          instructorId={selectedId}
          currentGroupIds={currentGroupIds}
          options={options}
          onClose={() => setShowAssignGroup(false)}
          onAssigned={handleAssigned}
        />
      )}
      {showArchive && selectedInstructor && (
        <ConfirmArchive
          name={displayName(selectedInstructor.first_name, selectedInstructor.last_name, selectedInstructor.user_email)}
          onConfirm={confirmArchive}
          onCancel={() => setShowArchive(false)}
          isPending={isArchiving}
        />
      )}
      {showDelete && selectedInstructor && (
        <ConfirmDelete
          name={displayName(selectedInstructor.first_name, selectedInstructor.last_name, selectedInstructor.user_email)}
          instructorCode={selectedInstructor.instructor_code}
          branchNames={selectedInstructor.branch_names}
          groupCount={selectedInstructor.group_count}
          studentCount={selectedInstructor.student_count}
          activeGroupCount={detail?.groups.filter(g => g.status === 'active').length ?? 0}
          futureSessionCount={detail?.sessions.filter(s => isFuture(s.scheduled_at) && s.status !== 'cancelled').length ?? 0}
          onConfirm={confirmDelete}
          onCancel={() => setShowDelete(false)}
          onArchiveInstead={() => { setShowDelete(false); setShowArchive(true) }}
          isPending={isDeleting}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
