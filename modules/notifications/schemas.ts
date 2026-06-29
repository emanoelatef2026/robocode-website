import { z } from 'zod'

export const notificationTypeSchema = z.enum([
  'SESSION_STARTING',
  'NEW_STUDENT',
  'HOMEWORK_NEEDS_GRADING',
  'TEAM_LEADER_NOTE',
  'STUDENT_PROJECT',
  'STUDENT_VIDEO',
  'ANNOUNCEMENT',
])

export const createNotificationSchema = z.object({
  recipient_id: z.string().uuid(),
  type:         notificationTypeSchema,
  title:        z.string().min(1),
  body:         z.string().optional(),
  href:         z.string().optional(),
  dedup_key:    z.string().optional(),
})
