// Observability types — Phase 1: Central Event Observability

export type EventSeverity = 'info' | 'warning' | 'error' | 'critical'

export type EventType =
  | 'AUTOMATION_FAILURE'
  | 'AUTOMATION_LOOP_DETECTED'
  | 'REALTIME_ERROR'
  | 'REALTIME_RECONNECT'
  | 'JOB_FAILURE'
  | 'JOB_DEAD_LETTER'
  | 'NOTIFICATION_FAILURE'
  | 'CONSISTENCY_MISMATCH'
  | 'SECURITY_DENIAL'
  | 'SLOW_QUERY'
  | 'SYNC_ERROR'
  | 'REPAIR_ACTION'
  | 'DEPLOYMENT_CHECK'
  | 'STORAGE_VALIDATION_FAILED'

export interface SystemEventInput {
  type:          EventType
  severity?:     EventSeverity    // default 'error'
  module:        string           // e.g., 'automation-engine', 'background-jobs'
  message:       string
  actor_user_id?: string | null
  branch_id?:    string | null
  entity_type?:  string | null    // table name
  entity_id?:    string | null    // UUID
  payload?:      Record<string, unknown>
}

export interface SystemEventRow extends SystemEventInput {
  id:         string
  resolved:   boolean
  created_at: string
}

export interface ConsistencyMismatch {
  entity_type:  string
  entity_id:    string
  field:        string
  ts_value:     unknown
  sql_value:    unknown
  diff:         number | null
}
