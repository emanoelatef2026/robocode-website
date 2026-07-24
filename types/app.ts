// App-level composite types — not auto-generated, manually maintained

import type { RoleName } from './enums'

// Resolved user session (after JWT claims are parsed)
export interface AppUser {
  id: string
  email: string
  globalRole: RoleName
  branchIds: string[]
  permissions: string[]
}

// Branch summary used in portal layouts
export interface BranchSummary {
  id: string
  name: string
  slug: string
  type: 'online' | 'offline' | 'hybrid'
  timezone: string
}

// Resolved permission context — injected by portal layout
export interface PermissionContext {
  user: AppUser
  activeBranchId: string | null
  can: (permission: string) => boolean
}

// Pagination params (used across all list queries)
export interface PaginationParams {
  page: number
  perPage: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

// Generic API error shape
export interface AppError {
  code: string
  message: string
  field?: string
  // Structured payload for errors a client needs to act on beyond displaying
  // the message — e.g. AMBIGUOUS_PARENT_MATCH carries ParentMatchCandidate[]
  // so the UI can render a disambiguation picker instead of just failing.
  data?: unknown
}

// Server Action result wrapper
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: AppError }

// Search result shape (cross-entity)
export interface SearchResult {
  entityType: 'student' | 'instructor' | 'parent' | 'group' | 'course' | 'lesson' | 'assignment' | 'announcement' | 'portfolio_project' | 'certificate'
  entityId: string
  title: string
  subtitle?: string
  url: string
  branchId?: string
}

// Notification payload
export interface NotificationPayload {
  type: string
  title: string
  body: string
  data?: Record<string, unknown>
  recipientIds: string[]
  channels: ('in_app' | 'email' | 'sms' | 'push')[]
}
