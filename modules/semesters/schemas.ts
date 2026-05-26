import { z } from 'zod'

export const createSemesterSchema = z.object({
  academic_year_id:    z.string().uuid('Select an academic year'),
  name:                z.string().min(1, 'Name is required').max(100),
  slug:                z.string().min(1, 'Slug is required').max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  status:              z.enum(['planned', 'active', 'completed', 'archived']).default('planned'),
  start_date:          z.string().min(1, 'Start date is required'),
  end_date:            z.string().min(1, 'End date is required'),
  enrollment_open_at:  z.string().optional().or(z.literal('')),
  enrollment_close_at: z.string().optional().or(z.literal('')),
  max_capacity:        z.coerce.number().int().min(1).optional(),
  notes:               z.string().max(2000).optional().or(z.literal('')),
  billing_cycle:       z.enum(['monthly', 'per_semester', 'annual', 'custom']).optional().or(z.literal('')),
})

export const updateSemesterSchema = z.object({
  id:                  z.string().uuid(),
  name:                z.string().min(1, 'Name is required').max(100),
  slug:                z.string().min(1, 'Slug is required').max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  status:              z.enum(['planned', 'active', 'completed', 'archived']).default('planned'),
  start_date:          z.string().min(1, 'Start date is required'),
  end_date:            z.string().min(1, 'End date is required'),
  enrollment_open_at:  z.string().optional().or(z.literal('')),
  enrollment_close_at: z.string().optional().or(z.literal('')),
  max_capacity:        z.coerce.number().int().min(1).optional(),
  notes:               z.string().max(2000).optional().or(z.literal('')),
  billing_cycle:       z.enum(['monthly', 'per_semester', 'annual', 'custom']).optional().or(z.literal('')),
})

export const enrollStudentSemesterSchema = z.object({
  semester_id: z.string().uuid(),
  student_id:  z.string().uuid(),
  notes:       z.string().max(500).optional().or(z.literal('')),
})

export type CreateSemesterSchema    = z.infer<typeof createSemesterSchema>
export type UpdateSemesterSchema    = z.infer<typeof updateSemesterSchema>
export type EnrollStudentSchema     = z.infer<typeof enrollStudentSemesterSchema>
