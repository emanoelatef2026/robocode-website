import { z } from 'zod'

export const createParentSchema = z.object({
  password:     z.string().min(6, 'Password must be at least 6 characters'),
  first_name:   z.string().min(1, 'First name is required').max(100),
  last_name:    z.string().min(1, 'Last name is required').max(100),
  phone:        z.string().max(30).optional().or(z.literal('')),
  student_id:   z.string().uuid().optional().or(z.literal('')),
  relationship: z.enum(['father', 'mother', 'guardian', 'other']).optional(),
  // Set once staff resolves an ambiguous phone match from a prior submit
  resolved_parent_id: z.string().uuid().optional().or(z.literal('')),
  force_new_parent:   z.preprocess(v => v === 'true' || v === true, z.boolean()).default(false),
})

export const linkStudentSchema = z.object({
  parent_id:    z.string().uuid(),
  student_id:   z.string().uuid('Select a student'),
  relationship: z.enum(['father', 'mother', 'guardian', 'other']),
  is_primary:   z.boolean().optional(),
})

export type CreateParentSchema = z.infer<typeof createParentSchema>
export type LinkStudentSchema  = z.infer<typeof linkStudentSchema>
