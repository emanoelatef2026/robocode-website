// Phase 2 — Graduation Wizard: pure functions only, no DB access. Kept
// separate from graduation.ts so the highest-value logic (the TS↔SQL
// payload contract, the recommendation heuristic, the "everyone decided"
// gate) is trivially unit-testable without mocking Supabase.

export type GraduationDecision = 'continue' | 'graduate' | 'hold' | 'drop' | 'transfer' | 'repeat'

// UI/draft-only sentinel — never sent to the RPC. Every student starts here;
// the operator must explicitly move off it (round 3 adjustment #2 — no
// heuristic pre-selection).
export type WizardDecision = GraduationDecision | 'undecided'

export interface NextCohortDraft {
  branch_id:              string
  series_id:               string | null
  semester_id:              string | null
  name:                     string
  code:                     string | null
  type:                     string
  capacity:                 number | null
  waitlist_capacity:        number
  day_of_week:              string | null
  time:                     string | null
  start_date:               string | null
  room:                     string | null   // advisory only — groups has no room column, see graduation.ts
  course_id:                string | null
  instructor_id:             string | null
  asst_instructor_id:        string | null
  robocode_share_percent:    number | null
  planned_sessions:          number | null
  open_ended:               boolean
}

export interface GraduationStudentDecision {
  student_id:           string
  old_enrollment_id:    string | null
  old_group_student_id: string
  decision:             GraduationDecision
  transfer_group_id?:   string
}

export interface CommitGraduationInput {
  old_group_id: string
  request_id:   string
  draft_id?:    string
  new_group:    NextCohortDraft
  decisions:    GraduationStudentDecision[]
}

export interface CommitGraduationResult {
  new_group_id:      string
  decision_counts:    Partial<Record<GraduationDecision, number>>
  replayed:          boolean
}

// Display-only recommendation — NEVER auto-applied to wizard state (round 3
// adjustment #2). The operator must explicitly choose for every student;
// this is surfaced as a separate "Recommended" badge only.
export function recommendDecision(row: {
  has_certificate:     boolean
  outstanding_balance: number
  attendance_pct:      number
}): GraduationDecision {
  if (row.has_certificate) return 'continue'
  if (row.attendance_pct < 60) return 'repeat'
  return 'continue'
}

// The Step 3 exit-gate check — every active student must have an explicit,
// non-'undecided' decision. Shared between the client-side Next-button guard
// and the server-side pre-flight check in commitCohortGraduation (the RPC's
// coverage guard is the final backstop below both).
export function allDecided(
  decisions: Record<string, WizardDecision>,
  activeStudentIds: string[],
): boolean {
  if (!activeStudentIds.length) return true
  return activeStudentIds.every(id => {
    const d = decisions[id]
    return !!d && d !== 'undecided'
  })
}

// The one function that defines the TS↔SQL contract boundary. Deliberately
// omits instructor_id/room/planned_sessions/open_ended from new_group —
// nothing about the new cohort's teaching configuration is ever sent to the
// atomic commit (round 3 adjustment #4 — no best-effort steps disguised as
// complete). Those fields stay client/draft-side only, handed to the guided
// "Complete Cohort Setup" step after commit.
export function buildGraduationRpcPayload(input: CommitGraduationInput): {
  old_group_id: string
  new_group: {
    branch_id: string
    semester_id: string | null
    series_id: string | null
    name: string
    code: string | null
    type: string
    capacity: number | null
    waitlist_capacity: number
    day_of_week: string | null
    time: string | null
    start_date: string | null
    robocode_share_percent: number | null
    course_id: string | null
  }
  decisions: Array<{
    student_id: string
    old_enrollment_id: string | null
    old_group_student_id: string
    decision: GraduationDecision
    transfer_group_id?: string
  }>
} {
  const g = input.new_group
  return {
    old_group_id: input.old_group_id,
    new_group: {
      branch_id:               g.branch_id,
      semester_id:              g.semester_id,
      series_id:                g.series_id,
      name:                     g.name,
      code:                     g.code,
      type:                     g.type,
      capacity:                 g.capacity,
      waitlist_capacity:        g.waitlist_capacity,
      day_of_week:              g.day_of_week,
      time:                     g.time,
      start_date:               g.start_date,
      robocode_share_percent:    g.robocode_share_percent,
      // course_id is advisory metadata stamped onto new enrollments — it does
      // NOT cause a group_courses row to be created (see graduation.ts).
      course_id:                g.course_id,
    },
    decisions: input.decisions.map(d => ({
      student_id:           d.student_id,
      old_enrollment_id:    d.old_enrollment_id,
      old_group_student_id: d.old_group_student_id,
      decision:             d.decision,
      ...(d.transfer_group_id ? { transfer_group_id: d.transfer_group_id } : {}),
    })),
  }
}

export function decisionCountsSummary(counts: Partial<Record<GraduationDecision, number>>): string {
  const labels: Record<GraduationDecision, string> = {
    continue: 'continuing', graduate: 'graduating', hold: 'held',
    drop: 'dropped', transfer: 'transferred', repeat: 'repeating',
  }
  const parts = (Object.keys(labels) as GraduationDecision[])
    .map(k => ({ k, n: counts[k] ?? 0 }))
    .filter(({ n }) => n > 0)
    .map(({ k, n }) => `${n} ${labels[k]}`)
  return parts.length ? parts.join(' · ') : 'No students'
}
