export type QuickFilter =
  | '' | 'active' | 'forming' | 'no_instructor'
  | 'low_attendance' | 'low_capacity' | 'overloaded' | 'starts_soon' | 'archived'

export interface Filters {
  q:           string
  branch_id:   string
  quickFilter: QuickFilter
}

export const DEFAULT_FILTERS: Filters = { q: '', branch_id: '', quickFilter: '' }

export type WorkspaceTab = 'students' | 'attendance' | 'finance' | 'performance'
