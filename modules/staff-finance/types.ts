// ─── Staff / Instructor Live Finance types ────────────────────────────────────
// Separate from modules/finance/ (which is student finance).
// This module handles instructor session earnings and staff salaries — live, no runs.

export type FinanceAdjType =
  | 'bonus' | 'penalty' | 'advance' | 'purchase' | 'reimbursement' | 'other'

export type InstructorPaymentMethod =
  | 'instapay' | 'vodafone_cash' | 'bank_transfer' | 'cash'

export type EmploymentStatus = 'active' | 'on_leave' | 'inactive'

// StaffSessionActivityType is stored as TEXT in staff_sessions — no DB constraint,
// so new values can be added freely without migration.
export type StaffSessionActivityType =
  | 'session' | 'camp_day' | 'competition_day' | 'workshop' | 'training'
  | 'open_day' | 'meeting' | 'admin_task' | 'other'

// ── Adjustment sign: positive = adds to net, negative = subtracts ─────────────

export const ADJ_SIGN: Record<FinanceAdjType, 1 | -1> = {
  bonus:         1,
  reimbursement: 1,
  penalty:       -1,
  advance:       -1,
  purchase:      -1,
  other:         1,
}

export const ADJ_LABELS: Record<FinanceAdjType, string> = {
  bonus:         'Bonus',
  penalty:       'Penalty',
  advance:       'Advance',
  purchase:      'Purchase',
  reimbursement: 'Reimbursement',
  other:         'Other',
}

export const ADJ_COLOR: Record<FinanceAdjType, string> = {
  bonus:         'text-[#15803D] bg-[#E7F8EE]',
  reimbursement: 'text-[#1D4ED8] bg-[#EFF6FF]',
  penalty:       'text-[#DC2626] bg-[#FEE2E2]',
  advance:       'text-[#B45309] bg-[#FFFBEB]',
  purchase:      'text-orange-700 bg-orange-50',
  other:         'text-[#334155] bg-[#F8FAFC]',
}

export const INSTRUCTOR_PAYMENT_METHOD_LABELS: Record<InstructorPaymentMethod, string> = {
  instapay:      'Instapay',
  vodafone_cash: 'Vodafone Cash',
  bank_transfer: 'Bank Transfer',
  cash:          'Cash',
}

export const STAFF_PAYMENT_METHOD_LABELS: Record<string, string> = {
  instapay:      'Instapay',
  vodafone_cash: 'Vodafone Cash',
  wallet:        'Wallet',
  bank_transfer: 'Bank Transfer',
  cash:          'Cash',
  cheque:        'Cheque',
  other:         'Other',
}

export const STAFF_ROLE_LABELS: Record<string, string> = {
  instructor:     'Instructor',
  team_leader:    'Team Leader',
  coordinator:    'Coordinator',
  branch_manager: 'Branch Manager',
  admin:          'Admin',
  sales:          'Sales',
  marketing:      'Marketing',
  operations:     'Operations',
  finance:        'Finance',
  other:          'Other',
}

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  active:   'Active',
  on_leave: 'On Leave',
  inactive: 'Inactive',
}

export const EMPLOYMENT_STATUS_COLORS: Record<EmploymentStatus, string> = {
  active:   'bg-[#E7F8EE] text-[#15803D]',
  on_leave: 'bg-[#FFFBEB] text-[#B45309]',
  inactive: 'bg-[#F1F5F9] text-[#64748B]',
}

// Record<string, string> (not strict type) so unknown legacy values display gracefully
export const STAFF_SESSION_ACTIVITY_LABELS: Record<string, string> = {
  // New simplified types
  session:         'Session',
  camp_day:        'Camp Day',
  competition_day: 'Competition Day',
  workshop:        'Workshop',
  training:        'Training',
  open_day:        'Open Day',
  meeting:         'Meeting',
  admin_task:      'Administrative Task',
  other:           'Other',
  // Legacy aliases kept for display of old records
  teaching_session:  'Session',
  camp:              'Camp Day',
  event:             'Open Day',
  outsource_session: 'Session',
  bonus_activity:    'Other',
  extra_session:     'Session',
  admin_event:       'Administrative Task',
  technical_support: 'Other',
  custom:            'Other',
}

// Ordered list for dropdowns
export const STAFF_ACTIVITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'session',         label: 'Session'             },
  { value: 'camp_day',        label: 'Camp Day'            },
  { value: 'competition_day', label: 'Competition Day'     },
  { value: 'workshop',        label: 'Workshop'            },
  { value: 'training',        label: 'Training'            },
  { value: 'open_day',        label: 'Open Day'            },
  { value: 'meeting',         label: 'Meeting'             },
  { value: 'admin_task',      label: 'Administrative Task' },
  { value: 'other',           label: 'Other'               },
]

// ── Finance adjustment record ──────────────────────────────────────────────────

export interface FinanceAdjustment {
  id:               string
  branch_id:        string
  instructor_id:    string | null
  staff_profile_id: string | null
  type:             FinanceAdjType
  amount:           number   // always positive; sign from ADJ_SIGN
  adjustment_date:  string   // YYYY-MM-DD
  notes:            string | null
  created_by:       string | null
  created_at:       string
  updated_at:       string
}

// ── Staff activity / session (stored in staff_sessions table) ─────────────────

export interface StaffSession {
  id:               string
  staff_profile_id: string
  branch_id:        string
  session_date:     string   // YYYY-MM-DD
  activity_type:    string
  description:      string | null
  rate:             number
  quantity:         number
  amount:           number   // rate × quantity, computed in application
  notes:            string | null
  created_by:       string | null
  created_at:       string
  updated_at:       string
}

// ── Staff payment record (actual payment made to staff for a month) ────────────

export interface StaffPaymentRecord {
  id:               string
  staff_profile_id: string
  branch_id:        string
  month:            number
  year:             number
  amount:           number
  payment_date:     string   // YYYY-MM-DD
  payment_method:   string | null
  notes:            string | null
  created_by:       string | null
  created_at:       string
}

// ── Payment status derived from paid vs net ───────────────────────────────────

export type PaymentStatus = 'paid' | 'partial' | 'unpaid'

export function derivePaymentStatus(total_paid: number, net_amount: number): PaymentStatus {
  if (total_paid <= 0) return 'unpaid'
  if (total_paid >= net_amount) return 'paid'
  return 'partial'
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid:    'Paid',
  partial: 'Partial',
  unpaid:  'Unpaid',
}

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  paid:    'bg-[#E7F8EE] text-[#15803D]',
  partial: 'bg-[#FFFBEB] text-[#B45309]',
  unpaid:  'bg-[#FEE2E2] text-[#EF4444]',
}

// ── Live instructor finance row ───────────────────────────────────────────────

export interface InstructorFinanceRow {
  instructor_id:      string
  user_id:            string
  display_name:       string
  branch_id:          string
  branch_name:        string
  salary_per_session: number
  payment_method:      InstructorPaymentMethod | null
  wallet_number:       string | null
  instapay_number:     string | null
  payment_link:        string | null
  bank_account_number: string | null
  payment_notes:       string | null
  currency:            string
  // Live session counts (from schedules)
  sessions_count:     number
  group_count:        number
  // Computed
  session_earnings:   number   // sessions_count × salary_per_session
  // Adjustments in the date range
  adjustments:        FinanceAdjustment[]
  bonus_total:        number
  penalty_total:      number
  advance_total:      number
  purchase_total:     number
  other_total:        number
  adj_net:            number   // signed sum of all adjustments
  net_amount:         number   // session_earnings + adj_net
}

// ── Live staff finance row ────────────────────────────────────────────────────

export interface StaffFinanceRow {
  profile_id:          string
  user_id:             string
  display_name:        string
  branch_id:           string
  branch_name:         string
  role:                string
  department:          string | null
  employment_status:   EmploymentStatus
  works_all_branches:  boolean
  payroll_type:        'per_session' | 'fixed_salary' | 'mixed'
  basic_salary:        number
  session_rate:        number        // default rate for activities (pre-filled in Add Activity form)
  // From staff_sessions in the date range
  sessions_count:      number        // number of activity entries
  session_earnings:    number        // sum of rate × quantity for all activities
  payment_method:      string
  payment_reference:   string | null
  notes:               string | null
  // Adjustments in the date range
  adjustments:         FinanceAdjustment[]
  bonus_total:         number
  penalty_total:       number
  advance_total:       number
  purchase_total:      number
  other_total:         number
  adj_net:             number
  // Net = basic_salary + session_earnings + adj_net (all components always included)
  net_amount:          number
  // Payment tracking for the selected month
  payment_records:     StaffPaymentRecord[]
  total_paid:          number
  remaining:           number
  payment_status:      PaymentStatus
}

// ── Finance summary ───────────────────────────────────────────────────────────

export interface StaffFinanceSummary {
  date_from:                    string
  date_to:                      string
  instructor_count:             number
  staff_count:                  number
  total_session_earnings:       number   // instructor sessions only
  total_staff_salaries:         number   // all staff basic salaries
  total_staff_session_earnings: number   // all staff activity earnings
  total_bonus:                  number
  total_penalty:                number
  total_advance:                number
  total_purchase:               number
  total_net:                    number
  currency:                     string
}

// ── Session override reason codes ─────────────────────────────────────────────

export type OverrideReason =
  | 'online_session' | 'old_contract' | 'replacement' | 'trial'
  | 'special_agreement' | 'premium_workshop' | 'custom'

export const OVERRIDE_REASON_LABELS: Record<OverrideReason, string> = {
  online_session:    'Online Session',
  old_contract:      'Old Contract',
  replacement:       'Replacement Session',
  trial:             'Trial Session',
  special_agreement: 'Special Agreement',
  premium_workshop:  'Premium Workshop',
  custom:            'Custom',
}

// ── Instructor session detail (drill-down popup) ──────────────────────────────

export interface InstructorSessionDetail {
  schedule_id:      string
  scheduled_at:     string        // ISO datetime
  group_id:         string
  group_name:       string
  course_name:      string
  topic:            string | null
  students_total:   number        // all attendance records for this session
  students_present: number        // present + late + makeup
  attendance_pct:   number        // 0–100
  status:           string
  // Rate hierarchy (override > group > instructor default)
  base_rate:        number        // instructors.salary_per_session
  group_rate:       number | null // group_instructors.session_rate (null = not set)
  override_rate:    number | null // payroll_session_overrides.override_rate (null = not set)
  override_reason:  string | null
  override_id:      string | null // payroll_session_overrides.id for deletion
  final_rate:       number        // override_rate ?? group_rate ?? base_rate
  session_amount:   number        // = final_rate
}

// ── User picker option for staff creation ─────────────────────────────────────

export interface UserPickerOption {
  user_id:      string
  display_name: string
  email:        string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmtEGP(amount: number): string {
  return new Intl.NumberFormat('en-EG', {
    style:    'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function fmtNum(n: number): string {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(n)
}

export function computeAdjTotals(adjustments: FinanceAdjustment[]) {
  let bonus_total    = 0
  let penalty_total  = 0
  let advance_total  = 0
  let purchase_total = 0
  let other_total    = 0
  let adj_net        = 0

  for (const a of adjustments) {
    const signed = a.amount * ADJ_SIGN[a.type]
    adj_net += signed
    switch (a.type) {
      case 'bonus':
      case 'reimbursement': bonus_total    += a.amount; break
      case 'penalty':       penalty_total  += a.amount; break
      case 'advance':       advance_total  += a.amount; break
      case 'purchase':      purchase_total += a.amount; break
      default:              other_total    += a.amount; break
    }
  }

  return { bonus_total, penalty_total, advance_total, purchase_total, other_total, adj_net }
}

// All staff net payroll = basic_salary + activity_earnings + adj_net.
// payroll_type is kept as a classification label only — it no longer restricts
// which components count in the calculation.
export function computeStaffNetAmount(
  _payroll_type:    'per_session' | 'fixed_salary' | 'mixed',
  basic_salary:     number,
  session_earnings: number,
  adj_net:          number,
): number {
  return basic_salary + session_earnings + adj_net
}
