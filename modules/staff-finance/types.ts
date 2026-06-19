// ─── Staff / Instructor Live Finance types ────────────────────────────────────
// Separate from modules/finance/ (which is student finance).
// This module handles instructor session earnings and staff salaries — live, no runs.

export type FinanceAdjType =
  | 'bonus' | 'penalty' | 'advance' | 'purchase' | 'reimbursement' | 'other'

export type InstructorPaymentMethod =
  | 'instapay' | 'vodafone_cash' | 'bank_transfer' | 'cash'

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
  bonus:         'text-emerald-700 bg-emerald-50',
  reimbursement: 'text-blue-700 bg-blue-50',
  penalty:       'text-red-700 bg-red-50',
  advance:       'text-amber-700 bg-amber-50',
  purchase:      'text-orange-700 bg-orange-50',
  other:         'text-slate-700 bg-slate-50',
}

export const INSTRUCTOR_PAYMENT_METHOD_LABELS: Record<InstructorPaymentMethod, string> = {
  instapay:      'Instapay',
  vodafone_cash: 'Vodafone Cash',
  bank_transfer: 'Bank Transfer',
  cash:          'Cash',
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

// ── Live instructor finance row ───────────────────────────────────────────────

export interface InstructorFinanceRow {
  instructor_id:      string
  user_id:            string
  display_name:       string
  branch_id:          string
  branch_name:        string
  salary_per_session: number
  payment_method:     InstructorPaymentMethod | null
  instapay_number:    string | null
  payment_notes:      string | null
  currency:           string
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
  profile_id:         string
  user_id:            string
  display_name:       string
  branch_id:          string
  branch_name:        string
  role:               string
  payroll_type:       'per_session' | 'fixed_salary' | 'mixed'
  basic_salary:       number
  session_rate:       number
  payment_method:     string
  payment_reference:  string | null
  is_payroll_enabled: boolean
  notes:              string | null
  // Adjustments in the date range
  adjustments:        FinanceAdjustment[]
  bonus_total:        number
  penalty_total:      number
  advance_total:      number
  purchase_total:     number
  other_total:        number
  adj_net:            number
  net_amount:         number   // basic_salary + adj_net
}

// ── Finance summary ───────────────────────────────────────────────────────────

export interface StaffFinanceSummary {
  date_from:              string
  date_to:                string
  instructor_count:       number
  staff_count:            number
  total_session_earnings: number
  total_staff_salaries:   number
  total_bonus:            number
  total_penalty:          number
  total_advance:          number
  total_purchase:         number
  total_net:              number
  currency:               string
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
