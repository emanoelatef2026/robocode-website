import { z } from 'zod'

export const createStudentSchema = z.object({
  email:           z.string().email('Invalid email address'),
  password:        z.string().min(6, 'Password must be at least 6 characters'),
  first_name:      z.string().min(1, 'First name is required').max(100),
  last_name:       z.string().min(1, 'Last name is required').max(100),
  branch_id:       z.string().uuid('Select a branch'),
  enrollment_date: z.string().optional().or(z.literal('')),
  notes:           z.string().max(1000).optional().or(z.literal('')),
  school_grade:    z.string().max(50).optional().or(z.literal('')),
  address:         z.string().max(500).optional().or(z.literal('')),
  phone:           z.string().max(30).optional().or(z.literal('')),
  date_of_birth:   z.string().optional().or(z.literal('')),
  parent_phone_1:  z.string().max(30).optional().or(z.literal('')),
  parent_phone_2:  z.string().max(30).optional().or(z.literal('')),
  group_id:        z.string().uuid().optional().or(z.literal('')),
})

export const updateStudentSchema = z.object({
  id:              z.string().uuid(),
  status:          z.enum(['active', 'inactive', 'graduated', 'paused', 'banned']).optional(),
  notes:           z.string().max(1000).optional().or(z.literal('')),
  school_grade:    z.string().max(50).optional().or(z.literal('')),
  address:         z.string().max(500).optional().or(z.literal('')),
  phone:           z.string().max(30).optional().or(z.literal('')),
  date_of_birth:   z.string().optional().or(z.literal('')),
  parent_phone_1:  z.string().max(30).optional().or(z.literal('')),
  parent_phone_2:  z.string().max(30).optional().or(z.literal('')),
})

export type CreateStudentSchema = z.infer<typeof createStudentSchema>
export type UpdateStudentSchema = z.infer<typeof updateStudentSchema>
