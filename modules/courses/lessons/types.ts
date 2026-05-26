export type LessonType = 'video' | 'text' | 'live' | 'quiz' | 'mixed'
export type VideoProvider = 'youtube' | 'vimeo' | 'google_drive' | 'other'

export interface Lesson {
  id: string
  module_id: string
  title: string
  content: Record<string, unknown> | null
  type: LessonType
  duration_minutes: number | null
  order_index: number
  video_url: string | null
  video_provider: VideoProvider | null
  video_id: string | null
  is_published: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface LessonListItem {
  id: string
  module_id: string
  title: string
  type: LessonType
  order_index: number
  duration_minutes: number | null
  is_published: boolean
  video_url: string | null
}
