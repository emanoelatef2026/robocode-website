import { z } from 'zod'

export const createAssignmentSchema = z.object({
  module_id: z.string().uuid('Module is required'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional().or(z.literal('')),
  instructions: z.string().optional().or(z.literal('')),
  type: z.enum(['homework', 'classwork', 'project', 'quiz', 'exam', 'presentation', 'challenge', 'competition']),
  submission_type: z.enum(['text', 'file', 'image', 'video_link', 'drive_link', 'github_link', 'url', 'multiple']).default('text'),
  max_score: z.coerce.number().min(0).max(10000).default(100),
  due_at: z.string().optional().or(z.literal('')),
  status: z.enum(['draft', 'published', 'closed']).default('draft'),
  allow_late: z.string().optional().transform((v) => v === 'on' || v === 'true'),
  resubmission_allowed: z.string().optional().transform((v) => v === 'on' || v === 'true'),
  max_resubmissions: z.coerce.number().int().min(1).max(10).default(1),
  portfolio_eligible: z.string().optional().transform((v) => v === 'on' || v === 'true'),
})

export const updateAssignmentSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional().or(z.literal('')),
  instructions: z.string().optional().or(z.literal('')),
  type: z.enum(['homework', 'classwork', 'project', 'quiz', 'exam', 'presentation', 'challenge', 'competition']),
  submission_type: z.enum(['text', 'file', 'image', 'video_link', 'drive_link', 'github_link', 'url', 'multiple']),
  max_score: z.coerce.number().min(0).max(10000),
  due_at: z.string().optional().or(z.literal('')),
  status: z.enum(['draft', 'published', 'closed']),
  allow_late: z.string().optional().transform((v) => v === 'on' || v === 'true'),
  resubmission_allowed: z.string().optional().transform((v) => v === 'on' || v === 'true'),
  max_resubmissions: z.coerce.number().int().min(1).max(10),
  portfolio_eligible: z.string().optional().transform((v) => v === 'on' || v === 'true'),
  rubric: z.string().optional().or(z.literal('')),
})
