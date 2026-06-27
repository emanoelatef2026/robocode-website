import type { InstructorOperationalRow } from '@/modules/instructors/types'
import type { QuickFilter } from './types'
export { fmtDate, fmtCurrency } from '@/components/shared/workspace/utils'

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function initials(first: string | null, last: string | null, email: string): string {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase()
  if (first) return first.slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

export function displayName(first: string | null, last: string | null, email: string): string {
  if (first && last) return `${first} ${last}`
  if (first) return first
  return email
}

export function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString()
}

export function isFuture(iso: string): boolean {
  return new Date(iso) > new Date()
}

export function attColor(rate: number): string {
  if (rate >= 75) return 'text-[#10B981]'
  if (rate >= 55) return 'text-[#F59E0B]'
  return 'text-[#EF4444]'
}

export function statusCls(status: string): string {
  if (status === 'active')   return 'bg-[#E7F8EE] text-[#15803D]'
  if (status === 'inactive') return 'bg-[#F1F5F9] text-[#475569]'
  return 'bg-[#FFFBEB] text-[#B45309]'
}

export function sessionStatusMeta(status: string, attendance_submitted: boolean, scheduled_at: string) {
  if (status === 'completed' && !attendance_submitted)
    return { label: 'Missing Att.', cls: 'bg-[#FEE2E2] text-[#DC2626]', dot: 'bg-[#EF4444]' }
  if (status === 'completed')
    return { label: 'Done',      cls: 'bg-[#E7F8EE] text-[#15803D]',  dot: 'bg-[#10B981]' }
  if (status === 'ongoing')
    return { label: 'Live',      cls: 'bg-[#EFF6FF] text-[#1D4ED8]',  dot: 'bg-[#38BDF8] animate-pulse' }
  if (status === 'cancelled')
    return { label: 'Cancelled', cls: 'bg-[#F1F5F9] text-[#475569]',  dot: 'bg-[#94A3B8]' }
  if (isFuture(scheduled_at))
    return { label: 'Upcoming',  cls: 'bg-[#FFFBEB] text-[#B45309]',  dot: 'bg-[#F59E0B]' }
  return { label: 'Scheduled', cls: 'bg-[#F1F5F9] text-[#475569]', dot: 'bg-[#94A3B8]' }
}

export function filterInstructors(
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
