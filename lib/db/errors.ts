// Typed DB error handling utilities

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
