import { z } from 'zod'

export const DAYS = [
  'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday',
] as const

export const GROUP_TYPES    = ['class', 'workshop', 'bootcamp', 'trial', 'makeup'] as const
export const GROUP_STATUSES = ['forming', 'active', 'completed', 'cancelled'] as const

const emptyStr = z.literal('')

const baseFields = {
  branch_id:           z.string().uuid('Select a branch'),
  name:                z.string().min(2, 'Name must be at least 2 characters').max(100),
  type:                z.enum(GROUP_TYPES),
  capacity:            z.coerce.number().int().min(1).max(500).optional().or(emptyStr).transform(v => v === '' ? undefined : v as number | undefined),
  day_of_week:         z.enum(DAYS).optional().or(emptyStr).transform(v => v === '' ? undefined : v as typeof DAYS[number] | undefined),
  start_time:          z.string().regex(/^\d{2}:\d{2}$/).optional().or(emptyStr).transform(v => v === '' ? undefined : v as string | undefined),
  duration_minutes:    z.coerce.number().int().min(15).max(480).optional().or(emptyStr).transform(v => v === '' ? undefined : v as number | undefined),
  start_date:          z.string().optional().or(emptyStr).transform(v => v === '' ? undefined : v as string | undefined),
  end_date:            z.string().optional().or(emptyStr).transform(v => v === '' ? undefined : v as string | undefined),
  meeting_link:        z.string().max(500).optional().or(emptyStr).transform(v => v === '' ? undefined : v as string | undefined),
  notes:               z.string().max(2000).optional().or(emptyStr).transform(v => v === '' ? undefined : v as string | undefined),
  course_id:           z.string().uuid().optional().or(emptyStr).transform(v => v === '' ? undefined : v as string | undefined),
  instructor_id:       z.string().uuid().optional().or(emptyStr).transform(v => v === '' ? undefined : v as string | undefined),
  asst_instructor_id:  z.string().uuid().optional().or(emptyStr).transform(v => v === '' ? undefined : v as string | undefined),
  students_to_add_json:    z.string().optional(),
  students_to_remove_json: z.string().optional(),
  // Academic plan — stored on group_courses, not groups
  planned_sessions: z.coerce.number().int().positive().max(9999).optional().or(emptyStr).transform(v => v === '' ? undefined : v as number | undefined),
  open_ended:       z.string().optional().transform(v => v === 'true' || v === 'on'),
}

export const createSchema = z.object(baseFields)

export const updateSchema = z.object({
  id:     z.string().uuid(),
  status: z.enum(GROUP_STATUSES).optional(),
  ...baseFields,
})

export type CreateGroupInput = z.infer<typeof createSchema>
export type UpdateGroupInput = z.infer<typeof updateSchema>

// The "rest" after stripping course/instructor/student/academic-plan fields
export type GroupCoreInput = Omit<
  CreateGroupInput,
  'course_id' | 'instructor_id' | 'asst_instructor_id' | 'students_to_add_json' | 'students_to_remove_json' | 'planned_sessions' | 'open_ended'
>

export type GroupUpdateCore = Omit<
  UpdateGroupInput,
  'id' | 'course_id' | 'instructor_id' | 'asst_instructor_id' | 'students_to_add_json' | 'students_to_remove_json' | 'planned_sessions' | 'open_ended'
>
