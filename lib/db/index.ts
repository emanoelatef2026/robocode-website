// Shared database query helpers

export { fromPostgrestError, DatabaseError, NotFoundError, ForbiddenError } from './errors'

// Standard select fields for profile joins
export const PROFILE_SELECT = 'profiles(first_name, last_name, display_name, avatar_url)' as const

// Soft-delete filter helper (used in .is('deleted_at', null))
export const ACTIVE = { column: 'deleted_at', value: null } as const

// Standard pagination
export function toPaginationRange(page: number, perPage: number): { from: number; to: number } {
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  return { from, to }
}
