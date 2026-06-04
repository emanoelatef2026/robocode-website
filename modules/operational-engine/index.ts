// Operational Engine — single source of truth for all computed operational states.
// Pure functions (no DB calls). Used by every page, dashboard, and drawer.
//
// Replaces scattered: computeStudentRisk (finance/types), computeHealthScore
// (tl-dashboard/health-score), evaluateActions (actions-engine/index).

// ── Types ──────────────────────────────────────────────────────────────────────

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export type AttendanceTrend =
  | 'RECOVERING'   // consecutive_absences dropped after improvement
  | 'STABLE'       // consistent attendance ≥ 75%
  | 'DECLINING'    // attendance dropping, consec absences 1-2
  | 'DROPPING'     // consec absences 3-4, attendance 50-75%
  | 'CRITICAL'     // consec absences ≥ 5 OR attendance < 50%
  | 'INACTIVE'     // no attendance in 14+ days
  | 'NEW'          // < 3 sessions total, no baseline yet

export type CollectionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'

export type RenewalPriority = 'URGENT' | 'SOON' | 'UPCOMING' | 'NONE'

export type OperationalStatus =
  | 'HEALTHY'      // no issues
  | 'WATCH'        // 1 medium flag
  | 'ACTION'       // 1+ high flag or 2+ medium
  | 'CRITICAL'     // blocked or 2+ high flags

export type ActionCode =
  | 'RENEW_PACKAGE'
  | 'COLLECT_PAYMENT'
  | 'CONTACT_PARENT_ATTENDANCE'
  | 'ATTENDANCE_RISK'
  | 'ACADEMIC_FOLLOW_UP'
  | 'INACTIVE_STUDENT'
  | 'OVERDRAFT_WARNING'
  | 'BLOCKED_PAYMENT'
  | 'MISSING_GROUP'
  | 'PARENT_FOLLOW_UP'

export interface RecommendedAction {
  code:        ActionCode
  label:       string
  description: string
  priority:    'critical' | 'high' | 'medium' | 'low'
  color:       string
  textColor:   string
  icon:        string
}

export interface OperationalEngineInput {
  // Sessions (contract-based)
  enrolled_sessions:   number   // 0 = unlimited
  consumed_sessions:   number
  remaining_sessions:  number
  // Attendance (schedule-based)
  total_sessions:          number
  sessions_attended:       number
  attendance_pct:          number
  consecutive_absences:    number
  last_attendance_date:    string | null
  // Finance
  remaining_balance:       number
  days_overdue:            number
  financial_status:        string | null
  net_amount:              number
  // Context
  group_id:                string | null
  has_assignment_submissions: boolean
}

export interface EngineResult {
  risk:               { level: RiskLevel; flags: string[] }
  attendance_trend:   AttendanceTrend
  collection_priority: CollectionPriority
  renewal_priority:   RenewalPriority
  operational_status: OperationalStatus
  actions:            RecommendedAction[]
}

// ── Action definitions ─────────────────────────────────────────────────────────

const ACTION_DEFS: Record<ActionCode, Omit<RecommendedAction, 'code'>> = {
  BLOCKED_PAYMENT:            { label: 'Payment Blocked',       description: 'Account is blocked. Immediate resolution required.',    priority: 'critical', color: 'bg-red-100',    textColor: 'text-red-700',    icon: '🚫' },
  OVERDRAFT_WARNING:          { label: 'Sessions Exhausted',    description: 'All enrolled sessions used.',                            priority: 'high',     color: 'bg-amber-100',  textColor: 'text-amber-700',  icon: '⏳' },
  COLLECT_PAYMENT:            { label: 'Collect Payment',       description: 'Outstanding balance is overdue.',                        priority: 'critical', color: 'bg-red-100',    textColor: 'text-red-700',    icon: '💰' },
  RENEW_PACKAGE:              { label: 'Renew Package',         description: '2 or fewer sessions remaining.',                         priority: 'high',     color: 'bg-amber-100',  textColor: 'text-amber-700',  icon: '🔄' },
  INACTIVE_STUDENT:           { label: 'Inactive Student',      description: 'No attendance for 14+ days.',                            priority: 'critical', color: 'bg-slate-100',  textColor: 'text-slate-700',  icon: '😴' },
  ATTENDANCE_RISK:            { label: 'Attendance Risk',       description: '3+ consecutive absences.',                               priority: 'high',     color: 'bg-red-100',    textColor: 'text-red-700',    icon: '⚠️' },
  CONTACT_PARENT_ATTENDANCE:  { label: 'Contact Parent',        description: 'Attendance below 60% — parent contact needed.',          priority: 'high',     color: 'bg-orange-100', textColor: 'text-orange-700', icon: '📞' },
  ACADEMIC_FOLLOW_UP:         { label: 'Academic Follow-up',   description: 'No assignment submissions recorded.',                    priority: 'medium',   color: 'bg-purple-100', textColor: 'text-purple-700', icon: '📚' },
  MISSING_GROUP:              { label: 'No Group Assigned',     description: 'Student has an active contract but no delivery group.',  priority: 'medium',   color: 'bg-slate-100',  textColor: 'text-slate-600',  icon: '📦' },
  PARENT_FOLLOW_UP:           { label: 'Parent Follow-up',      description: 'Unresolved parent complaint or message.',                priority: 'medium',   color: 'bg-blue-100',   textColor: 'text-blue-700',   icon: '💬' },
}

// ── computeRisk ────────────────────────────────────────────────────────────────

export function computeRisk(input: OperationalEngineInput): { level: RiskLevel; flags: string[] } {
  const flags: string[] = []

  if (input.sessions_attended > 0) {
    if (input.attendance_pct < 60)      flags.push('attendance_critical')
    else if (input.attendance_pct < 80) flags.push('attendance_low')
  }

  if (input.financial_status === 'BLOCKED') {
    flags.push('payment_blocked')
  } else if (input.financial_status === 'OVERDUE' && input.days_overdue > 0) {
    flags.push('payment_overdue')
  } else if (input.financial_status === 'DUE_SOON') {
    flags.push('payment_due_soon')
  }

  if (input.consecutive_absences >= 3) flags.push('consecutive_absences')

  if (input.sessions_attended >= 5  && input.sessions_attended < 10  && input.remaining_balance > 0) flags.push('milestone_5')
  if (input.sessions_attended >= 10 && input.sessions_attended < 15  && input.remaining_balance > 0) flags.push('milestone_10')
  if (input.sessions_attended >= 15 && input.sessions_attended < 20  && input.remaining_balance > 0) flags.push('milestone_15')
  if (input.sessions_attended >= 20 && input.remaining_balance > 0)                                  flags.push('milestone_20')

  const hasSessionMilestone = flags.some(f => f.startsWith('milestone_'))
  if (hasSessionMilestone) flags.push('session_milestone')

  const high = new Set(['attendance_critical', 'payment_overdue', 'payment_blocked', 'consecutive_absences', 'session_milestone'])
  const med  = new Set(['attendance_low', 'payment_due_soon'])

  const level: RiskLevel =
    flags.some(f => high.has(f)) ? 'HIGH' :
    flags.some(f => med.has(f))  ? 'MEDIUM' : 'LOW'

  return { level, flags }
}

// ── computeAttendanceHealth ────────────────────────────────────────────────────

export function computeAttendanceHealth(input: OperationalEngineInput): AttendanceTrend {
  if (input.total_sessions < 3) return 'NEW'

  const daysSinceLast = input.last_attendance_date
    ? Math.floor((Date.now() - new Date(input.last_attendance_date).getTime()) / 86400000)
    : null

  if (daysSinceLast !== null && daysSinceLast >= 14) return 'INACTIVE'
  if (input.total_sessions >= 3 && input.sessions_attended === 0) return 'INACTIVE'

  if (input.consecutive_absences >= 5 || input.attendance_pct < 50) return 'CRITICAL'
  if (input.consecutive_absences >= 3) return 'DROPPING'
  if (input.consecutive_absences >= 1 && input.attendance_pct < 75) return 'DECLINING'

  // Recovering: was declining, now consecutive absences = 0 and attendance improving
  if (input.consecutive_absences === 0 && input.attendance_pct >= 60 && input.attendance_pct < 80) return 'RECOVERING'

  return 'STABLE'
}

// ── computeCollectionPriority ──────────────────────────────────────────────────

export function computeCollectionPriority(input: OperationalEngineInput): CollectionPriority {
  if (input.remaining_balance <= 0) return 'NONE'
  if (input.financial_status === 'BLOCKED') return 'CRITICAL'
  if (input.days_overdue >= 30) return 'CRITICAL'
  if (input.days_overdue >= 14) return 'HIGH'
  if (input.days_overdue >= 1)  return 'MEDIUM'
  if (input.financial_status === 'DUE_SOON') return 'LOW'
  return 'LOW'
}

// ── computeRenewalPriority ─────────────────────────────────────────────────────

export function computeRenewalPriority(input: OperationalEngineInput): RenewalPriority {
  if (input.enrolled_sessions === 0) return 'NONE'   // unlimited
  if (input.remaining_sessions <= 0) return 'URGENT'
  if (input.remaining_sessions <= 2) return 'URGENT'
  if (input.remaining_sessions <= 5) return 'SOON'
  if (input.remaining_sessions <= 10) return 'UPCOMING'
  return 'NONE'
}

// ── computeOperationalStatus ───────────────────────────────────────────────────

export function computeOperationalStatus(risk: { level: RiskLevel; flags: string[] }): OperationalStatus {
  const highFlags = risk.flags.filter(f =>
    ['attendance_critical', 'payment_overdue', 'payment_blocked', 'consecutive_absences', 'session_milestone'].includes(f)
  )
  const medFlags = risk.flags.filter(f =>
    ['attendance_low', 'payment_due_soon'].includes(f)
  )

  if (risk.flags.includes('payment_blocked') || highFlags.length >= 2) return 'CRITICAL'
  if (highFlags.length >= 1) return 'ACTION'
  if (medFlags.length >= 2) return 'ACTION'
  if (medFlags.length >= 1) return 'WATCH'
  return 'HEALTHY'
}

// ── computeRecommendedAction ───────────────────────────────────────────────────

export function computeRecommendedAction(input: OperationalEngineInput): RecommendedAction[] {
  const actions: RecommendedAction[] = []
  const add = (code: ActionCode) => actions.push({ code, ...ACTION_DEFS[code] })

  if (input.financial_status === 'BLOCKED')                             add('BLOCKED_PAYMENT')
  if (input.enrolled_sessions > 0 && input.remaining_sessions <= 0)    add('OVERDRAFT_WARNING')
  else if (input.enrolled_sessions > 0 && input.remaining_sessions <= 2) add('RENEW_PACKAGE')
  if (input.remaining_balance > 0 && input.days_overdue > 0)           add('COLLECT_PAYMENT')

  const daysSinceLast = input.last_attendance_date
    ? Math.floor((Date.now() - new Date(input.last_attendance_date).getTime()) / 86400000)
    : null
  if ((daysSinceLast !== null && daysSinceLast >= 14) ||
      (input.total_sessions >= 2 && input.sessions_attended === 0))     add('INACTIVE_STUDENT')

  if (input.consecutive_absences >= 3) add('ATTENDANCE_RISK')
  if (input.total_sessions >= 3 && input.attendance_pct < 60)          add('CONTACT_PARENT_ATTENDANCE')
  if (input.total_sessions >= 5 && !input.has_assignment_submissions)  add('ACADEMIC_FOLLOW_UP')
  if (!input.group_id)                                                  add('MISSING_GROUP')

  // Deduplicate and sort by priority
  const seen = new Set<ActionCode>()
  const order = { critical: 0, high: 1, medium: 2, low: 3 }
  return actions
    .filter(a => { if (seen.has(a.code)) return false; seen.add(a.code); return true })
    .sort((a, b) => order[a.priority] - order[b.priority])
}

// ── evaluate (full engine) ─────────────────────────────────────────────────────

export function evaluate(input: OperationalEngineInput): EngineResult {
  const risk               = computeRisk(input)
  const attendance_trend   = computeAttendanceHealth(input)
  const collection_priority = computeCollectionPriority(input)
  const renewal_priority   = computeRenewalPriority(input)
  const operational_status = computeOperationalStatus(risk)
  const actions            = computeRecommendedAction(input)

  return { risk, attendance_trend, collection_priority, renewal_priority, operational_status, actions }
}

// ── computeHealthScore ─────────────────────────────────────────────────────────
// Consolidated from tl-dashboard/health-score.ts

export interface HealthScore {
  score: number
  level: 'excellent' | 'good' | 'attention' | 'at_risk'
  label: string
  cls:   string
}

export function computeHealthScore(
  attendanceScore: number,
  assignmentScore: number,
  portfolioScore:  number,
  feedbackScore:   number = 100
): HealthScore {
  const score = Math.round(
    attendanceScore * 0.40 +
    assignmentScore * 0.30 +
    portfolioScore  * 0.20 +
    feedbackScore   * 0.10
  )
  if (score >= 90) return { score, level: 'excellent', label: 'Excellent', cls: 'bg-green-100 text-green-700' }
  if (score >= 75) return { score, level: 'good',      label: 'Good',      cls: 'bg-blue-100 text-blue-700'  }
  if (score >= 60) return { score, level: 'attention', label: 'Attention', cls: 'bg-yellow-100 text-yellow-700' }
  return               { score, level: 'at_risk',   label: 'At Risk',   cls: 'bg-red-100 text-red-700'    }
}

// ── Display helpers ────────────────────────────────────────────────────────────

export const RISK_LEVEL_CLASSES: Record<RiskLevel, string> = {
  HIGH:   'bg-red-100 text-red-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW:    'bg-emerald-100 text-emerald-700',
}

export const ATTENDANCE_TREND_CONFIG: Record<AttendanceTrend, { label: string; color: string; text: string }> = {
  RECOVERING: { label: 'Recovering',  color: 'bg-blue-100',    text: 'text-blue-700'   },
  STABLE:     { label: 'Stable',      color: 'bg-emerald-100', text: 'text-emerald-700'},
  DECLINING:  { label: 'Declining',   color: 'bg-amber-100',   text: 'text-amber-700'  },
  DROPPING:   { label: 'Dropping',    color: 'bg-orange-100',  text: 'text-orange-700' },
  CRITICAL:   { label: 'Critical',    color: 'bg-red-100',     text: 'text-red-700'    },
  INACTIVE:   { label: 'Inactive',    color: 'bg-slate-100',   text: 'text-slate-600'  },
  NEW:        { label: 'New Student', color: 'bg-purple-100',  text: 'text-purple-700' },
}

export const OPERATIONAL_STATUS_CONFIG: Record<OperationalStatus, { label: string; color: string; text: string }> = {
  HEALTHY:  { label: 'Healthy',  color: 'bg-emerald-100', text: 'text-emerald-700' },
  WATCH:    { label: 'Watch',    color: 'bg-amber-100',   text: 'text-amber-700'   },
  ACTION:   { label: 'Action',   color: 'bg-orange-100',  text: 'text-orange-700'  },
  CRITICAL: { label: 'Critical', color: 'bg-red-100',     text: 'text-red-700'     },
}

export const COLLECTION_PRIORITY_CONFIG: Record<CollectionPriority, { label: string; color: string }> = {
  CRITICAL: { label: 'Critical', color: 'text-red-700'    },
  HIGH:     { label: 'High',     color: 'text-orange-700' },
  MEDIUM:   { label: 'Medium',   color: 'text-amber-700'  },
  LOW:      { label: 'Low',      color: 'text-blue-700'   },
  NONE:     { label: '—',        color: 'text-slate-400'  },
}

export const RENEWAL_PRIORITY_CONFIG: Record<RenewalPriority, { label: string; color: string }> = {
  URGENT:   { label: 'Renew Now',  color: 'text-red-700'   },
  SOON:     { label: 'Renew Soon', color: 'text-amber-700' },
  UPCOMING: { label: 'Upcoming',   color: 'text-blue-700'  },
  NONE:     { label: '—',          color: 'text-slate-400' },
}

// ── Backward-compat re-exports ─────────────────────────────────────────────────
// Older modules that import from actions-engine or finance/types still work.

export { computeRecommendedAction as evaluateActions }
export type { RecommendedAction as RecommendedActionLegacy }

// computeStudentRisk shim — preserves the exact same interface
export function computeStudentRisk(row: {
  attendance_pct:       number
  financial_status:     string | null
  days_overdue:         number
  consecutive_absences: number
  sessions_attended:    number
  remaining_amount:     number
}): { level: RiskLevel; flags: string[] } {
  return computeRisk({
    enrolled_sessions:   0,
    consumed_sessions:   0,
    remaining_sessions:  0,
    total_sessions:      row.sessions_attended,
    sessions_attended:   row.sessions_attended,
    attendance_pct:      row.attendance_pct,
    consecutive_absences: row.consecutive_absences,
    last_attendance_date: null,
    remaining_balance:   row.remaining_amount,
    days_overdue:        row.days_overdue,
    financial_status:    row.financial_status,
    net_amount:          0,
    group_id:            'shim',
    has_assignment_submissions: true,
  })
}
