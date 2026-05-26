import { z } from 'zod'

export const createLessonSchema = z.object({
  module_id:        z.string().uuid(),
  title:            z.string().min(1, 'Title is required').max(200),
  type:             z.enum(['video', 'text', 'live', 'quiz', 'mixed']).default('text'),
  duration_minutes: z.coerce.number().int().min(0).optional(),
  video_url:        z.string().url('Enter a valid URL').optional().or(z.literal('')),
  video_provider:   z.enum(['youtube', 'vimeo', 'google_drive', 'other']).optional().or(z.literal('')),
})

export const updateLessonSchema = z.object({
  id:               z.string().uuid(),
  title:            z.string().min(1, 'Title is required').max(200),
  type:             z.enum(['video', 'text', 'live', 'quiz', 'mixed']).default('text'),
  duration_minutes: z.coerce.number().int().min(0).optional(),
  video_url:        z.string().url('Enter a valid URL').optional().or(z.literal('')),
  video_provider:   z.enum(['youtube', 'vimeo', 'google_drive', 'other']).optional().or(z.literal('')),
  is_published:     z.string().optional().transform((v) => v === 'true' || v === 'on'),
})

export type CreateLessonSchema = z.infer<typeof createLessonSchema>
export type UpdateLessonSchema = z.infer<typeof updateLessonSchema>
