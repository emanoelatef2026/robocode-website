export interface CourseModule {
  id: string
  course_id: string
  title: string
  description: string | null
  order_index: number
  is_published: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface CourseModuleListItem {
  id: string
  course_id: string
  title: string
  description: string | null
  order_index: number
  is_published: boolean
}
