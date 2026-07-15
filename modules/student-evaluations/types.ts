// Student evaluations — structured, criterion-based staff evaluations of a student.
// Table: public.student_evaluations (migration 20260715123000_student_domain_foundation)

export type EvaluationCriterion =
  | 'ACADEMIC_SKILLS'
  | 'PROGRAMMING'
  | 'ROBOTICS'
  | 'PROBLEM_SOLVING'
  | 'LOGIC'
  | 'CREATIVITY'
  | 'CLASSROOM_BEHAVIOR'
  | 'PARTICIPATION'
  | 'HOMEWORK'
  | 'ATTENDANCE_QUALITY'
  | 'COMMUNICATION'
  | 'LEADERSHIP'
  | 'TEAMWORK'
  | 'CUSTOM'

export const EVALUATION_CRITERIA: readonly EvaluationCriterion[] = [
  'ACADEMIC_SKILLS', 'PROGRAMMING', 'ROBOTICS', 'PROBLEM_SOLVING', 'LOGIC', 'CREATIVITY',
  'CLASSROOM_BEHAVIOR', 'PARTICIPATION', 'HOMEWORK', 'ATTENDANCE_QUALITY', 'COMMUNICATION',
  'LEADERSHIP', 'TEAMWORK', 'CUSTOM',
]

export const EVALUATION_CRITERION_LABELS: Record<EvaluationCriterion, string> = {
  ACADEMIC_SKILLS:    'Academic Skills',
  PROGRAMMING:        'Programming',
  ROBOTICS:           'Robotics',
  PROBLEM_SOLVING:    'Problem Solving',
  LOGIC:              'Logic',
  CREATIVITY:         'Creativity',
  CLASSROOM_BEHAVIOR: 'Classroom Behavior',
  PARTICIPATION:      'Participation',
  HOMEWORK:           'Homework',
  ATTENDANCE_QUALITY: 'Attendance Quality',
  COMMUNICATION:      'Communication',
  LEADERSHIP:         'Leadership',
  TEAMWORK:           'Teamwork',
  CUSTOM:             'Custom',
}

export interface StudentEvaluation {
  id:                 string
  student_id:         string
  enrollment_id:      string | null
  course_id:          string | null
  branch_id:          string
  criterion:          EvaluationCriterion
  custom_label:       string | null
  score:              number | null
  rating:             number | null
  feedback:           string | null
  author_id:          string
  visible_to_student: boolean
  visible_to_parent:  boolean
  evaluated_at:       string
  created_at:         string
  updated_at:         string
}

export interface CreateStudentEvaluationInput {
  student_id:          string
  enrollment_id?:      string | null
  course_id?:          string | null
  branch_id:           string
  criterion:           EvaluationCriterion
  custom_label?:       string | null
  score?:              number | null
  rating?:             number | null
  feedback?:           string | null
  visible_to_student?: boolean
  visible_to_parent?:  boolean
  evaluated_at?:       string
}

export interface UpdateStudentEvaluationInput {
  score?:              number | null
  rating?:             number | null
  feedback?:           string | null
  visible_to_student?: boolean
  visible_to_parent?:  boolean
}
