// Canonical, single-source-of-truth rules for whether an attendance record
// should consume a session from the student's enrollment contract.
//
// All callers — TL attendance, instructor attendance, retroactive recording —
// MUST use this module.  No duplicate consumption logic elsewhere.

// ── Types ──────────────────────────────────────────────────────────────────────

export type ConsumptionReason =
  | 'eligible'           // all rules passed — session consumed
  | 'overdraft_allowed'  // consumed past limit (allow_overdraft_sessions = true)
  | 'no_slot_status'     // attendance status is not slot-consuming (e.g. 'excused')
  | 'no_contract'        // student has no ACTIVE enrollment at all
  | 'pre_enrollment'     // session date is before enrollment.start_date
  | 'post_enrollment'    // session date is after enrollment.end_date
  | 'exhausted'          // remaining_sessions ≤ 0, overdraft not enabled
  | 'open_ended'         // enrolled_sessions = 0 — unlimited / not tracked

export interface ConsumptionCheck {
  shouldConsume:        boolean
  reason:               ConsumptionReason
  enrollmentId:         string | null
  enrollmentStartDate:  string | null
  sessionsRemaining:    number | null   // value BEFORE this session is consumed
}

export interface EnrollmentForConsumption {
  id:                 string
  start_date:         string            // 'YYYY-MM-DD' or ISO datetime
  end_date:           string | null     // null = no expiry; set = package expires on this date
  enrolled_sessions:  number
  remaining_sessions: number
  allow_overdraft:    boolean
}

export interface StudentConsumptionResult {
  student_id:           string
  consumed:             boolean
  reason:               ConsumptionReason
  sessions_remaining:   number | null   // AFTER consumption (post-batch-RPC)
  enrollment_start_date: string | null
}

// ── Core eligibility check ─────────────────────────────────────────────────────

/**
 * Returns whether an attendance record should create an attendance_consumptions
 * entry, and why.
 *
 * Rules (ALL must pass for consumption):
 *   1. Attendance status is slot-consuming (present / absent / late / makeup / excused)
 *   2. Student has an ACTIVE enrollment
 *   3. enrolled_sessions > 0  (0 = open-ended / untracked contract)
 *   4. session_date >= enrollment.start_date  (retroactive pre-payment attendance excluded)
 *   5. remaining_sessions > 0  OR  allow_overdraft = true
 *
 * @param attendanceStatus     e.g. 'present', 'absent', 'late', 'makeup', 'excused'
 * @param sessionDate          ISO datetime for the session (scheduled_at)
 * @param enrollment           Student's FIFO active enrollment (null if none)
 * @param slotConsumingStatuses  Canonical set — must match SLOT_CONSUMING_STATUSES
 */
export function checkConsumptionEligibility(
  attendanceStatus:      string,
  sessionDate:           string,
  enrollment:            EnrollmentForConsumption | null,
  slotConsumingStatuses: ReadonlySet<string>
): ConsumptionCheck {
  // Rule 1 — attendance must be slot-consuming
  if (!slotConsumingStatuses.has(attendanceStatus)) {
    return makeCheck(false, 'no_slot_status', null)
  }

  // Rule 2 — must have an enrollment
  if (!enrollment) {
    return makeCheck(false, 'no_contract', null)
  }

  // Rule 3 — enrolled_sessions = 0 means unlimited / not tracked
  if (enrollment.enrolled_sessions === 0) {
    return {
      shouldConsume:        false,
      reason:               'open_ended',
      enrollmentId:         enrollment.id,
      enrollmentStartDate:  enrollment.start_date,
      sessionsRemaining:    null,
    }
  }

  // Rule 4a — session must be on or after enrollment effective date
  const sessionDay    = sessionDate.slice(0, 10)          // 'YYYY-MM-DD'
  const enrollmentDay = enrollment.start_date.slice(0, 10)
  if (sessionDay < enrollmentDay) {
    return {
      shouldConsume:        false,
      reason:               'pre_enrollment',
      enrollmentId:         enrollment.id,
      enrollmentStartDate:  enrollment.start_date,
      sessionsRemaining:    enrollment.remaining_sessions,
    }
  }

  // Rule 4b — session must be on or before enrollment end_date (if set)
  if (enrollment.end_date) {
    const endDay = enrollment.end_date.slice(0, 10)
    if (sessionDay > endDay) {
      return {
        shouldConsume:        false,
        reason:               'post_enrollment',
        enrollmentId:         enrollment.id,
        enrollmentStartDate:  enrollment.start_date,
        sessionsRemaining:    enrollment.remaining_sessions,
      }
    }
  }

  // Rule 5a — exhausted without overdraft
  if (enrollment.remaining_sessions <= 0 && !enrollment.allow_overdraft) {
    return {
      shouldConsume:        false,
      reason:               'exhausted',
      enrollmentId:         enrollment.id,
      enrollmentStartDate:  enrollment.start_date,
      sessionsRemaining:    0,
    }
  }

  // Rule 5b — overdraft granted
  if (enrollment.remaining_sessions <= 0 && enrollment.allow_overdraft) {
    return {
      shouldConsume:        true,
      reason:               'overdraft_allowed',
      enrollmentId:         enrollment.id,
      enrollmentStartDate:  enrollment.start_date,
      sessionsRemaining:    0,
    }
  }

  // All rules pass
  return {
    shouldConsume:        true,
    reason:               'eligible',
    enrollmentId:         enrollment.id,
    enrollmentStartDate:  enrollment.start_date,
    sessionsRemaining:    enrollment.remaining_sessions,
  }
}

// ── FIFO enrollment resolution ─────────────────────────────────────────────────

/**
 * From a list of ACTIVE enrollments (ordered start_date ASC, created_at ASC),
 * returns the best enrollment to use for a session recorded at sessionDate.
 *
 * Priority:
 *   1. Earliest enrollment where start_date <= sessionDate AND remaining > 0
 *   2. Earliest enrollment where start_date <= sessionDate (even if exhausted)
 *   3. Earliest enrollment overall (for pre_enrollment display)
 */
export function resolveFifoEnrollment(
  enrollments: EnrollmentForConsumption[],
  sessionDate: string
): EnrollmentForConsumption | null {
  if (enrollments.length === 0) return null
  const sessionDay = sessionDate.slice(0, 10)

  // Pass 1: eligible (within window start→end AND has remaining sessions)
  for (const e of enrollments) {
    const startDay = e.start_date.slice(0, 10)
    const endDay   = e.end_date ? e.end_date.slice(0, 10) : null
    const withinWindow = startDay <= sessionDay && (endDay === null || sessionDay <= endDay)
    if (withinWindow && (e.enrolled_sessions === 0 || e.remaining_sessions > 0)) {
      return e
    }
  }
  // Pass 2: exhausted but session-eligible (for correct 'exhausted' reason)
  for (const e of enrollments) {
    const startDay = e.start_date.slice(0, 10)
    const endDay   = e.end_date ? e.end_date.slice(0, 10) : null
    if (startDay <= sessionDay && (endDay === null || sessionDay <= endDay)) {
      return e
    }
  }
  // Pass 3: future or expired enrollment (shows 'pre_enrollment'/'post_enrollment' reason)
  return enrollments[0]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeCheck(
  shouldConsume: boolean,
  reason: ConsumptionReason,
  enrollment: EnrollmentForConsumption | null
): ConsumptionCheck {
  return {
    shouldConsume,
    reason,
    enrollmentId:        enrollment?.id         ?? null,
    enrollmentStartDate: enrollment?.start_date ?? null,
    sessionsRemaining:   enrollment != null ? enrollment.remaining_sessions : null,
  }
}
