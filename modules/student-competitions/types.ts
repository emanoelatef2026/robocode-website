// Student competition history — table: public.student_competitions
// (migration 20260715123000_student_domain_foundation)

export interface StudentCompetition {
  id:                  string
  student_id:          string
  competition_name:    string
  season:              string | null
  year:                number
  role:                string | null
  team_name:           string | null
  coach_instructor_id: string | null
  branch_id:           string | null
  project_id:          string | null
  rank:                string | null
  award:               string | null
  certificate_id:      string | null
  notes:               string | null
  media:               unknown[]
  achievement_id:      string | null
  created_by:          string
  created_at:          string
  updated_at:          string
}

export interface CreateStudentCompetitionInput {
  student_id:          string
  competition_name:    string
  season?:             string | null
  year:                number
  role?:               string | null
  team_name?:          string | null
  coach_instructor_id?: string | null
  branch_id?:          string | null
  project_id?:         string | null
  rank?:               string | null
  award?:              string | null
  certificate_id?:     string | null
  notes?:              string | null
}

export interface UpdateStudentCompetitionInput {
  rank?:   string | null
  award?:  string | null
  notes?:  string | null
}
