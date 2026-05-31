export interface SessionFeedback {
  id:           string
  schedule_id:  string
  student_id:   string
  q1_score:     number
  q2_score:     number
  q3_score:     number
  comment:      string | null
  submitted_at: string
}

export interface SessionFeedbackAggregate {
  schedule_id:    string
  total_responses: number
  avg_overall:    number
  avg_q1:         number
  avg_q2:         number
  avg_q3:         number
}

export interface InstructorRatingSummary {
  instructor_id:   string
  total_responses: number
  avg_overall:     number
  avg_q1:          number
  avg_q2:          number
  avg_q3:          number
}

// The three questions shown to students
export const FEEDBACK_QUESTIONS = [
  {
    key:     'q1',
    arabic:  'هل فهمت كل محتوى الحصة النهاردة؟',
    english: 'Did you understand all today\'s lesson content?',
  },
  {
    key:     'q2',
    arabic:  'هل المدرس جاوب على كل أسئلتك أثناء الحصة؟',
    english: 'Did the instructor answer all your questions during the session?',
  },
  {
    key:     'q3',
    arabic:  'هل المدرب بيشرح بطريقة سهلة وواضحة؟',
    english: 'Does the instructor explain in a simple and clear way?',
  },
] as const
