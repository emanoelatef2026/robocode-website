import { z } from 'zod'
import { EVALUATION_CRITERIA } from './types'

const criterionEnum = z.enum(EVALUATION_CRITERIA as [string, ...string[]])

export const createEvaluationSchema = z
  .object({
    student_id:         z.string().uuid(),
    enrollment_id:       z.string().uuid().nullable().optional(),
    course_id:           z.string().uuid().nullable().optional(),
    branch_id:           z.string().uuid(),
    criterion:           criterionEnum,
    custom_label:        z.string().min(1).nullable().optional(),
    score:               z.number().min(0).max(100).nullable().optional(),
    rating:              z.number().int().min(1).max(5).nullable().optional(),
    feedback:            z.string().nullable().optional(),
    visible_to_student:  z.boolean().optional().default(true),
    visible_to_parent:   z.boolean().optional().default(true),
    evaluated_at:        z.string().optional(),
  })
  .refine((d) => d.criterion !== 'CUSTOM' || !!d.custom_label, {
    message: 'custom_label is required when criterion is CUSTOM',
    path: ['custom_label'],
  })
  .refine((d) => d.score != null || d.rating != null, {
    message: 'At least one of score or rating is required',
    path: ['score'],
  })

export const updateEvaluationSchema = z.object({
  evaluation_id:      z.string().uuid(),
  score:              z.number().min(0).max(100).nullable().optional(),
  rating:             z.number().int().min(1).max(5).nullable().optional(),
  feedback:           z.string().nullable().optional(),
  visible_to_student: z.boolean().optional(),
  visible_to_parent:  z.boolean().optional(),
})
