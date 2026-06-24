// Enrollment-centric architecture — the enrollment is the central operational unit.
// A student may have multiple enrollments (one per group/course they are in).

export type EnrollmentStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'TRANSFERRED'
  | 'COMPLETED'
  | 'DROPPED'
  | 'CANCELLED'

// Sprint 44: enrollment-level financial status (separate from SFA account status)
export type EnrollmentFinancialStatus =
  | 'CURRENT'
  | 'DUE_SOON'
  | 'OVERDUE'
  | 'BLOCKED'
  | 'COMPLETED'

// ── Core entity ───────────────────────────────────────────────────────────────

export interface StudentEnrollment {
  id:               string
  student_id:       string
  branch_id:        string
  group_id:         string | null
  group_course_id:  string | null
  instructor_id:    string | null
  group_student_id: string | null
  start_date:       string         // 'YYYY-MM-DD'
  end_date:         string | null
  status:           EnrollmentStatus
  enrollment_type:  'primary' | 'secondary'
  pricing_plan:     string | null
  total_amount:     number
  discount_amount:  number
  net_amount:       number
  expected_sessions:     number
  attendance_count:      number
  completion_percentage: number
  // Sprint 44: session contract fields
  enrolled_sessions:  number       // total sessions bought in this package
  consumed_sessions:  number       // sessions attended or marked absent (slot used)
  remaining_sessions: number       // enrolled_sessions - consumed_sessions (generated)
  financial_status:   EnrollmentFinancialStatus | null
  // Sprint 45: overdraft protection
  allow_overdraft_sessions: boolean
  transferred_from: string | null
  transferred_to:   string | null
  notes:            string | null
  created_by:       string | null
  created_at:       string
  updated_at:       string
  // Snapshot fields (populated after sprint42 migration)
  group_name_snapshot:      string | null
  course_name_snapshot:     string | null
  instructor_name_snapshot: string | null
  branch_name_snapshot:     string | null
  pricing_snapshot:         Record<string, number> | null
}

// ── Enriched list item for the operations center ──────────────────────────────

export interface EnrollmentListItem extends StudentEnrollment {
  // Student
  student_name:   string
  student_code:   string | null
  student_email:  string
  student_phone:  string | null
  // Parent
  parent_name:    string | null
  parent_phone_1: string | null
  parent_phone_2: string | null
  // Context (live data)
  branch_name:     string
  group_name:      string | null
  instructor_name: string | null
  course_title:    string | null
  // Snapshot fields (populated after sprint42 migration)
  group_name_snapshot:      string | null
  course_name_snapshot:     string | null
  instructor_name_snapshot: string | null
  branch_name_snapshot:     string | null
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateEnrollmentInput {
  student_id:         string
  branch_id:          string
  group_id:           string
  group_course_id?:   string
  instructor_id?:     string
  start_date?:        string          // defaults to today
  enrollment_type?:   'primary' | 'secondary'
  pricing_plan?:      string
  total_amount?:      number
  discount_amount?:   number
  enrolled_sessions?: number          // session package count
  notes?:             string
  created_by?:        string
}

export interface TransferEnrollmentInput {
  enrollment_id:    string           // the enrollment to transfer FROM
  new_group_id:     string
  new_group_course_id?: string
  new_instructor_id?:   string
  transfer_date?:   string           // defaults to today
  notes?:           string
  preserve_balance: boolean          // carry remaining balance to new enrollment
  created_by?:      string
}

export interface UpdateEnrollmentStatusInput {
  enrollment_id: string
  status:        EnrollmentStatus
  end_date?:     string
  notes?:        string
}

// ── Transfer history item ─────────────────────────────────────────────────────

export interface EnrollmentTransferHistory {
  from_enrollment_id:   string
  from_group_name:      string | null
  from_status:          EnrollmentStatus
  from_start_date:      string
  from_end_date:        string | null
  to_enrollment_id:     string | null
  to_group_name:        string | null
}

// ── Status display helpers ────────────────────────────────────────────────────

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  ACTIVE:      'Active',
  PAUSED:      'Paused',
  TRANSFERRED: 'Transferred',
  COMPLETED:   'Completed',
  DROPPED:     'Dropped',
  CANCELLED:   'Cancelled',
}

export const ENROLLMENT_STATUS_COLORS: Record<EnrollmentStatus, string> = {
  ACTIVE:      'bg-[#E7F8EE] text-[#15803D] border-[#A7F3D0]',
  PAUSED:      'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
  TRANSFERRED: 'bg-[#EFF6FF] text-[#1D4ED8] border-blue-200',
  COMPLETED:   'bg-[#F8FAFC] text-[#475569] border-slate-200',
  DROPPED:     'bg-[#FEE2E2] text-[#EF4444] border-[#FECACA]',
  CANCELLED:   'bg-rose-50 text-rose-700 border-rose-200',
}

// ── Canonical status groups ────────────────────────────────────────────────────

export const ACTIVE_ENROLLMENT_STATUSES: EnrollmentStatus[] = ['ACTIVE']

export const INACTIVE_ENROLLMENT_STATUSES: EnrollmentStatus[] = [
  'PAUSED', 'TRANSFERRED', 'COMPLETED', 'DROPPED', 'CANCELLED',
]

export const HISTORY_ENROLLMENT_STATUSES: EnrollmentStatus[] = [
  'ACTIVE', 'PAUSED', 'TRANSFERRED', 'COMPLETED', 'DROPPED', 'CANCELLED',
]
