// ─── Payroll domain types ────────────────────────────────────────────────────

export type PayrollRunStatus  = 'draft' | 'approved' | 'paid' | 'archived'
export type PayrollItemStatus = 'draft' | 'approved' | 'paid'
export type AdjustmentType    = 'bonus' | 'penalty' | 'transport' | 'allowance' | 'deduction' | 'other'
export type PayrollType       = 'per_session' | 'fixed_monthly' | 'hybrid'

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
  instructor_id:     string
  sessions_count:    number
  rate_per_session:  number
  gross_amount:      number
  adjustments_total: number
  final_amount:      number
  currency:          string
  status:            PayrollItemStatus
  approved_at:       string | null
  paid_at:           string | null
  notes:             string | null
  created_at:        string
  updated_at:        string
}

// ── Payroll adjustment ────────────────────────────────────────────────────────

export interface PayrollAdjustment {
  id:              string
  payroll_item_id: string
  instructor_id:   string
  type:            AdjustmentType
  amount:          number
  notes:           string | null
  created_by:      string | null
  created_at:      string
  updated_at:      string
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

// ── Rich / joined types used in the UI ───────────────────────────────────────

export interface PayrollItemRow extends PayrollItem {
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
  total_amount:    number
  draft_amount:    number
  approved_amount: number
  paid_amount:     number
  instructor_count: number
  session_count:   number
  currency:        string
}

// ── Warnings ──────────────────────────────────────────────────────────────────

export interface PayrollWarning {
  type:          'missing_rate' | 'zero_rate' | 'no_sessions'
  instructor_id: string
  instructor_name: string
  message:       string
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
