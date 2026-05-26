import { z } from 'zod'

export const createStudentSchema = z.object({
  email:           z.string().email('Invalid email address'),
  first_name:      z.string().min(1, 'First name is required').max(100),
  last_name:       z.string().min(1, 'Last name is required').max(100),
  branch_id:       z.string().uuid('Select a branch'),
  student_code:    z.string().max(50).optional().or(z.literal('')),
  enrollment_date: z.string().optional().or(z.literal('')),
  notes:           z.string().max(1000).optional().or(z.literal('')),
})

export const updateStudentSchema = z.object({
  id:           z.string().uuid(),
  status:       z.enum(['active', 'inactive', 'graduated', 'paused', 'banned']).optional(),
  notes:        z.string().max(1000).optional().or(z.literal('')),
  student_code: z.string().max(50).optional().or(z.literal('')),
})

export type CreateStudentSchema = z.infer<typeof createStudentSchema>
export type UpdateStudentSchema = z.infer<typeof updateStudentSchema>
