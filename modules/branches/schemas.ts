import { z } from 'zod'

export const createBranchSchema = z.object({
  name:     z.string().min(2, 'Name must be at least 2 characters').max(100),
  type:     z.enum(['online', 'offline', 'hybrid']),
  phone:    z.string().max(30).optional().or(z.literal('')),
  location: z.string().max(200).optional().or(z.literal('')),
  timezone: z.string().max(60).optional().or(z.literal('')),
})

export const updateBranchSchema = createBranchSchema.extend({
  id:        z.string().uuid(),
  is_active: z.boolean().optional(),
})

export type CreateBranchSchema = z.infer<typeof createBranchSchema>
export type UpdateBranchSchema = z.infer<typeof updateBranchSchema>
