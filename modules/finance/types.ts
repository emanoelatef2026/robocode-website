export type AccountStatus    = 'CURRENT' | 'DUE_SOON' | 'OVERDUE' | 'PAID'
// Enrollment-level financial status (superset of AccountStatus: adds BLOCKED/COMPLETED, drops PAID)
export type EnrollmentFinancialStatus = 'CURRENT' | 'DUE_SOON' | 'OVERDUE' | 'BLOCKED' | 'COMPLETED'
// Sprint 45: session exhaustion status (computed from remaining_sessions)
export type SessionExhaustionStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'EXHAUSTED'
// Sprint 45: payment allocation strategy
export type AllocationStrategy = 'AUTO_FIFO' | 'MANUAL'
export type InstallmentStatus= 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE'
export type PaymentMethod    = 'cash' | 'instapay' | 'vodafone_cash' | 'bank_transfer' | 'card'
export type ActivityType     = 'CALL' | 'WHATSAPP' | 'PORTAL_MESSAGE' | 'FOLLOW_UP' | 'PAYMENT_REMINDER'
export type CollectionPriority = 'HIGH' | 'MEDIUM' | 'LOW'
export type PromiseStatus    = 'ACTIVE' | 'FULFILLED' | 'BROKEN'
export type MilestoneSession = 5 | 10 | 15 | 20

// ── Core entities ──────────────────────────────────────────────────────────────

export interface FinancialAccount {
  id:               string
  student_id:       string
  branch_id:        string
  group_id:         string | null
  total_amount:     number
  discount_amount:  number
  net_amount:       number
  paid_amount:      number
  remaining_amount: number
  status:           AccountStatus
  next_due_date:    string | null
  notes:            string | null
  created_by:       string | null
  created_at:       string
  updated_at:       string
}

export interface FinancePayment {
  id:               string
  student_id:       string
  account_id:       string
  enrollment_id:    string | null    // Sprint 44: direct enrollment link
  installment_id:   string | null
  amount:           number           // positive = credit, negative = reversal
  payment_date:     string
  payment_method:   PaymentMethod
  reference_number: string | null
  notes:            string | null
  allocation_strategy: AllocationStrategy | null  // Sprint 45
  // Sprint 43: receipt proof (Instapay / VF Cash screenshot)
  receipt_url:      string | null
  receipt_image:    string | null
  receipt_notes:    string | null
  created_by:       string | null
  created_at:       string
  // Joined
  created_by_name?: string | null
}

export interface FinanceInstallment {
  id:                  string
  account_id:          string
  installment_number:  number
  amount:              number
  due_date:            string
  paid_amount:         number
  status:              InstallmentStatus
  notes:               string | null
  created_at:          string
  updated_at:          string
}

export interface FinanceNote {
  id:          string
  student_id:  string
  account_id:  string | null
  note_text:   string
  is_internal: boolean
  created_by:  string | null
  created_at:  string
  // Joined
  created_by_name?: string | null
}

export interface CollectionActivity {
  id:            string
  student_id:    string
  account_id:    string | null
  activity_type: ActivityType
  notes:         string | null
  created_by:    string | null
  created_at:    string
  // Joined
  created_by_name?: string | null
}

// ── Enriched list item (for the admin finance table) ──────────────────────────

export interface FinanceListItem {
  // Account
  account_id:       string
  status:           AccountStatus
  total_amount:     number
  discount_amount:  number
  net_amount:       number
  paid_amount:      number
  remaining_amount: number
  next_due_date:    string | null
  // Student
  student_id:       string
  student_name:     string
  student_email:    string
  student_phone:    string | null
  student_code:     string | null
  // Parent (from emergency_contact JSONB)
  parent_name:      string | null
  parent_phone_1:   string | null
  parent_phone_2:   string | null
  // Location
  branch_id:        string
  branch_name:      string
  group_id:         string | null
  group_name:       string | null
  // Course
  course_title:     string | null
  // Computed
  priority:         CollectionPriority
  days_overdue:     number
}

// ── Finance KPI cards ──────────────────────────────────────────────────────────

export interface FinanceKPIs {
  expected_this_month:   number
  collected_this_month:  number
  outstanding_total:     number
  collection_rate_pct:   number
  overdue_count:         number
  due_this_week:         number
  due_this_month:        number
  total_students:        number
  paid_students:         number
}

// ── Student finance detail (for the modal) ────────────────────────────────────

export interface StudentFinanceDetail {
  account:      FinancialAccount
  installments: FinanceInstallment[]
  payments:     FinancePayment[]
  notes:        FinanceNote[]
  activities:   CollectionActivity[]
  student: {
    id:            string
    name:          string
    email:         string
    phone:         string | null
    student_code:  string | null
    branch_name:   string
    group_name:    string | null
    course_title:  string | null
    parent_name:   string | null
    parent_phone_1: string | null
    parent_phone_2: string | null
  }
}

// ── Filters ───────────────────────────────────────────────────────────────────

export interface FinanceFilters {
  branch_id?:    string
  branch_ids?:   string[]
  group_id?:     string
  course_id?:    string
  instructor_id?: string
  status?:       AccountStatus
  risk?:         'HIGH' | 'MEDIUM' | 'LOW'
  overdue?:      boolean
  search?:       string
  page?:         number
  perPage?:      number
}

// ── Form inputs ───────────────────────────────────────────────────────────────

export interface AddPaymentInput {
  account_id:          string
  student_id:          string
  enrollment_id?:      string          // direct enrollment link (Sprint 44)
  amount:              number
  payment_date:        string
  payment_method:      PaymentMethod
  reference_number?:   string
  notes?:              string
  installment_id?:     string
  allocation_strategy?: AllocationStrategy  // Sprint 45
  receipt_url?:        string
  receipt_image?:      string
  receipt_notes?:      string
}

export interface QuickPaymentInput {
  account_id:    string
  student_id:    string
  enrollment_id?: string           // linked enrollment for direct ledger link
  amount:        number | 'full'   // 'full' → record remaining_amount
  method?:       PaymentMethod     // defaults to 'cash'
}

export interface AddInstallmentInput {
  account_id:         string
  installment_number: number
  amount:             number
  due_date:           string
  notes?:             string
}

export interface CreateAccountInput {
  student_id:      string
  branch_id:       string
  group_id?:       string
  total_amount:    number
  discount_amount: number
  next_due_date?:  string
  notes?:          string
}

export interface AddNoteInput {
  student_id:    string
  account_id?:   string
  enrollment_id?: string
  note_text:     string
  is_internal:   boolean
}

export interface AddActivityInput {
  student_id:     string
  account_id?:    string
  enrollment_id?: string
  activity_type:  ActivityType
  notes?:         string
}

export interface AddPromiseInput {
  student_id:      string
  account_id?:     string
  enrollment_id?:  string
  promised_amount: number
  promised_date:   string
  notes?:          string
}

export interface PaymentPromise {
  id:              string
  student_id:      string
  account_id:      string | null
  promised_amount: number
  promised_date:   string
  notes:           string | null
  status:          PromiseStatus
  created_by:      string | null
  created_at:      string
  updated_at:      string
  created_by_name?: string | null
  student_name?:   string | null
  branch_name?:    string | null
  remaining_amount?: number | null
}

// ── Collection queue row ──────────────────────────────────────────────────────

export interface CollectionQueueItem {
  account_id:      string
  student_id:      string
  student_name:    string
  student_code:    string | null
  parent_name:     string | null
  parent_phone_1:  string | null
  parent_phone_2:  string | null
  branch_name:     string
  group_name:      string | null
  remaining_amount: number
  days_overdue:    number
  next_due_date:   string | null
  status:          AccountStatus
  priority:        CollectionPriority
  last_activity_at: string | null
  last_activity_type: ActivityType | null
  active_promise:  { amount: number; date: string } | null
}

// ── Group finance summary ─────────────────────────────────────────────────────

export interface GroupFinanceSummary {
  group_id:         string
  expected_revenue: number
  collected:        number
  outstanding:      number
  collection_rate:  number
  overdue_count:    number
  student_accounts: {
    student_id:      string
    student_name:    string
    account_id:      string
    net_amount:      number
    paid_amount:     number
    remaining_amount: number
    status:          AccountStatus
    priority:        CollectionPriority
  }[]
}

// ── Dashboard finance summary ─────────────────────────────────────────────────

export interface DashboardFinanceSummary {
  outstanding:        number
  collection_rate:    number
  overdue_count:      number
  due_this_week:      number
  broken_promises:    number
  active_promises:    number
  collected_today:    number
  collected_this_month: number
}

// ── Computed helpers ──────────────────────────────────────────────────────────

export function computePriority(item: Pick<FinancialAccount, 'status' | 'remaining_amount' | 'next_due_date'>): CollectionPriority {
  const days = item.next_due_date
    ? Math.floor((new Date().getTime() - new Date(item.next_due_date).getTime()) / 86400000)
    : 0

  if (item.status === 'OVERDUE') {
    return item.remaining_amount >= 1000 || days >= 14 ? 'HIGH' : 'MEDIUM'
  }
  if (item.status === 'DUE_SOON') return 'MEDIUM'
  if (item.remaining_amount > 0)  return 'LOW'
  return 'LOW'
}

export function computeDaysOverdue(next_due_date: string | null): number {
  if (!next_due_date) return 0
  const diff = new Date().getTime() - new Date(next_due_date).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:          'Cash',
  instapay:      'Instapay',
  vodafone_cash: 'Vodafone Cash',
  bank_transfer: 'Bank Transfer',
  card:          'Card',
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  CALL:             'Call',
  WHATSAPP:         'WhatsApp',
  PORTAL_MESSAGE:   'Portal Message',
  FOLLOW_UP:        'Follow-Up',
  PAYMENT_REMINDER: 'Payment Reminder',
}

export const STATUS_LABELS: Record<AccountStatus | EnrollmentFinancialStatus, string> = {
  CURRENT:   'Current',
  DUE_SOON:  'Due Soon',
  OVERDUE:   'Overdue',
  PAID:      'Paid',
  BLOCKED:   'Blocked',
  COMPLETED: 'Completed',
}

export const STATUS_COLORS: Record<AccountStatus | EnrollmentFinancialStatus, string> = {
  CURRENT:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  DUE_SOON:  'bg-amber-50 text-amber-700 border-amber-200',
  OVERDUE:   'bg-red-50 text-red-600 border-red-200',
  PAID:      'bg-blue-50 text-blue-700 border-blue-200',
  BLOCKED:   'bg-red-100 text-red-800 border-red-400',
  COMPLETED: 'bg-slate-50 text-slate-600 border-slate-200',
}

export const INSTALLMENT_STATUS_COLORS: Record<InstallmentStatus, string> = {
  PENDING:  'bg-slate-50 text-slate-600',
  PARTIAL:  'bg-amber-50 text-amber-700',
  PAID:     'bg-emerald-50 text-emerald-700',
  OVERDUE:  'bg-red-50 text-red-600',
}

export const PRIORITY_COLORS: Record<CollectionPriority, string> = {
  HIGH:   'bg-red-50 text-red-600',
  MEDIUM: 'bg-amber-50 text-amber-700',
  LOW:    'bg-slate-50 text-slate-500',
}

// ── Student Operations Center ─────────────────────────────────────────────────

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export interface StudentOperationsRow {
  // Identifiers
  enrollment_id: string | null   // null only for legacy rows without enrollment record
  student_id:    string
  account_id:    string | null
  group_id:      string | null
  instructor_id: string | null
  // Student
  student_name:   string
  student_code:   string | null
  student_phone:  string | null
  student_status: string
  // Parent
  parent_name:    string | null
  parent_phone_1: string | null
  parent_phone_2: string | null
  // Location
  branch_id:   string
  branch_name: string
  // Group & enrollment dates
  group_name:            string | null
  group_start_date:      string | null   // enrollment start_date (when student joined)
  instructor_name:       string | null
  // Session stats (attendance-based)
  total_sessions:       number
  sessions_attended:    number
  attendance_pct:       number
  last_attendance_date: string | null
  consecutive_absences: number
  // Sprint 44: session contract fields (package-based)
  enrolled_sessions:  number    // sessions bought in contract
  consumed_sessions:  number    // sessions consumed (attended or absent)
  remaining_sessions: number    // enrolled - consumed
  // Finance
  financial_status:       EnrollmentFinancialStatus | AccountStatus | null
  total_amount:           number
  net_amount:             number
  paid_amount:            number
  remaining_amount:       number
  installments_total:     number
  installments_paid:      number
  installments_remaining: number
  next_due_date:          string | null
  payment_progress_pct:   number
  days_overdue:           number
  // Risk
  risk_level: RiskLevel
  risk_flags: string[]
}

// ── Payment reversal (Sprint 44) ──────────────────────────────────────────────

export interface FinancePaymentReversal {
  id:                  string
  original_payment_id: string
  enrollment_id:       string | null
  account_id:          string | null
  student_id:          string
  amount:              number
  reversal_type:       'REVERSAL' | 'REFUND' | 'CORRECTION'
  reason:              string | null
  created_by:          string | null
  created_at:          string
}

export interface CreateReversalInput {
  original_payment_id: string
  amount:              number
  reversal_type?:      'REVERSAL' | 'REFUND' | 'CORRECTION'
  reason?:             string
}

export interface StudentOpsFilters {
  search?:          string
  group_id?:        string
  instructor_id?:   string
  risk_level?:      RiskLevel
  financial_status?: AccountStatus
  overdue_only?:    boolean
  branch_id?:       string
}

export interface StudentOpsDetail {
  payments:  FinancePayment[]
  reversals: FinancePaymentReversal[]   // Sprint 45: reversal audit records
  installments: FinanceInstallment[]
  attendance_sessions: {
    schedule_id:      string
    scheduled_at:     string
    topic:            string | null
    session_status:   string
    attendance_status: string | null
    late_minutes:     number | null
    notes:            string | null
  }[]
  activities: CollectionActivity[]
  notes:      FinanceNote[]
  promises:   PaymentPromise[]
  // Sprint 45: ledger balance (computed server-side for accuracy)
  net_amount:       number
  paid_amount:      number
  remaining_amount: number
}

export function computeStudentRisk(row: {
  attendance_pct:       number
  financial_status:     AccountStatus | EnrollmentFinancialStatus | null
  days_overdue:         number
  consecutive_absences: number
  sessions_attended:    number
  remaining_amount:     number
}): { level: RiskLevel; flags: string[] } {
  const flags: string[] = []

  if (row.sessions_attended > 0) {
    if (row.attendance_pct < 60)       flags.push('attendance_critical')
    else if (row.attendance_pct < 80)  flags.push('attendance_low')
  }

  if (row.financial_status === 'BLOCKED') {
    flags.push('payment_blocked')
  } else if (row.financial_status === 'OVERDUE' && row.days_overdue > 0) {
    flags.push('payment_overdue')
  } else if (row.financial_status === 'DUE_SOON') {
    flags.push('payment_due_soon')
  }

  if (row.consecutive_absences >= 3)                            flags.push('consecutive_absences')
  if (row.sessions_attended >= 5  && row.sessions_attended < 10 && row.remaining_amount > 0) flags.push('milestone_5')
  if (row.sessions_attended >= 10 && row.sessions_attended < 15 && row.remaining_amount > 0) flags.push('milestone_10')
  if (row.sessions_attended >= 15 && row.sessions_attended < 20 && row.remaining_amount > 0) flags.push('milestone_15')
  if (row.sessions_attended >= 20 && row.remaining_amount > 0)  flags.push('milestone_20')

  // Legacy alias for backward compat
  const hasSessionMilestone = flags.some(f => f.startsWith('milestone_'))
  if (hasSessionMilestone) flags.push('session_milestone')

  const highSet = new Set(['attendance_critical', 'payment_overdue', 'payment_blocked', 'consecutive_absences', 'session_milestone'])
  const medSet  = new Set(['attendance_low', 'payment_due_soon'])

  if (flags.some(f => highSet.has(f))) return { level: 'HIGH',   flags }
  if (flags.some(f => medSet.has(f)))  return { level: 'MEDIUM', flags }
  return { level: 'LOW', flags }
}

export const RISK_LEVEL_CLASSES: Record<RiskLevel, string> = {
  HIGH:   'bg-red-50 text-red-600 border border-red-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border border-amber-200',
  LOW:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
}

export const RISK_ROW_BG: Record<RiskLevel, string> = {
  HIGH:   'bg-red-50/40',
  MEDIUM: 'bg-amber-50/20',
  LOW:    '',
}

export const RISK_FLAG_LABELS: Record<string, string> = {
  attendance_critical:  'Attendance < 60%',
  attendance_low:       'Attendance < 80%',
  payment_overdue:      'Payment Overdue',
  payment_blocked:      'Blocked — 30d+ Overdue',
  payment_due_soon:     'Payment Due Soon',
  consecutive_absences: '3+ Consecutive Absences',
  session_milestone:    'Session Milestone Unpaid',
  milestone_5:          'Session 5 Unpaid',
  milestone_10:         'Session 10 Unpaid',
  milestone_15:         'Session 15 Unpaid',
  milestone_20:         'Session 20 Unpaid',
}

// ── Session exhaustion helpers (Sprint 45) ────────────────────────────────────

export function computeSessionExhaustion(enrolled: number, remaining: number): SessionExhaustionStatus {
  if (enrolled === 0) return 'HEALTHY'
  if (remaining <= 0) return 'EXHAUSTED'
  if (remaining <= 2) return 'CRITICAL'
  if (remaining <= 5) return 'WARNING'
  return 'HEALTHY'
}

export const SESSION_EXHAUSTION_LABELS: Record<SessionExhaustionStatus, string> = {
  HEALTHY:   'Active',
  WARNING:   'Low Sessions',
  CRITICAL:  'Critical',
  EXHAUSTED: 'Package Exhausted',
}

export const SESSION_EXHAUSTION_COLORS: Record<SessionExhaustionStatus, string> = {
  HEALTHY:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  WARNING:   'bg-amber-50 text-amber-700 border-amber-200',
  CRITICAL:  'bg-red-50 text-red-600 border-red-200',
  EXHAUSTED: 'bg-red-100 text-red-800 border-red-400',
}
