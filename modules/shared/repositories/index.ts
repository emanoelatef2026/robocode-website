/**
 * Repository foundation helpers.
 *
 * These are thin wrappers over Supabase query patterns that enforce consistent
 * pagination, error handling, and result shapes across all modules.
 *
 * Usage:
 *   import { paginate, requireRow, buildRangeClause } from '@/modules/shared/repositories'
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaginatedResult } from '@/modules/shared/types'

// ── Pagination ────────────────────────────────────────────────────────────────

/**
 * Convert page/perPage to Supabase range offsets.
 * Both from and to are inclusive.
 */
export function buildRangeClause(page: number, perPage: number): { from: number; to: number } {
  const from = (page - 1) * perPage
  const to   = from + perPage - 1
  return { from, to }
}

/**
 * Wrap a Supabase query result (with `.count`) into a typed `PaginatedResult<T>`.
 *
 * Example:
 *   const { data, count, error } = await db.from('students').select('*', { count: 'exact' }).range(from, to)
 *   return toPaginatedResult(data, count, page, perPage)
 */
export function toPaginatedResult<T>(
  data: T[] | null,
  count: number | null,
  page: number,
  perPage: number,
): PaginatedResult<T> {
  const total      = count ?? 0
  const totalPages = perPage > 0 ? Math.ceil(total / perPage) : 0
  return { data: data ?? [], total, page, perPage, totalPages }
}

// ── Row guards ────────────────────────────────────────────────────────────────

/**
 * Assert a row was found, or throw a typed error.
 * Use when a `.single()` query's `.data` may be null.
 */
export function requireRow<T>(
  data: T | null,
  entity: string,
  id: string,
): asserts data is T {
  if (data === null) {
    throw new RepositoryError(`${entity} not found`, 'NOT_FOUND', { id })
  }
}

// ── Error ─────────────────────────────────────────────────────────────────────

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'DB_ERROR' | 'CONFLICT' | 'FORBIDDEN',
    public readonly context?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'RepositoryError'
  }
}

/** Convert a RepositoryError (or unknown throw) into an ActionResult-compatible error. */
export function toActionError(err: unknown): { code: string; message: string } {
  if (err instanceof RepositoryError) {
    return { code: err.code, message: err.message }
  }
  if (err instanceof Error) {
    return { code: 'INTERNAL', message: err.message }
  }
  return { code: 'INTERNAL', message: 'An unexpected error occurred.' }
}

// ── Query helpers ─────────────────────────────────────────────────────────────

/**
 * Apply a text search filter to a Supabase query using PostgREST `ilike`.
 * Returns the query unchanged when `search` is empty/undefined.
 */
export function applySearch<Q extends { ilike: (col: string, pattern: string) => Q }>(
  query: Q,
  search: string | undefined,
  column: string,
): Q {
  if (!search?.trim()) return query
  return query.ilike(column, `%${search.trim()}%`)
}

/**
 * Apply an optional equality filter.
 * Returns the query unchanged when `value` is empty/undefined.
 */
export function applyEqFilter<Q extends { eq: (col: string, val: string) => Q }>(
  query: Q,
  column: string,
  value: string | undefined,
): Q {
  if (!value) return query
  return query.eq(column, value)
}

// ── BaseRepository ────────────────────────────────────────────────────────────

/**
 * Thin base class for table-scoped repositories.
 *
 * Extend this to add domain-specific query methods while inheriting
 * consistent pagination and error patterns.
 *
 * Example:
 *   class StudentsRepository extends BaseRepository<'students'> {
 *     constructor(db: SupabaseClient) { super(db, 'students') }
 *   }
 */
export class BaseRepository<TableName extends string> {
  constructor(
    protected readonly db: SupabaseClient,
    protected readonly table: TableName,
  ) {}

  protected from() {
    return this.db.from(this.table as string)
  }

  async findById(id: string) {
    const { data, error } = await this.from()
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new RepositoryError(error.message, 'DB_ERROR', { id })
    return data
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.from()
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw new RepositoryError(error.message, 'DB_ERROR', { id })
  }
}
