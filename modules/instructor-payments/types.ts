// ─── Instructor "My Payments" types ────────────────────────────────────────────
// Reuses instructors table payment-method columns and staff_payment_records
// (via a resolved staff_payroll_profiles row) for the paid-amount ledger.
// Only the payout-request workflow is net-new (instructor_payout_requests).

export type SessionEarningType = 'primary' | 'trial' | 'makeup'

export type InstructorPreferredMethod = 'vodafone_cash' | 'instapay' | 'bank_transfer' | 'cash'

export const PREFERRED_METHOD_LABELS: Record<InstructorPreferredMethod, string> = {
  vodafone_cash: 'Vodafone Cash',
  instapay:      'Instapay',
  bank_transfer: 'Bank Transfer',
  cash:          'Cash',
}

export const PREFERRED_METHOD_OPTIONS: { value: InstructorPreferredMethod; label: string }[] = [
  { value: 'vodafone_cash', label: 'Vodafone Cash' },
  { value: 'instapay',      label: 'Instapay' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash',          label: 'Cash' },
]

// ── Session-level earning row (Session Breakdown table) ───────────────────────

export interface InstructorSessionEarning {
  schedule_id:   string
  scheduled_at:  string
  session_type:  SessionEarningType
  group_id:      string | null
  group_name:    string
  topic:         string | null
  amount:        number
  status:        string   // schedule status: completed | scheduled | ongoing | cancelled | postponed | ...
}

export interface SessionEarningFilters {
  month?:       number   // 1-12
  year?:        number
  from?:        string   // YYYY-MM-DD
  to?:          string   // YYYY-MM-DD
  status?:      string
  sessionType?: SessionEarningType
}

// ── Overview cards ─────────────────────────────────────────────────────────────

export interface InstructorPaymentOverview {
  estimated_this_month:  number
  approved_this_month:   number
  paid_this_month:       number
  outstanding:           number
  lifetime_earnings:     number
  currency:              string
  can_request_payout:    boolean
}

// ── Payment history (monthly summaries) ────────────────────────────────────────

export interface InstructorMonthlyPaymentSummary {
  month:        number
  year:         number
  earned:       number
  paid:         number
  outstanding:  number
  payments:     InstructorPaymentRecordRow[]
}

export interface InstructorPaymentRecordRow {
  id:             string
  amount:         number
  payment_date:   string
  payment_method: string | null
  notes:          string | null
}

// ── Payment methods (instructors table columns) ────────────────────────────────

export interface InstructorPaymentMethods {
  instructor_id:       string
  payment_method:      InstructorPreferredMethod | null
  wallet_number:        string | null   // Vodafone Cash number
  instapay_number:      string | null
  payment_link:         string | null   // Instapay payment link
  bank_account_number:  string | null
}

export function isPaymentInfoComplete(m: InstructorPaymentMethods): boolean {
  if (!m.payment_method) return false
  switch (m.payment_method) {
    case 'vodafone_cash': return !!m.wallet_number
    case 'instapay':      return !!m.instapay_number || !!m.payment_link
    case 'bank_transfer': return !!m.bank_account_number
    case 'cash':          return true
    default:               return false
  }
}

// ── Payout requests ─────────────────────────────────────────────────────────────

export type PayoutRequestStatus = 'pending' | 'approved' | 'rejected' | 'paid'

export const PAYOUT_STATUS_LABELS: Record<PayoutRequestStatus, string> = {
  pending:  'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  paid:     'Paid',
}

export const PAYOUT_STATUS_COLORS: Record<PayoutRequestStatus, string> = {
  pending:  'bg-[#FFFBEB] text-[#B45309]',
  approved: 'bg-[#EFF6FF] text-[#1D4ED8]',
  rejected: 'bg-[#FEE2E2] text-[#EF4444]',
  paid:     'bg-[#E7F8EE] text-[#15803D]',
}

export interface InstructorPayoutRequest {
  id:                string
  instructor_id:     string
  branch_id:          string
  requested_amount:  number
  status:            PayoutRequestStatus
  requested_at:      string
  decided_by:        string | null
  decided_at:        string | null
  decision_notes:    string | null
  payment_record_id: string | null
  created_at:        string
}

// TL/Admin-facing row with resolved instructor display info.
export interface PayoutRequestListItem extends InstructorPayoutRequest {
  instructor_name:  string
  branch_name:      string
}

// ── Validation ────────────────────────────────────────────────────────────────

export function isValidVodafoneCash(number: string): boolean {
  return /^\d{11}$/.test(number.trim())
}

export function isValidInstapayLink(link: string): boolean {
  try {
    const u = new URL(link.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmtEGP(amount: number): string {
  return new Intl.NumberFormat('en-EG', {
    style:    'currency',
    currency: 'EGP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
