import { z } from 'zod'

export const recordAttendanceSchema = z.object({
  group_id:         z.string().uuid('Select a group'),
  branch_id:        z.string().uuid(),
  session_date:     z.string().min(1, 'Session date is required'),
  duration_minutes: z.coerce.number().int().min(15).max(480).default(60),
  delivery:         z.enum(['online', 'offline', 'hybrid']).default('offline'),
})

export type RecordAttendanceSchema = z.infer<typeof recordAttendanceSchema>
