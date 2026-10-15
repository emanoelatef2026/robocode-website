import 'server-only'
import type { createServiceClient } from '@/lib/supabase/service'
import type { AppError } from '@/types/app'

export const INACTIVE_INSTRUCTOR_MESSAGE = 'This instructor is no longer active. Select an active instructor and try again.'

export function isActiveInstructor(row: { status: string; deleted_at?: string | null }): boolean {
  return row.status === 'active' && !row.deleted_at
}

// Recheck when saving: a picker may have been opened before deactivation.
// Use only for NEW assignments, never historical payroll/attendance lookups.
export async function getInstructorAvailabilityError(
  db: ReturnType<typeof createServiceClient>,
  instructorId: string | null | undefined,
): Promise<AppError | null> {
  if (!instructorId) return null
  const { data, error } = await db.from('instructors').select('id, status, deleted_at').eq('id', instructorId).maybeSingle()
  if (error) return { code: 'DB_ERROR', message: 'Could not verify instructor availability. Please try again.' }
  if (!data || !isActiveInstructor(data)) return { code: 'INACTIVE_INSTRUCTOR', message: INACTIVE_INSTRUCTOR_MESSAGE }
  return null
}
