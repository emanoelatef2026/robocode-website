import { z } from 'zod'

export const createParentSchema = z.object({
  email:        z.string().email('Invalid email address'),
  first_name:   z.string().min(1, 'First name is required').max(100),
  last_name:    z.string().min(1, 'Last name is required').max(100),
  student_id:   z.string().uuid().optional().or(z.literal('')),
  relationship: z.enum(['father', 'mother', 'guardian', 'other']).optional(),
})

export const linkStudentSchema = z.object({
  parent_id:    z.string().uuid(),
  student_id:   z.string().uuid('Select a student'),
  relationship: z.enum(['father', 'mother', 'guardian', 'other']),
  is_primary:   z.boolean().optional(),
})

export type CreateParentSchema = z.infer<typeof createParentSchema>
export type LinkStudentSchema  = z.infer<typeof linkStudentSchema>
