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
