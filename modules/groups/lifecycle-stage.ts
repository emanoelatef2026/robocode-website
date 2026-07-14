// Pure, universally-importable (client + server) derivation of the 5
// business-facing Cohort lifecycle stages from the existing `groups.status`
// value — no new DB enum values, see docs/DOMAIN_RULES.md Rule 11 and the
// Phase 1 plan. Deliberately does NOT import 'server-only': it's rendered
// from client components (status badges, filters) as well as server code.
import type { GroupStatus } from '@/types/enums'

export type CohortLifecycleStage = 'draft' | 'open' | 'running' | 'completed' | 'archived'

export interface CohortLifecycleInput {
  status:       GroupStatus | string
  has_course?:  boolean
  has_instructor?: boolean
}

// Draft/Open are sub-labels of the DB's 'forming' status, distinguished by
// whether the cohort is enrollment-ready (course + instructor configured) —
// the same readiness signal computeGroupReadiness() computes server-side.
// Running/Completed/Archived map 1:1 onto existing status values.
//
// 'cancelled' is intentionally NOT one of the 5 stages (DOMAIN_RULES.md Rule
// 2/11 — a mistaken/aborted cohort, unrelated to the lifecycle progression).
// Callers must check `status === 'cancelled'` themselves and render that
// badge directly instead of calling this function; if it's called anyway
// (defensive fallback, should not happen in practice) it degrades to 'draft'.
export function getCohortLifecycleStage(group: CohortLifecycleInput): CohortLifecycleStage {
  switch (group.status) {
    case 'archived':  return 'archived'
    case 'completed': return 'completed'
    case 'active':
    case 'handoff_pending':
      return 'running'
    case 'forming':
      return (group.has_course && group.has_instructor) ? 'open' : 'draft'
    default:
      return 'draft'
  }
}

export const COHORT_LIFECYCLE_STAGE_LABELS: Record<CohortLifecycleStage, string> = {
  draft:     'Draft',
  open:      'Open',
  running:   'Running',
  completed: 'Completed',
  archived:  'Archived',
}
