// Operational Task System — types

export type TaskType =
  | 'COLLECTION'
  | 'RENEWAL'
  | 'ATTENDANCE'
  | 'RETENTION'
  | 'PARENT_REPLY'
  | 'INSTRUCTOR_REVIEW'
  | 'COMPLAINT'
  | 'FOLLOW_UP'

export type TaskStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DISMISSED'

export type TaskSeverity =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export interface OperationalTask {
  id:             string
  branch_id:      string | null
  student_id:     string | null
  enrollment_id:  string | null
  parent_id:      string | null
  assigned_to:    string | null
  type:           TaskType
  severity:       TaskSeverity
  status:         TaskStatus
  due_date:       string | null       // ISO date
  notes:          string | null
  auto_generated: boolean
  completed_at:   string | null
  dismissed_at:   string | null
  dismissed_reason: string | null
  created_by:     string | null
  created_at:     string
  updated_at:     string
  // Joined
  student_name?:  string | null
  student_code?:  string | null
  branch_name?:   string | null
}

export interface CreateTaskInput {
  branch_id?:     string
  student_id?:    string
  enrollment_id?: string
  parent_id?:     string
  assigned_to?:   string
  type:           TaskType
  severity?:      TaskSeverity
  due_date?:      string
  notes?:         string
  auto_generated?: boolean
  created_by?:    string
}

export interface UpdateTaskInput {
  status?:          TaskStatus
  severity?:        TaskSeverity
  assigned_to?:     string | null
  due_date?:        string | null
  notes?:           string
  dismissed_reason?: string
}

// ── Display config ─────────────────────────────────────────────────────────────

export const TASK_TYPE_CONFIG: Record<TaskType, {
  label: string; icon: string; color: string; text: string
}> = {
  COLLECTION:        { label: 'Collection',        icon: '💰', color: 'bg-red-100',     text: 'text-red-700'     },
  RENEWAL:           { label: 'Renewal',           icon: '🔄', color: 'bg-amber-100',   text: 'text-amber-700'   },
  ATTENDANCE:        { label: 'Attendance',        icon: '⚠️', color: 'bg-orange-100',  text: 'text-orange-700'  },
  RETENTION:         { label: 'Retention',         icon: '📊', color: 'bg-purple-100',  text: 'text-purple-700'  },
  PARENT_REPLY:      { label: 'Parent Reply',      icon: '💬', color: 'bg-blue-100',    text: 'text-blue-700'    },
  INSTRUCTOR_REVIEW: { label: 'Instructor Review', icon: '👨‍🏫', color: 'bg-indigo-100',  text: 'text-indigo-700'  },
  COMPLAINT:         { label: 'Complaint',         icon: '🚨', color: 'bg-red-100',     text: 'text-red-700'     },
  FOLLOW_UP:         { label: 'Follow Up',         icon: '📞', color: 'bg-slate-100',   text: 'text-slate-700'   },
}

export const TASK_SEVERITY_CONFIG: Record<TaskSeverity, { color: string; text: string }> = {
  LOW:      { color: 'bg-slate-100',   text: 'text-slate-600'   },
  MEDIUM:   { color: 'bg-amber-100',   text: 'text-amber-700'   },
  HIGH:     { color: 'bg-orange-100',  text: 'text-orange-700'  },
  CRITICAL: { color: 'bg-red-100',     text: 'text-red-700'     },
}

export const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; text: string }> = {
  OPEN:        { label: 'Open',        color: 'bg-blue-100',    text: 'text-blue-700'    },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-100',   text: 'text-amber-700'   },
  COMPLETED:   { label: 'Completed',   color: 'bg-emerald-100', text: 'text-emerald-700' },
  DISMISSED:   { label: 'Dismissed',   color: 'bg-slate-100',   text: 'text-slate-500'   },
}
