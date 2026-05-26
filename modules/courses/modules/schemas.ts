import { z } from 'zod'

export const createModuleSchema = z.object({
  course_id:   z.string().uuid(),
  title:       z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional().or(z.literal('')),
})

export const updateModuleSchema = z.object({
  id:          z.string().uuid(),
  title:       z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional().or(z.literal('')),
  is_published: z.string().optional().transform((v) => v === 'true' || v === 'on'),
})

export type CreateModuleSchema = z.infer<typeof createModuleSchema>
export type UpdateModuleSchema = z.infer<typeof updateModuleSchema>
