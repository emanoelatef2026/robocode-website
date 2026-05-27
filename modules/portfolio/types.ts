import type { AchievementType } from '@/types/enums'

export interface StudentPortfolio {
  id: string
  student_id: string
  bio: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface PortfolioProject {
  id: string
  portfolio_id: string
  student_id: string
  submission_id: string | null
  semester_id: string | null
  course_id: string | null
  title: string
  description: string | null
  thumbnail_url: string | null
  gallery_images: string[]
  github_url: string | null
  drive_url: string | null
  video_url: string | null
  project_url: string | null
  instructor_feedback: string | null
  final_score: number | null
  is_featured: boolean
  is_public: boolean
  is_archived: boolean
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined
  course_title: string | null
  semester_name: string | null
}

export interface PortfolioProjectListItem {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  is_featured: boolean
  is_public: boolean
  is_archived: boolean
  sort_order: number
  course_title: string | null
  semester_name: string | null
  final_score: number | null
  created_at: string
}

export interface StudentAchievement {
  id: string
  student_id: string
  portfolio_id: string | null
  title: string
  description: string | null
  achievement_type: AchievementType
  date_awarded: string
  image_url: string | null
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface StudentBadge {
  id: string
  student_id: string
  portfolio_id: string | null
  badge_name: string
  badge_image: string | null
  description: string | null
  awarded_at: string
  created_by: string | null
  created_at: string
}

export interface StudentPortfolioDetail {
  portfolio: StudentPortfolio
  projects: PortfolioProjectListItem[]
  achievements: StudentAchievement[]
  badges: StudentBadge[]
  // Student context
  student_id: string
  student_name: string
  student_email: string
}

export interface PortfolioStudentSummary {
  student_id: string
  student_name: string
  student_email: string
  branch_name: string
  portfolio_id: string | null
  project_count: number
  featured_count: number
  achievement_count: number
  badge_count: number
}

// Eligible submission that can be promoted to a portfolio project
export interface PromotableSubmission {
  id: string
  assignment_title: string
  assignment_type: string
  course_title: string | null
  submitted_at: string
  final_score: number | null
  public_feedback: string | null
  drive_url: string | null
  github_url: string | null
  project_url: string | null
  video_url: string | null
  // Whether it has already been promoted
  already_promoted: boolean
}
