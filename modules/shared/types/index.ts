/**
 * Shared primitive types used across modules and components.
 * Import from here to avoid re-defining these shapes inline.
 */

// ── Select / Dropdown ──────────────────────────────────────────────────────────

/** Generic value+label pair for dropdowns, radio groups, and filter selects. */
export interface Option<V extends string = string> {
  value: V
  label: string
  disabled?: boolean
}

/** Option that also carries auxiliary metadata (e.g. branch name on a student chip). */
export interface RichOption<V extends string = string> extends Option<V> {
  subtitle?: string
  meta?: Record<string, unknown>
}

// ── Table ─────────────────────────────────────────────────────────────────────

/** Column descriptor for generic table components. */
export interface TableColumn<T = Record<string, unknown>> {
  key: keyof T | string
  label: string
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (row: T) => React.ReactNode
}

// ── Filters ───────────────────────────────────────────────────────────────────

/** One item in a filter dropdown (extends Option with count support). */
export interface FilterOption extends Option {
  count?: number
}

/** Date range with optional named labels. */
export interface DateRange {
  from: Date | string
  to: Date | string
}

/** Common filter state shape shared by list views. */
export interface ListFilters {
  search?: string
  branchId?: string
  status?: string
  dateRange?: DateRange
  page?: number
  perPage?: number
}

// ── API / Action results ───────────────────────────────────────────────────────

/**
 * Generic API result wrapper for server actions and API routes.
 * Prefer `ActionResult<T>` from types/app.ts for server actions — this is for
 * simpler fetch-style responses.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string }

// ── Pagination ────────────────────────────────────────────────────────────────

/** Cursor-free page-based pagination result. */
export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}
