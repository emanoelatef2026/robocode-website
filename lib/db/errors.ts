// Typed DB error handling utilities

/**
 * Maps PostgreSQL/Supabase error codes and patterns to user-friendly messages.
 * Use in server actions before returning `{ success: false, error }`.
 */
export function friendlyDbError(error: { message: string; code?: string; details?: string }): string {
  const code = error.code ?? ''
  const msg  = error.message ?? ''

  // Unique constraint violation
  if (code === '23505') return 'A record with this value already exists.'
  // FK violation — record being referenced still exists
  if (code === '23503') return 'This record is referenced by other data and cannot be changed.'
  // FK restrict — trying to delete a referenced record
  if (code === '23503' && msg.includes('restrict')) return 'Cannot delete: this record is still referenced by other data.'
  // Not null violation
  if (code === '23502') return 'A required field is missing a value.'
  // Check constraint violation
  if (code === '23514') return 'The provided value is outside the allowed range.'
  // RLS policy violation
  if (code === '42501') return 'You do not have permission to perform this action.'
  // Column does not exist (schema drift)
  if (code === '42703') return 'A database schema mismatch was detected. Please contact support.'
  // Relation does not exist
  if (code === '42P01') return 'A required database table is missing. Please contact support.'
  // Serialization failure (concurrent transaction conflict)
  if (code === '40001') return 'A concurrent update conflict occurred. Please try again.'
  // Timeout
  if (code === '57014') return 'The database request timed out. Please try again.'

  // Supabase-level messages
  if (msg.includes('JWT')) return 'Your session has expired. Please log in again.'
  if (msg.includes('duplicate key')) return 'A record with this value already exists.'
  if (msg.includes('violates foreign key')) return 'This record is referenced by other data.'

  // Generic fallback — include original message for admin-level users
  return msg || 'An unexpected database error occurred.'
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly detail?: string
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
}

export class NotFoundError extends DatabaseError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class ForbiddenError extends DatabaseError {
  constructor(action: string) {
    super(`Forbidden: ${action}`, 'FORBIDDEN')
    this.name = 'ForbiddenError'
  }
}

// Convert Supabase PostgrestError to DatabaseError
export function fromPostgrestError(error: { message: string; code?: string; details?: string }): DatabaseError {
  // RLS policy violation
  if (error.code === '42501') {
    return new ForbiddenError('insufficient permissions for this operation')
  }
  // Unique violation
  if (error.code === '23505') {
    return new DatabaseError('A record with this value already exists', 'DUPLICATE', error.details)
  }
  // Foreign key violation
  if (error.code === '23503') {
    return new DatabaseError('Referenced record does not exist', 'FOREIGN_KEY', error.details)
  }
  return new DatabaseError(error.message, error.code, error.details)
}
