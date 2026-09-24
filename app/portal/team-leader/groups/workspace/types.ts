// Phase 1: lifecycle-stage filters (draft/open/running/completed/archived)
// replace the old ad-hoc 'active'/'forming'/'archived' values, which either
// missed handoff_pending groups ('active') or conflated the unrelated
// 'cancelled' concept with 'archived' (DOMAIN_RULES.md Rule 2/11) — 'cancelled'
// is now its own distinct filter instead of being folded into 'archived'.
export type QuickFilter =
  | '' | 'draft' | 'open' | 'running' | 'completed' | 'archived' | 'cancelled'
  | 'no_instructor' | 'low_attendance' | 'low_capacity' | 'overloaded' | 'starts_soon'

export interface Filters {
  q:           string
  branch_id:   string
  instructor_id: string
  quickFilter: QuickFilter
  day_of_week: string
}

// The operational view opens on live teaching by default. Other lifecycle
// stages remain available from the status filter when they are needed.
export const DEFAULT_FILTERS: Filters = { q: '', branch_id: '', instructor_id: '', quickFilter: 'running', day_of_week: '' }

export type WorkspaceTab = 'students' | 'attendance' | 'finance' | 'performance'
