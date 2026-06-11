import { z } from 'zod'

// Courses are global assets — branch_id is legacy and no longer used in validation.

/**
 * Safely coerce any FormData is_published value → boolean.
 * Handles: checkbox 'on', string 'true', boolean true, null, undefined → false.
 */
const boolField = z.preprocess(
  (v) => v === 'on' || v === 'true' || v === true,
  z.boolean()
)

/** Optional URL: accepts a valid URL or empty string (maps to null in actions). */
const optUrl = z.string().url('Enter a valid URL').optional().or(z.literal(''))

export const createCourseSchema = z.object({
  title:           z.string().min(1, 'Title is required').max(200),
  description:     z.string().max(2000).optional().or(z.literal('')),
  thumbnail_url:   optUrl,
  resources_url:   optUrl,
  category:        z.string().max(100).optional().or(z.literal('')),
  level:           z.enum(['beginner', 'intermediate', 'advanced']).optional().or(z.literal('')),
  estimated_hours: z.coerce.number().int().min(0).optional(),
  scope:           z.enum(['branch', 'template', 'global']).default('global'),
  is_published:    boolField,
})

export const updateCourseSchema = z.object({
  id:              z.string().uuid(),
  title:           z.string().min(1, 'Title is required').max(200),
  description:     z.string().max(2000).optional().or(z.literal('')),
  thumbnail_url:   optUrl,
  resources_url:   optUrl,
  category:        z.string().max(100).optional().or(z.literal('')),
  level:           z.enum(['beginner', 'intermediate', 'advanced']).optional().or(z.literal('')),
  estimated_hours: z.coerce.number().int().min(0).optional(),
  scope:           z.enum(['branch', 'template', 'global']).default('global'),
  is_published:    boolField,
})

export type CreateCourseSchema = z.infer<typeof createCourseSchema>
export type UpdateCourseSchema = z.infer<typeof updateCourseSchema>
