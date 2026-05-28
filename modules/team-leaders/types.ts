// Team leaders are users with a user_roles entry (role = 'team_leader', branch_id NOT NULL).
// No dedicated team_leaders table — everything lives in users + profiles + user_roles.
// Status is tracked via users.metadata->>'tl_status'.

export type TeamLeaderStatus = 'active' | 'inactive'

// ─── List item ───────────────────────────────────────────────────────────────

export interface TeamLeaderListItem {
  user_role_id:    string   // user_roles.id (used as stable identifier)
  user_id:         string
  branch_id:       string
  email:           string
  first_name:      string | null
  last_name:       string | null
  branch_name:     string
  status:          TeamLeaderStatus
  active_groups:   number
  active_students: number
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
  user_role_id: string
  user_id:      string
  branch_id:    string | null   // null when deactivated (metadata-based)
  email:        string
  first_name:   string | null
  last_name:    string | null
  branch_name:  string | null
  status:       TeamLeaderStatus
  assigned_at:  string | null
  instructors:  TeamLeaderInstructor[]
  groups:       TeamLeaderGroup[]
  student_count: number
}

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateTeamLeaderInput {
  email:       string
  password:    string
  first_name:  string
  last_name:   string
  branch_id:   string
  status?:     TeamLeaderStatus
}

export interface UpdateTeamLeaderInput {
  user_id:      string
  first_name?:  string
  last_name?:   string
  branch_id?:   string
  status?:      TeamLeaderStatus
  new_password?: string
}
