// Recommended Action Engine — pure rule evaluation (no DB calls here)
// Input: operational data (enrollment, attendance, finance, sessions)
// Output: list of recommended actions with priority and display config

export type ActionCode =
  | 'RENEW_PACKAGE'
  | 'COLLECT_PAYMENT'
  | 'CONTACT_PARENT_ATTENDANCE'
  | 'ATTENDANCE_RISK'
  | 'ACADEMIC_FOLLOW_UP'
  | 'INACTIVE_STUDENT'
  | 'OVERDRAFT_WARNING'
  | 'BLOCKED_PAYMENT'

export interface RecommendedAction {
  code:        ActionCode
  label:       string
  description: string
  priority:    'critical' | 'high' | 'medium' | 'low'
  color:       string        // Tailwind bg class
  textColor:   string        // Tailwind text class
  icon:        string        // emoji shorthand
}

export interface ActionEngineInput {
  remaining_sessions:  number
  enrolled_sessions:   number     // 0 = unlimited
  remaining_balance:   number
  days_overdue:        number | null
  financial_status:    string | null
  attendance_pct:      number
  consecutive_absences: number
  last_attendance_days_ago: number | null   // null = never attended
  has_assignment_submissions: boolean
  total_sessions:      number
}

const ACTIONS: Record<ActionCode, Omit<RecommendedAction, 'code'>> = {
  RENEW_PACKAGE: {
    label:       'Renew Package',
    description: 'Student has 2 or fewer sessions remaining.',
    priority:    'high',
    color:       'bg-amber-100',
    textColor:   'text-amber-700',
    icon:        '🔄',
  },
  COLLECT_PAYMENT: {
    label:       'Collect Payment',
    description: 'Outstanding balance is overdue.',
    priority:    'critical',
    color:       'bg-red-100',
    textColor:   'text-red-700',
    icon:        '💰',
  },
  CONTACT_PARENT_ATTENDANCE: {
    label:       'Contact Parent',
    description: 'Attendance is below 60% — parent contact needed.',
    priority:    'high',
    color:       'bg-orange-100',
    textColor:   'text-orange-700',
    icon:        '📞',
  },
  ATTENDANCE_RISK: {
    label:       'Attendance Risk',
    description: '3 or more consecutive absences detected.',
    priority:    'high',
    color:       'bg-red-100',
    textColor:   'text-red-700',
    icon:        '⚠️',
  },
  ACADEMIC_FOLLOW_UP: {
    label:       'Academic Follow-up',
    description: 'No assignment submissions recorded.',
    priority:    'medium',
    color:       'bg-purple-100',
    textColor:   'text-purple-700',
    icon:        '📚',
  },
  INACTIVE_STUDENT: {
    label:       'Inactive Student',
    description: 'No attendance for 14+ days.',
    priority:    'critical',
    color:       'bg-slate-100',
    textColor:   'text-slate-700',
    icon:        '😴',
  },
  OVERDRAFT_WARNING: {
    label:       'Sessions Exhausted',
    description: 'Student has used all enrolled sessions.',
    priority:    'high',
    color:       'bg-amber-100',
    textColor:   'text-amber-700',
    icon:        '⏳',
  },
  BLOCKED_PAYMENT: {
    label:       'Payment Blocked',
    description: 'Financial account is blocked. Requires immediate resolution.',
    priority:    'critical',
    color:       'bg-red-100',
    textColor:   'text-red-700',
    icon:        '🚫',
  },
}

export function evaluateActions(input: ActionEngineInput): RecommendedAction[] {
  const actions: RecommendedAction[] = []

  const add = (code: ActionCode) => actions.push({ code, ...ACTIONS[code] })

  // BLOCKED
  if (input.financial_status === 'BLOCKED') add('BLOCKED_PAYMENT')

  // Sessions exhausted (only when enrolled_sessions > 0 = finite package)
  if (input.enrolled_sessions > 0 && input.remaining_sessions <= 0) {
    add('OVERDRAFT_WARNING')
  } else if (input.enrolled_sessions > 0 && input.remaining_sessions <= 2) {
    add('RENEW_PACKAGE')
  }

  // Overdue payment
  if (input.remaining_balance > 0 && (input.days_overdue ?? 0) > 0) {
    add('COLLECT_PAYMENT')
  }

  // Inactive (no attendance 14+ days)
  if (input.last_attendance_days_ago !== null && input.last_attendance_days_ago >= 14) {
    add('INACTIVE_STUDENT')
  } else if (input.total_sessions > 0 && input.last_attendance_days_ago === null) {
    // Group has sessions but student never attended
    add('INACTIVE_STUDENT')
  }

  // Consecutive absences ≥ 3
  if (input.consecutive_absences >= 3) add('ATTENDANCE_RISK')

  // Attendance below 60%
  if (input.total_sessions >= 3 && input.attendance_pct < 60) {
    add('CONTACT_PARENT_ATTENDANCE')
  }

  // No assignment submissions
  if (input.total_sessions >= 5 && !input.has_assignment_submissions) {
    add('ACADEMIC_FOLLOW_UP')
  }

  // Deduplicate and sort by priority
  const seen = new Set<ActionCode>()
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  return actions
    .filter(a => { if (seen.has(a.code)) return false; seen.add(a.code); return true })
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
}

// ── Display component helper ───────────────────────────────────────────────────

export function ActionBadge({ action }: { action: RecommendedAction }) {
  return null  // Implemented inline in pages — this is a type-level helper
}
