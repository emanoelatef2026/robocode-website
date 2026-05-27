import { z } from 'zod'

// ─── Portfolio ─────────────────────────────────────────────────────────────────

export const UpdatePortfolioSchema = z.object({
  bio:       z.string().max(1000).optional(),
  is_public: z.boolean().optional(),
})

// ─── Project ───────────────────────────────────────────────────────────────────

export const CreateProjectSchema = z.object({
  portfolio_id:        z.string().uuid(),
  student_id:          z.string().uuid(),
  title:               z.string().min(1).max(200),
  description:         z.string().max(2000).optional(),
  thumbnail_url:       z.string().url().optional().or(z.literal('')),
  github_url:          z.string().url().optional().or(z.literal('')),
  drive_url:           z.string().url().optional().or(z.literal('')),
  video_url:           z.string().url().optional().or(z.literal('')),
  project_url:         z.string().url().optional().or(z.literal('')),
  instructor_feedback: z.string().max(2000).optional(),
  final_score:         z.number().min(0).max(100).optional().nullable(),
  semester_id:         z.string().uuid().optional().nullable(),
  course_id:           z.string().uuid().optional().nullable(),
  is_featured:         z.boolean().optional(),
  is_public:           z.boolean().optional(),
  sort_order:          z.number().int().min(0).optional(),
})

export const UpdateProjectSchema = CreateProjectSchema.omit({ portfolio_id: true, student_id: true }).partial()

export const PromoteSubmissionSchema = z.object({
  student_id:    z.string().uuid(),
  submission_id: z.string().uuid(),
  title:         z.string().min(1).max(200),
  description:   z.string().max(2000).optional(),
  is_featured:   z.boolean().optional(),
  is_public:     z.boolean().optional(),
})

export const ReorderProjectsSchema = z.object({
  // Array of { id, sort_order }
  items: z.array(z.object({
    id:         z.string().uuid(),
    sort_order: z.number().int().min(0),
  })),
})

// ─── Achievement ───────────────────────────────────────────────────────────────

export const CreateAchievementSchema = z.object({
  student_id:       z.string().uuid(),
  portfolio_id:     z.string().uuid().optional().nullable(),
  title:            z.string().min(1).max(200),
  description:      z.string().max(1000).optional(),
  achievement_type: z.enum(['project', 'competition', 'certificate', 'leadership', 'attendance', 'innovation', 'custom']),
  date_awarded:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  image_url:        z.string().url().optional().or(z.literal('')),
  sort_order:       z.number().int().min(0).optional(),
})

export const UpdateAchievementSchema = CreateAchievementSchema.omit({ student_id: true }).partial()

// ─── Badge ─────────────────────────────────────────────────────────────────────

export const CreateBadgeSchema = z.object({
  student_id:   z.string().uuid(),
  portfolio_id: z.string().uuid().optional().nullable(),
  badge_name:   z.string().min(1).max(100),
  badge_image:  z.string().url().optional().or(z.literal('')),
  description:  z.string().max(500).optional(),
  awarded_at:   z.string().datetime().optional(),
})

export type UpdatePortfolioInput    = z.infer<typeof UpdatePortfolioSchema>
export type CreateProjectInput      = z.infer<typeof CreateProjectSchema>
export type UpdateProjectInput      = z.infer<typeof UpdateProjectSchema>
export type PromoteSubmissionInput  = z.infer<typeof PromoteSubmissionSchema>
export type ReorderProjectsInput    = z.infer<typeof ReorderProjectsSchema>
export type CreateAchievementInput  = z.infer<typeof CreateAchievementSchema>
export type UpdateAchievementInput  = z.infer<typeof UpdateAchievementSchema>
export type CreateBadgeInput        = z.infer<typeof CreateBadgeSchema>
