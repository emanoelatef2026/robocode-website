import { z } from 'zod'

export const createScheduleSchema = z.object({
  group_course_id:  z.string().uuid('Invalid group-course'),
  branch_id:        z.string().uuid('Invalid branch'),
  scheduled_at:     z.string().min(1, 'Scheduled date is required'),
  duration_minutes: z.coerce.number().int().min(15).max(480),
  type:             z.enum(['regular', 'makeup', 'exam', 'event']).default('regular'),
  delivery:         z.enum(['online', 'offline', 'hybrid']).optional().nullable(),
  meeting_url:      z.string().url().optional().nullable().or(z.literal('')),
  room:             z.string().max(100).optional().nullable(),
  topic:            z.string()
    .min(1, 'Topic is required for this session')
    .max(500)
    .refine(t => t.trim().length > 0, { message: 'Topic cannot be blank' })
    .refine(t => t.trim().toLowerCase() !== 'no topic', { message: '"No topic" is not a valid topic' }),
})

export const updateScheduleSchema = z.object({
  id:                   z.string().uuid(),
  scheduled_at:         z.string().optional(),
  duration_minutes:     z.coerce.number().int().min(15).max(480).optional(),
  type:                 z.enum(['regular', 'makeup', 'exam', 'event']).optional(),
  delivery:             z.enum(['online', 'offline', 'hybrid']).optional().nullable(),
  meeting_url:          z.string().url().optional().nullable().or(z.literal('')),
  room:                 z.string().max(100).optional().nullable(),
  status:               z.enum(['scheduled', 'ongoing', 'completed', 'cancelled']).optional(),
  cancellation_reason:  z.string().max(500).optional().nullable(),
  topic:                z.string().max(500).optional().nullable(),
  notes:                z.string().max(2000).optional().nullable(),
})
