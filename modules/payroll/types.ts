// ─── Payroll domain types ────────────────────────────────────────────────────

export type PayrollRunStatus  = 'draft' | 'approved' | 'paid' | 'archived' | 'finalized'
export type PayrollItemStatus = 'draft' | 'approved' | 'paid'
export type AdjustmentType    =
  | 'bonus' | 'penalty' | 'transport' | 'allowance' | 'deduction' | 'other'
  | 'advance' | 'purchase' | 'equipment' | 'reimbursement'
export type PayrollType       = 'per_session' | 'fixed_salary' | 'mixed'
export type PaymentMethod     = 'instapay' | 'vodafone_cash' | 'bank_transfer' | 'cash'

export type StaffRole =
  | 'instructor' | 'team_leader' | 'coordinator' | 'branch_manager'
  | 'admin' | 'sales' | 'marketing' | 'operations' | 'finance' | 'other'

// ── Payroll run ───────────────────────────────────────────────────────────────

export interface PayrollRun {
  id:           string
  branch_id:    string
  month:        number
  year:         number
  status:       PayrollRunStatus
  total_amount: number
  notes:        string | null
  generated_at: string
  generated_by: string | null
  approved_at:  string | null
  approved_by:  string | null
  paid_at:      string | null
  paid_by:      string | null
  created_at:   string
  updated_at:   string
}

// ── Payroll item ──────────────────────────────────────────────────────────────

export interface PayrollItem {
  id:                string
  payroll_run_id:    string
  instructor_id:     string | null     // null for non-instructor staff items
  staff_profile_id:  string | null     // null for legacy instructor items
  sessions_count:    number
  rate_per_session:  number
  basic_salary:      number            // 0 for per_session items
  gross_amount:      number
  adjustments_total: number
  final_amount:      number
  currency:          string
  payroll_type:      PayrollType       // snapshot of how gross was computed
  status:            PayrollItemStatus
  approved_at:       string | null
  paid_at:           string | null
  notes:             string | null
  created_at:        string
  updated_at:        string
}

// ── Payroll adjustment ────────────────────────────────────────────────────────

export interface PayrollAdjustment {
  id:               string
  payroll_item_id:  string
  instructor_id:    string | null
  staff_profile_id: string | null
  type:             AdjustmentType
  amount:           number
  notes:            string | null
  created_by:       string | null
  created_at:       string
  updated_at:       string
}

// ── Payroll session snapshot ──────────────────────────────────────────────────

export interface PayrollSessionSnapshot {
  id:              string
  payroll_item_id: string
  schedule_id:     string
  session_number:  number
  group_id:        string
  group_name:      string
  topic:           string | null
  session_date:    string
  session_value:   number
  created_at:      string
}

// ── Staff payroll profile ─────────────────────────────────────────────────────

export interface StaffPayrollProfile {
  id:                 string
  user_id:            string
  branch_id:          string
  role:               StaffRole
  payroll_type:       PayrollType
  basic_salary:       number
  session_rate:       number
  payment_method:     PaymentMethod
  payment_reference:  string | null
  is_payroll_enabled: boolean
  notes:              string | null
  created_by:         string | null
  created_at:         string
  updated_at:         string
}

// ── Rich / joined types used in the UI ───────────────────────────────────────

export interface StaffPayrollProfileRow extends StaffPayrollProfile {
  display_name: string
  avatar_url:   string | null
  phone:        string | null
  branch_name:  string
}

export interface PayrollItemRow extends PayrollItem {
  staff_name:    string    // resolved from instructor OR staff_profile
  staff_role:    string    // 'instructor' for legacy items
  staff_avatar:  string | null
  // legacy compat
  instructor_name:   string
  instructor_avatar: string | null
}

export interface PayrollDetailItem extends PayrollItemRow {
  adjustments: PayrollAdjustment[]
  snapshots:   PayrollSessionSnapshot[]
}

export interface PayrollRunWithItems extends PayrollRun {
  items:        PayrollItemRow[]
  branch_name?: string
}

// ── KPI summary ───────────────────────────────────────────────────────────────

export interface PayrollKPIs {
  total_amount:      number
  draft_amount:      number
  approved_amount:   number
  paid_amount:       number
  instructor_count:  number
  employee_count:    number
  session_count:     number
  bonus_total:       number
  advance_total:     number
  currency:          string
}

// ── Warnings ──────────────────────────────────────────────────────────────────

export interface PayrollWarning {
  type:            'missing_rate' | 'zero_rate' | 'no_sessions' | 'missing_salary'
  staff_id?:       string
  staff_name?:     string
  message:         string
  // legacy compat
  instructor_id?:   string
  instructor_name?: string
}

// ── Generation result ─────────────────────────────────────────────────────────

export interface GeneratePayrollResult {
  run_id:       string
  item_count:   number
  total_amount: number
  currency:     string
  warnings:     PayrollWarning[]
}

// ── Month / year selector helpers ─────────────────────────────────────────────

export const MONTH_NAMES = [
  'January', 'February', 'March',  'April',
  'May',     'June',     'July',   'August',
  'September','October', 'November','December',
]

export function formatPayrollPeriod(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

export function fmtCurrency(amount: number, currency = 'EGP'): string {
  return new Intl.NumberFormat('en-EG', {
    style:    'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function fmtAmount(amount: number): string {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 }).format(amount)
}

// ── Label maps ────────────────────────────────────────────────────────────────

export const ADJUSTMENT_TYPE_LABELS: Record<AdjustmentType, string> = {
  bonus:         'Bonus',
  penalty:       'Penalty',
  transport:     'Transport',
  allowance:     'Allowance',
  deduction:     'Deduction',
  advance:       'Advance',
  purchase:      'Purchase',
  equipment:     'Equipment',
  reimbursement: 'Reimbursement',
  other:         'Other',
}

export const ADJUSTMENT_SIGN: Record<AdjustmentType, 1 | -1> = {
  bonus:         1,
  transport:     1,
  allowance:     1,
  reimbursement: 1,
  equipment:     1,
  penalty:       -1,
  deduction:     -1,
  advance:       -1,
  purchase:      -1,
  other:         1,  // user sets sign manually
}

export const PAYROLL_TYPE_LABELS: Record<PayrollType, string> = {
  per_session:  'Session-Based',
  fixed_salary: 'Fixed Salary',
  mixed:        'Mixed',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  instapay:      'Instapay',
  vodafone_cash: 'Vodafone Cash',
  bank_transfer: 'Bank Transfer',
  cash:          'Cash',
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
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
