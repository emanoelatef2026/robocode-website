import type { GroupOperationalRow, GroupStudentOption } from '@/modules/groups/operational'
import type { GroupDetailStudent } from '@/modules/groups/modal-actions'
import type { StudentOperationsRow } from '@/modules/finance/types'
import type { StudentResult } from '../../finance/EnrollmentWizard'
import type { Filters } from './types'
import { getCohortLifecycleStage } from '@/modules/groups/lifecycle-stage'
export { fmtDate, fmtCurrency } from '@/components/shared/workspace/utils'

// ── Date / time formatters ───────────────────────────────────────────

export const DAYS_FULL: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

export const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

export function fmt12(time: string | null): string | null {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export function parseLocalDate(iso: string): Date {
  const [y, mo, d] = iso.split('-').map(Number)
  return new Date(y, mo - 1, d)
}

export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  const clean = iso.slice(0, 10)
  const [y, m, d] = clean.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Filter logic ─────────────────────────────────────────────────────

export function applyFilters(groups: GroupOperationalRow[], f: Filters): GroupOperationalRow[] {
  return groups.filter(g => {
    if (f.branch_id && g.branch_id !== f.branch_id) return false
    if (f.quickFilter === 'draft'          && getCohortLifecycleStage(g) !== 'draft')                  return false
    if (f.quickFilter === 'open'           && getCohortLifecycleStage(g) !== 'open')                   return false
    if (f.quickFilter === 'running'        && getCohortLifecycleStage(g) !== 'running')                return false
    if (f.quickFilter === 'completed'      && getCohortLifecycleStage(g) !== 'completed')               return false
    if (f.quickFilter === 'archived'       && g.status !== 'archived')                                 return false
    if (f.quickFilter === 'cancelled'      && g.status !== 'cancelled')                                return false
    if (f.quickFilter === 'no_instructor'  && g.has_instructor)                                        return false
    if (f.quickFilter === 'low_attendance' && !g.is_low_attendance)                                    return false
    if (f.quickFilter === 'low_capacity'   && !g.is_low_capacity)                                      return false
    if (f.quickFilter === 'overloaded'     && !g.is_overloaded)                                        return false
    if (f.quickFilter === 'starts_soon'    && !g.starts_soon)                                          return false
    if (f.q) {
      const q   = f.q.toLowerCase()
      const hay = [g.name, g.code, g.lead_instructor_name, g.course_name, g.branch_name]
        .filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

// ── KPI builders ─────────────────────────────────────────────────────

export function buildKpis(groups: GroupOperationalRow[]) {
  return [
    { label: 'Active',         value: groups.filter(g => g.status === 'active').length,  color: 'bg-[#38BDF8]' },
    { label: 'Low Attendance', value: groups.filter(g => g.is_low_attendance).length,     color: 'bg-[#EF4444]' },
    { label: 'No Instructor',  value: groups.filter(g => !g.has_instructor).length,       color: 'bg-[#F59E0B]' },
    { label: 'Under Capacity', value: groups.filter(g => g.is_low_capacity).length,       color: 'bg-[#FF8A1F]' },
    { label: 'Overloaded',     value: groups.filter(g => g.is_overloaded).length,         color: 'bg-[#7C3AED]' },
    { label: 'Starting Soon',  value: groups.filter(g => g.starts_soon).length,           color: 'bg-[#10B981]' },
  ]
}

export function buildPageKpis(groups: GroupOperationalRow[]) {
  const totalStudents = groups.reduce((s, g) => s + (g.student_count ?? 0), 0)
  return [
    { label: 'Total Groups', value: groups.length,                                                                  dotColor: 'bg-[#94A3B8]',  bgColor: 'bg-white',        valueColor: 'text-[#0B1F3A]'  },
    { label: 'Active',       value: groups.filter(g => g.status === 'active').length,                               dotColor: 'bg-[#10B981]',  bgColor: 'bg-[#E7F8EE]/60', valueColor: 'text-[#15803D]'  },
    { label: 'Forming',      value: groups.filter(g => g.status === 'forming').length,                              dotColor: 'bg-[#38BDF8]',  bgColor: 'bg-[#EFF6FF]/60', valueColor: 'text-[#1D4ED8]'  },
    { label: 'Completed',    value: groups.filter(g => g.status === 'completed').length,                            dotColor: 'bg-[#94A3B8]',  bgColor: 'bg-[#F8FAFC]',    valueColor: 'text-[#475569]'  },
    { label: 'Archived',     value: groups.filter(g => g.status === 'archived').length,                            dotColor: 'bg-[#94A3B8]',  bgColor: 'bg-[#F8FAFC]',    valueColor: 'text-[#64748B]'  },
    { label: 'Students',     value: totalStudents,                                                                  dotColor: 'bg-violet-400', bgColor: 'bg-violet-50/60', valueColor: 'text-violet-700' },
  ]
}

// ── Data mappers (for finance integration) ───────────────────────────

export function buildStudentResult(s: GroupDetailStudent, group: GroupOperationalRow): StudentResult {
  return {
    id:                       s.student_id,
    name:                     s.student_name,
    code:                     s.student_code,
    email:                    null,
    phone:                    s.phone,
    age:                      s.age,
    branch_id:                group.branch_id,
    branch_name:              group.branch_name,
    parent_name:              null,
    parent_phone:             s.parent_phone,
    active_enrollments_count: 1,
    active_course_ids:        [],
    active_group_name:        group.name,
    financial_status:         s.payment_status,
    enrolled_sessions:        s.sessions_total,
    remaining_sessions:       s.sessions_remaining,
    active_summaries:         [],
  }
}

export function mapToOpsRow(s: GroupDetailStudent, group: GroupOperationalRow): StudentOperationsRow {
  const sub = s.subscription_amount ?? 0
  return {
    enrollment_id:          s.enrollment_id,
    student_id:             s.student_id,
    account_id:             s.account_id,
    group_id:               group.group_id,
    instructor_id:          group.lead_instructor_id,
    student_name:           s.student_name,
    student_code:           s.student_code,
    student_phone:          s.phone,
    student_status:         'active',
    parent_name:            null,
    parent_phone_1:         s.parent_phone,
    parent_phone_2:         null,
    branch_id:              group.branch_id,
    branch_name:            group.branch_name,
    group_name:             group.name,
    course_name:            group.course_name,
    group_start_date:       group.start_date,
    instructor_name:        group.lead_instructor_name,
    total_sessions:         0,
    sessions_attended:      0,
    attendance_pct:         s.attendance_pct,
    last_attendance_date:   null,
    consecutive_absences:   0,
    enrolled_sessions:      s.sessions_total  ?? 0,
    consumed_sessions:      s.sessions_used   ?? 0,
    remaining_sessions:     s.sessions_remaining ?? 0,
    financial_status:       s.payment_status as StudentOperationsRow['financial_status'],
    total_amount:           sub,
    net_amount:             sub,
    paid_amount:            s.paid_amount,
    remaining_amount:       s.remaining_balance,
    installments_total:     0,
    installments_paid:      0,
    installments_remaining: 0,
    next_due_date:          null,
    payment_progress_pct:   sub > 0 ? Math.min(100, Math.round((s.paid_amount / sub) * 100)) : 0,
    days_overdue:           0,
    risk_level:             s.risk_level,
    risk_flags:             [],
  }
}

// ── Student option filter (for QuickAddStudentModal) ─────────────────

export function filterStudentOptions(
  options: GroupStudentOption[],
  currentIds: string[],
  query: string,
): GroupStudentOption[] {
  const eligible = options.filter(s => !currentIds.includes(s.student_id))
  if (!query.trim()) return eligible
  const q = query.trim().toLowerCase()
  return eligible.filter(s => {
    const hay = [s.student_name, s.student_code, s.phone, s.parent_phone, s.branch_name]
      .filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })
}
