// Team leaders are users with user_roles entries (role = 'team_leader', branch_id NOT NULL).
// One user_roles row per assigned branch — so a multi-branch TL has multiple rows.
// No dedicated team_leaders table — everything lives in users + profiles + user_roles.
// Status is tracked via users.metadata->>'tl_status'.
//
// NORMALIZED MODEL (fixed in Sprint 34C):
//   listTeamLeaders() returns ONE record per unique user_id.
//   branch_ids / branch_names are arrays aggregated from all user_roles rows.
//   active_groups / active_students are TOTALS across all assigned branches.

export type TeamLeaderStatus = 'active' | 'inactive'

// ─── List item (NORMALIZED: one per user, all branches aggregated) ──────────

export interface TeamLeaderListItem {
  user_role_id:    string          // first user_roles row id (for legacy compat)
  user_id:         string
  // Multi-branch: arrays of all assigned branches
  branch_ids:      string[]
  branch_names:    string[]
  // Convenience: first branch (backward compat)
  branch_id:       string
  branch_name:     string
  email:           string
  first_name:      string | null
  last_name:       string | null
  status:          TeamLeaderStatus
  // TOTALS across all assigned branches
  active_groups:   number
  active_students: number
  tl_code:         string | null
  phone:           string | null
}

// ─── Full profile (for detail page) ─────────────────────────────────────────

export interface TeamLeaderInstructor {
  id:         string
  first_name: string | null
  last_name:  string | null
  email:      string
  status:     string
}

export interface TeamLeaderGroup {
  id:            string
  name:          string
  type:          string
  status:        string
  student_count: number
}

export interface TeamLeader {
  user_role_id:        string
  user_id:             string
  // Multi-branch: all assigned branches
  branch_ids:          string[]
  branch_names:        string[]
  // Convenience: first branch (kept for backward compatibility)
  branch_id:           string | null
  branch_name:         string | null
  email:               string
  first_name:          string | null
  last_name:           string | null
  status:              TeamLeaderStatus
  assigned_at:         string | null
  instructors:         TeamLeaderInstructor[]
  groups:              TeamLeaderGroup[]
  student_count:       number
  tl_code:             string | null
  phone:               string | null
  payment_link:        string | null
  wallet_number:       string | null
  bank_account_number: string | null
}

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateTeamLeaderInput {
  email:               string
  password:            string
  first_name:          string
  last_name:           string
  branch_ids:          string[]
  status?:             TeamLeaderStatus
  phone?:              string
  payment_link?:       string
  wallet_number?:      string
  bank_account_number?: string
}

export interface UpdateTeamLeaderInput {
  user_id:              string
  first_name?:          string
  last_name?:           string
  branch_ids?:          string[]
  status?:              TeamLeaderStatus
  new_password?:        string
  phone?:               string
  payment_link?:        string
  wallet_number?:       string
  bank_account_number?: string
}
