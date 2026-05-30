import { z } from 'zod'

// Courses are global assets — branch_id is legacy and no longer used in validation.
export const createCourseSchema = z.object({
  title:           z.string().min(1, 'Title is required').max(200),
  description:     z.string().max(2000).optional().or(z.literal('')),
  category:        z.string().max(100).optional().or(z.literal('')),
  level:           z.enum(['beginner', 'intermediate', 'advanced']).optional().or(z.literal('')),
  estimated_hours: z.coerce.number().int().min(0).optional(),
  scope:           z.enum(['branch', 'template', 'global']).default('global'),
  is_published:    z.string().optional().transform((v) => v === 'true' || v === 'on'),
})

export const updateCourseSchema = z.object({
  id:              z.string().uuid(),
  title:           z.string().min(1, 'Title is required').max(200),
  description:     z.string().max(2000).optional().or(z.literal('')),
  category:        z.string().max(100).optional().or(z.literal('')),
  level:           z.enum(['beginner', 'intermediate', 'advanced']).optional().or(z.literal('')),
  estimated_hours: z.coerce.number().int().min(0).optional(),
  scope:           z.enum(['branch', 'template', 'global']).default('global'),
  is_published:    z.string().optional().transform((v) => v === 'true' || v === 'on'),
})

export type CreateCourseSchema = z.infer<typeof createCourseSchema>
export type UpdateCourseSchema = z.infer<typeof updateCourseSchema>
