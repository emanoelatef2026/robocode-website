import type { GroupPnL } from '@/modules/finance/types'

export interface BatchStudentRow {
  group_id:           string
  student_id:         string
  student_name:       string
  student_code:       string | null
  age:                number | null
  phone:              string | null
  parent_name:        string | null
  parent_phone:       string | null
  joined_at:          string
  attendance_pct:     number
  sessions_remaining: number | null
  sessions_total:     number | null
  paid_amount:        number
  remaining_balance:  number
  payment_status:     string | null
  risk_level:         'HIGH' | 'MEDIUM' | 'LOW'
}

export interface ExportServerResult {
  pnlRows:  GroupPnL[]
  students: BatchStudentRow[]
}
