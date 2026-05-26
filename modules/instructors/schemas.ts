import { z } from 'zod'

export const createInstructorSchema = z.object({
  email:       z.string().email('Invalid email address'),
  first_name:  z.string().min(1, 'First name is required').max(100),
  last_name:   z.string().min(1, 'Last name is required').max(100),
  branch_id:   z.string().uuid('Select a branch'),
  employee_id: z.string().max(50).optional().or(z.literal('')),
  hire_date:   z.string().optional().or(z.literal('')),
  specializations: z.string().optional().or(z.literal('')), // comma-separated
})

export const updateInstructorSchema = z.object({
  id:          z.string().uuid(),
  status:      z.enum(['active', 'inactive', 'on_leave']).optional(),
  employee_id: z.string().max(50).optional().or(z.literal('')),
  specializations: z.string().optional().or(z.literal('')),
})

export type CreateInstructorSchema = z.infer<typeof createInstructorSchema>
export type UpdateInstructorSchema = z.infer<typeof updateInstructorSchema>
