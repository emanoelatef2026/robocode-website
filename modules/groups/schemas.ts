import { z } from 'zod'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const

export const createGroupSchema = z.object({
  branch_id:    z.string().uuid('Select a branch'),
  name:         z.string().min(2, 'Name must be at least 2 characters').max(100),
  type:         z.enum(['class', 'workshop', 'bootcamp', 'trial', 'makeup']),
  capacity:     z.coerce.number().int().min(1).max(500).optional(),
  start_date:   z.string().optional().or(z.literal('')),
  day_of_week:  z.enum(DAYS).optional().or(z.literal('')),
  time:         z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format').optional().or(z.literal('')),
  notes:        z.string().max(2000).optional().or(z.literal('')),
  instructor_id: z.string().uuid().optional().or(z.literal('')),
  robocode_share_percent: z.coerce.number().min(0, 'Share % must be 0–100').max(100, 'Share % must be 0–100').optional(),
})

export const updateGroupSchema = createGroupSchema.extend({
  id:     z.string().uuid(),
  status: z.enum(['forming', 'active', 'completed', 'cancelled']).optional(),
}).omit({ branch_id: true, instructor_id: true })

export const enrollStudentSchema = z.object({
  group_id:        z.string().uuid(),
  student_id:      z.string().uuid('Select a student'),
  enrollment_type: z.enum(['primary', 'secondary']).default('primary'),
})

export type CreateGroupSchema   = z.infer<typeof createGroupSchema>
export type UpdateGroupSchema   = z.infer<typeof updateGroupSchema>
export type EnrollStudentSchema = z.infer<typeof enrollStudentSchema>
