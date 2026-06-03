export type AccountStatus    = 'CURRENT' | 'DUE_SOON' | 'OVERDUE' | 'PAID'
export type InstallmentStatus= 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE'
export type PaymentMethod    = 'cash' | 'instapay' | 'vodafone_cash' | 'bank_transfer' | 'card'
export type ActivityType     = 'CALL' | 'WHATSAPP' | 'PORTAL_MESSAGE' | 'FOLLOW_UP' | 'PAYMENT_REMINDER'
export type CollectionPriority = 'HIGH' | 'MEDIUM' | 'LOW'
export type PromiseStatus    = 'ACTIVE' | 'FULFILLED' | 'BROKEN'

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
  installment_id:   string | null
  amount:           number
  payment_date:     string
  payment_method:   PaymentMethod
  reference_number: string | null
  notes:            string | null
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
  branch_id?: string
  group_id?:  string
  status?:    AccountStatus
  search?:    string
  page?:      number
  perPage?:   number
}

// ── Form inputs ───────────────────────────────────────────────────────────────

export interface AddPaymentInput {
  account_id:       string
  student_id:       string
  amount:           number
  payment_date:     string
  payment_method:   PaymentMethod
  reference_number?: string
  notes?:           string
  installment_id?:  string
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
  student_id:  string
  account_id?: string
  note_text:   string
  is_internal: boolean
}

export interface AddActivityInput {
  student_id:    string
  account_id?:   string
  activity_type: ActivityType
  notes?:        string
}

export interface AddPromiseInput {
  student_id:      string
  account_id?:     string
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

export const STATUS_LABELS: Record<AccountStatus, string> = {
  CURRENT:  'Current',
  DUE_SOON: 'Due Soon',
  OVERDUE:  'Overdue',
  PAID:     'Paid',
}

export const STATUS_COLORS: Record<AccountStatus, string> = {
  CURRENT:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  DUE_SOON: 'bg-amber-50 text-amber-700 border-amber-200',
  OVERDUE:  'bg-red-50 text-red-600 border-red-200',
  PAID:     'bg-blue-50 text-blue-700 border-blue-200',
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
