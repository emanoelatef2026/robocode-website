import type { GroupStatus } from '@/types/enums'

// `active` is the only Running state instructors can teach. All other cohort
// states remain available to operations, but not to instructor-facing surfaces.
export const INSTRUCTOR_VISIBLE_GROUP_STATUSES = ['active'] as const satisfies readonly GroupStatus[]

export function isGroupVisibleToInstructor(status: GroupStatus | string): boolean {
  return (INSTRUCTOR_VISIBLE_GROUP_STATUSES as readonly string[]).includes(status)
}
