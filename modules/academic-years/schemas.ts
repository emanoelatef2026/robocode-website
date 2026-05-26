import { z } from 'zod'

export const createAcademicYearSchema = z.object({
  name:       z.string().min(1, 'Name is required').max(50),
  start_date: z.string().min(1, 'Start date is required'),
  end_date:   z.string().min(1, 'End date is required'),
  is_current: z.string().optional().transform((v) => v === 'true' || v === 'on'),
})

export const updateAcademicYearSchema = z.object({
  id:         z.string().uuid(),
  name:       z.string().min(1, 'Name is required').max(50),
  start_date: z.string().min(1, 'Start date is required'),
  end_date:   z.string().min(1, 'End date is required'),
  is_current: z.string().optional().transform((v) => v === 'true' || v === 'on'),
})

export type CreateAcademicYearSchema = z.infer<typeof createAcademicYearSchema>
export type UpdateAcademicYearSchema = z.infer<typeof updateAcademicYearSchema>
