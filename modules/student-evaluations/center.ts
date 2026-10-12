export type EvaluationSource = 'session' | 'assignment' | 'video' | 'project'

export const SESSION_CRITERIA = [
  { key: 'PROGRAMMING', label: 'Coding & Building' },
  { key: 'PROBLEM_SOLVING', label: 'Problem Solving' },
  { key: 'CREATIVITY', label: 'Creativity' },
  { key: 'TEAMWORK', label: 'Participation & Teamwork' },
] as const

export interface CenterEvaluation {
  id: string
  student_id: string
  criterion: string
  score: number | null
  rating: number | null
  feedback: string | null
  next_goal: string | null
  visible_to_student: boolean
  visible_to_parent: boolean
  published_at: string | null
  schedule_id: string | null
  source_type: string | null
  source_id: string | null
  updated_at: string
}

export interface CenterItem {
  id: string
  student_id: string
  title: string
  subtitle: string
  url: string | null
  score?: number | null
  max_score?: number | null
}

export interface GroupEvaluationData {
  group_id: string
  group_name: string
  students: { id: string; name: string }[]
  sessions: { id: string; title: string; scheduled_at: string; status: string }[]
  assignments: CenterItem[]
  videos: CenterItem[]
  projects: CenterItem[]
  evaluations: CenterEvaluation[]
}
