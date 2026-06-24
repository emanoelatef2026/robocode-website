// Predictive Retention Engine — computes dropout probability for a student enrollment.
// Pure functions only (no DB calls). Used by automation engine, dashboards, and badges.

// ── Types ──────────────────────────────────────────────────────────────────────

export type DropoutCategory = 'SAFE' | 'WATCH' | 'HIGH_RISK' | 'CRITICAL'

export interface PredictiveInput {
  // Attendance signals
  attendance_pct:          number     // 0-100
  consecutive_absences:    number
  total_sessions:          number
  days_inactive:           number     // days since last attendance (0 = attended recently)

  // Financial signals
  days_overdue:            number
  remaining_balance:       number
  financial_status:        string | null  // BLOCKED|OVERDUE|DUE_SOON|CURRENT|null
  missed_payments:         number     // count of broken promises

  // Engagement signals
  has_incomplete_homework: boolean
  homework_completion_pct: number     // 0-100 (0 = never submitted)
  unresolved_complaints:   number
  low_satisfaction:        boolean    // parent rating < 3.5

  // Contract signals
  remaining_sessions:      number
  enrolled_sessions:       number     // 0 = unlimited

  // Context
  instructor_changed:      boolean    // instructor changed in last 30 days
  group_changed:           boolean    // group/transfer in last 30 days
  weeks_enrolled:          number     // total weeks since enrollment
}

export interface PredictiveResult {
  score:    number          // 0-100 (100 = certain dropout)
  category: DropoutCategory
  factors:  string[]        // human-readable driving factors
  confidence: 'low' | 'medium' | 'high'
}

// ── Score computation ──────────────────────────────────────────────────────────

export function computeDropoutScore(input: PredictiveInput): PredictiveResult {
  const factors: string[] = []
  let score = 0

  // ── Attendance decay (weight: 35 pts) ──────────────────────────────────────
  if (input.total_sessions >= 3) {
    if (input.attendance_pct < 40) {
      score += 35; factors.push('attendance_critical')
    } else if (input.attendance_pct < 60) {
      score += 25; factors.push('attendance_low')
    } else if (input.attendance_pct < 75) {
      score += 12; factors.push('attendance_below_avg')
    }
  }

  if (input.consecutive_absences >= 5) {
    score += 20; factors.push('five_consecutive_absences')
  } else if (input.consecutive_absences >= 3) {
    score += 12; factors.push('three_consecutive_absences')
  }

  if (input.days_inactive >= 21) {
    score += 18; factors.push('inactive_three_weeks')
  } else if (input.days_inactive >= 14) {
    score += 10; factors.push('inactive_two_weeks')
  }

  // ── Financial stress (weight: 30 pts) ──────────────────────────────────────
  if (input.financial_status === 'BLOCKED') {
    score += 30; factors.push('account_blocked')
  } else if (input.days_overdue >= 30) {
    score += 25; factors.push('overdue_30_days')
  } else if (input.days_overdue >= 14) {
    score += 15; factors.push('overdue_14_days')
  } else if (input.days_overdue >= 7) {
    score += 8;  factors.push('overdue_7_days')
  }

  if (input.missed_payments >= 2) {
    score += 10; factors.push('multiple_broken_promises')
  } else if (input.missed_payments === 1) {
    score += 5;  factors.push('broken_promise')
  }

  // ── Engagement decay (weight: 20 pts) ──────────────────────────────────────
  if (input.unresolved_complaints >= 2) {
    score += 15; factors.push('multiple_complaints')
  } else if (input.unresolved_complaints === 1) {
    score += 8;  factors.push('unresolved_complaint')
  }

  if (input.low_satisfaction) {
    score += 8; factors.push('low_parent_satisfaction')
  }

  if (input.total_sessions >= 5 && input.homework_completion_pct < 20) {
    score += 8; factors.push('no_homework_engagement')
  } else if (input.total_sessions >= 5 && input.homework_completion_pct < 50) {
    score += 4; factors.push('low_homework_engagement')
  }

  // ── Contract signals (weight: 10 pts) ──────────────────────────────────────
  if (input.enrolled_sessions > 0 && input.remaining_sessions <= 0) {
    score += 10; factors.push('sessions_exhausted')
  } else if (input.enrolled_sessions > 0 && input.remaining_sessions <= 2) {
    score += 5;  factors.push('sessions_near_exhausted')
  }

  // ── Context modifiers (weight: 5 pts) ──────────────────────────────────────
  if (input.instructor_changed) {
    score += 5; factors.push('instructor_changed')
  }
  if (input.group_changed) {
    score += 3; factors.push('group_transferred')
  }

  // ── Cap and normalize ──────────────────────────────────────────────────────
  score = Math.min(100, Math.max(0, score))

  const category = computeDropoutCategory(score)

  // Confidence is low for very new students (<3 sessions)
  const confidence = input.total_sessions < 3 ? 'low' : input.total_sessions < 6 ? 'medium' : 'high'

  return { score, category, factors, confidence }
}

export function computeDropoutCategory(score: number): DropoutCategory {
  if (score >= 70) return 'CRITICAL'
  if (score >= 45) return 'HIGH_RISK'
  if (score >= 25) return 'WATCH'
  return 'SAFE'
}

// ── Display config ─────────────────────────────────────────────────────────────

export const DROPOUT_CATEGORY_CONFIG: Record<DropoutCategory, {
  label: string; color: string; text: string; description: string
}> = {
  SAFE:      { label: 'Safe',      color: 'bg-[#E7F8EE]', text: 'text-[#15803D]', description: 'Student is on track.' },
  WATCH:     { label: 'Watch',     color: 'bg-[#FFFBEB]',   text: 'text-[#B45309]',   description: 'Minor risk factors detected.' },
  HIGH_RISK: { label: 'High Risk', color: 'bg-orange-100',  text: 'text-orange-700',  description: 'Multiple risk factors — proactive action needed.' },
  CRITICAL:  { label: 'Critical',  color: 'bg-[#FEE2E2]',     text: 'text-[#DC2626]',     description: 'Very likely to drop. Immediate intervention required.' },
}

export const FACTOR_LABELS: Record<string, string> = {
  attendance_critical:        'Attendance below 40%',
  attendance_low:             'Attendance below 60%',
  attendance_below_avg:       'Attendance below 75%',
  five_consecutive_absences:  '5+ consecutive absences',
  three_consecutive_absences: '3+ consecutive absences',
  inactive_three_weeks:       'No attendance for 3+ weeks',
  inactive_two_weeks:         'No attendance for 2+ weeks',
  account_blocked:            'Account is blocked',
  overdue_30_days:            '30+ days overdue',
  overdue_14_days:            '14+ days overdue',
  overdue_7_days:             '7+ days overdue',
  multiple_broken_promises:   'Multiple broken payment promises',
  broken_promise:             'Broken payment promise',
  multiple_complaints:        'Multiple unresolved complaints',
  unresolved_complaint:       'Unresolved complaint',
  low_parent_satisfaction:    'Low parent satisfaction rating',
  no_homework_engagement:     'Never submitted homework',
  low_homework_engagement:    'Low homework completion',
  sessions_exhausted:         'All sessions used up',
  sessions_near_exhausted:    'Sessions about to run out',
  instructor_changed:         'Instructor changed recently',
  group_transferred:          'Recently transferred groups',
}
