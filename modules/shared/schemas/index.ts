/**
 * Shared Zod schemas for common input shapes.
 * Re-exports schemas/common.ts primitives and adds module-level helpers.
 *
 * Import from here so all modules share a single definition:
 *   import { PaginationSchema, MoneySchema } from '@/modules/shared/schemas'
 */

import { z } from 'zod'

// ── Re-export foundation primitives ────────────────────────────────────────────

export {
  UUIDSchema,
  PaginationSchema,
  DateRangeSchema,
  BranchIdSchema,
  type PaginationInput,
  type DateRangeInput,
} from '@/schemas/common'

// ── UUID helpers ───────────────────────────────────────────────────────────────

/** Optional UUID field — empty string resolves to undefined. */
export const OptionalUUIDSchema = z.string().uuid().optional().or(z.literal(''))

/** Array of UUID strings (min 1). */
export const UUIDArraySchema = z.array(z.string().uuid()).min(1)

// ── Money ─────────────────────────────────────────────────────────────────────

/** Non-negative monetary amount (EGP). */
export const MoneySchema = z
  .number({ error: 'Amount must be a number' })
  .nonnegative('Amount must be 0 or greater')
  .multipleOf(0.01, 'Amount must have at most 2 decimal places')

/** Money from a string input (form fields). */
export const MoneyStringSchema = z.coerce
  .number({ error: 'Amount must be a number' })
  .nonnegative('Amount must be 0 or greater')

// ── Filters ───────────────────────────────────────────────────────────────────

/** Generic list-query filter shape. */
export const ListFiltersSchema = z.object({
  search:   z.string().max(200).optional(),
  branchId: z.string().uuid().optional().or(z.literal('')),
  status:   z.string().optional(),
  page:     z.coerce.number().int().min(1).default(1),
  perPage:  z.coerce.number().int().min(1).max(100).default(20),
})

export type ListFiltersInput = z.infer<typeof ListFiltersSchema>

/** Date filter params (string ISO dates from query string). */
export const DateFilterSchema = z.object({
  from: z.string().datetime({ offset: true }).optional().or(z.literal('')),
  to:   z.string().datetime({ offset: true }).optional().or(z.literal('')),
})

export type DateFilterInput = z.infer<typeof DateFilterSchema>

// ── Status filters ────────────────────────────────────────────────────────────

/** Student status enum for filter/validation. */
export const StudentStatusSchema = z.enum([
  'active', 'inactive', 'graduated', 'paused', 'banned',
])

/** Group status enum for filter/validation. */
export const GroupStatusSchema = z.enum([
  'forming', 'active', 'completed', 'cancelled',
])

/** Generic active/inactive status. */
export const ActiveStatusSchema = z.enum(['active', 'inactive'])

// ── Search params ─────────────────────────────────────────────────────────────

/** URL search params shape for paginated list pages. */
export const SearchParamsSchema = z.object({
  q:        z.string().max(200).optional(),
  page:     z.coerce.number().int().min(1).default(1),
  perPage:  z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().uuid().optional().or(z.literal('')),
  status:   z.string().optional(),
  from:     z.string().optional(),
  to:       z.string().optional(),
})

export type SearchParamsInput = z.infer<typeof SearchParamsSchema>
