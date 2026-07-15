// Student notes — shared domain module (Student Portal + Parent Portal + staff portals).
// Table: public.student_notes (migration 0030, extended by 20260715123000_student_domain_foundation)

export type NoteVisibility =
  | 'PRIVATE_INSTRUCTOR'   // author-only (author is an instructor)
  | 'PRIVATE_TEAM_LEADER'  // author-only (author is a team leader)
  | 'INTERNAL_STAFF'       // any staff member with manage_students on the branch
  | 'SHARED'               // staff + student + parent
  | 'STUDENT_INSTRUCTION'  // staff + student only
  | 'PARENT_EVALUATION'    // staff + parent only

export const NOTE_VISIBILITIES: readonly NoteVisibility[] = [
  'PRIVATE_INSTRUCTOR', 'PRIVATE_TEAM_LEADER', 'INTERNAL_STAFF',
  'SHARED', 'STUDENT_INSTRUCTION', 'PARENT_EVALUATION',
]

// Visibility tiers readable only by their author — no other staff, student, or parent.
export const PRIVATE_VISIBILITIES: readonly NoteVisibility[] = ['PRIVATE_INSTRUCTOR', 'PRIVATE_TEAM_LEADER']

export type NoteCategory = 'GENERAL' | 'ACADEMIC' | 'BEHAVIOR' | 'PARENT_FOLLOWUP'
export type NoteSeverity = 'LOW' | 'MEDIUM' | 'HIGH'

export const NOTE_CATEGORIES: readonly NoteCategory[] = ['GENERAL', 'ACADEMIC', 'BEHAVIOR', 'PARENT_FOLLOWUP']
export const NOTE_SEVERITIES: readonly NoteSeverity[] = ['LOW', 'MEDIUM', 'HIGH']

export interface Attachment {
  url:  string
  name: string
  type: string
}

// Raw row shape (as stored)
export interface StudentNoteRecord {
  id:          string
  student_id:  string
  author_id:   string
  schedule_id: string | null
  content:     string
  category:    NoteCategory
  severity:    NoteSeverity
  visibility:  NoteVisibility
  attachments: Attachment[]
  deleted_at:  string | null
  created_at:  string
  updated_at:  string
}

// Enriched item used by portal displays (joined with author name + session context)
export interface StudentNote {
  id:             string
  content:        string
  category:       NoteCategory
  severity:       NoteSeverity
  visibility:     NoteVisibility
  schedule_id:    string | null
  schedule_topic: string | null
  created_at:     string
  updated_at:     string
  author_name:    string
  is_own:         boolean
}

export interface CreateStudentNoteInput {
  student_id:   string
  content:      string
  category?:    NoteCategory
  severity?:    NoteSeverity
  visibility?:  NoteVisibility
  schedule_id?: string | null
}

export type ViewerKind = 'staff' | 'student' | 'parent'
