import { z } from 'zod'

export const createGroupSchema = z.object({
  branch_id: z.string().uuid('Select a branch'),
  name:      z.string().min(2, 'Name must be at least 2 characters').max(100),
  type:      z.enum(['class', 'workshop', 'bootcamp', 'trial', 'makeup']),
  code:      z.string().max(50).optional().or(z.literal('')),
  capacity:  z.coerce.number().int().min(1).max(500).optional(),
})

export const updateGroupSchema = createGroupSchema.extend({
  id:     z.string().uuid(),
  status: z.enum(['forming', 'active', 'completed', 'cancelled']).optional(),
}).omit({ branch_id: true })

export const enrollStudentSchema = z.object({
  group_id:   z.string().uuid(),
  student_id: z.string().uuid('Select a student'),
})

export type CreateGroupSchema  = z.infer<typeof createGroupSchema>
export type UpdateGroupSchema  = z.infer<typeof updateGroupSchema>
export type EnrollStudentSchema = z.infer<typeof enrollStudentSchema>
