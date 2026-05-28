// Student notes — instructor observations per student
// Table: public.student_notes (migration 0030)

export interface StudentNote {
  id:          string
  student_id:  string
  author_id:   string
  schedule_id: string | null   // optional: the session this note refers to
  content:     string
  is_private:  boolean         // true = author only; false = also visible to team leaders
  created_at:  string
  updated_at:  string
}

// Enriched list item (joined with author, student, and session context)
export interface StudentNoteListItem extends StudentNote {
  author_email:        string
  author_first_name:   string | null
  author_last_name:    string | null
  student_email:       string
  student_first_name:  string | null
  student_last_name:   string | null
  session_topic:       string | null   // schedules.topic
  session_date:        string | null   // schedules.scheduled_at
}

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateStudentNoteInput {
  student_id:  string
  schedule_id?: string | null
  content:     string
  is_private?: boolean          // defaults to true
}

export interface UpdateStudentNoteInput {
  content?:    string
  is_private?: boolean
}
