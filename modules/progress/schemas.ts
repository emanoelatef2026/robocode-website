import { z } from 'zod'

export const certificateThresholdsSchema = z.object({
  min_attendance: z.number().min(0).max(100).default(75),
  min_assignment: z.number().min(0).max(100).default(60),
  min_overall:    z.number().min(0).max(100).default(70),
})

export const calculateProgressParamsSchema = z.object({
  student_id:  z.string().uuid(),
  course_id:   z.string().uuid(),
  semester_id: z.string().uuid(),
  group_id:    z.string().uuid(),
})
