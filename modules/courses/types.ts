export type CourseLevel = 'beginner' | 'intermediate' | 'advanced'
export type CourseScope = 'branch' | 'template' | 'global'

export interface Course {
  id: string
  branch_id: string | null
  title: string
  description: string | null
  code: string | null
  category: string | null
  level: CourseLevel | null
  estimated_hours: number | null
  thumbnail_url: string | null
  scope: CourseScope
  is_published: boolean
  created_by: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  branch_name?: string | null
  // Resource center fields
  drive_url: string | null
  curriculum_folder: string | null
  instructor_notes: string | null
  resource_links: Array<{ label: string; url: string }> | null
  // Extended resource fields
  session_plans: string | null
  teaching_guide: string | null
  expected_outcomes: string | null
  skills_covered: string | null
  prerequisites: string | null
  course_roadmap: string | null
  // Sprint 48 academic asset fields
  syllabus_url:           string | null
  curriculum_url:         string | null
  homework_drive_url:     string | null
  resources_url:          string | null
  meeting_url:            string | null
  preparation_notes:      string | null
  ai_tools_used:          string | null
  recommended_age:        string | null
  prerequisite_course_id: string | null
}

export interface CourseListItem {
  id: string
  title: string
  code: string | null
  category: string | null
  level: CourseLevel | null
  scope: CourseScope
  is_published: boolean
  branch_id: string | null
  branch_name: string | null
  estimated_hours: number | null
  created_at: string
}
