import type { ScheduleStatus } from '@/types/enums'

// ── Canonical session status groups ───────────────────────────────────────────
//
// Every place that computes "sessions done", instructor progress, package
// consumption, or group completion MUST derive from these constants.
// No hardcoded status arrays elsewhere in the codebase.
//
// Consuming: session was academically delivered.  Counts toward progress,
// package usage, instructor allocation progress, and attendance analytics.
//
// Non-consuming: session was not delivered.  Session number is immutable
// (timeline marker) but the session does NOT advance any counters.
//
// Note: makeup sessions that have been delivered are recorded with
// status='completed' and a makeup_of_session_nr pointer — they are therefore
// in ACADEMICALLY_CONSUMING_SESSION_STATUSES already.

export const ACADEMICALLY_CONSUMING_SESSION_STATUSES: ReadonlySet<ScheduleStatus> =
  new Set<ScheduleStatus>(['completed'])

export const NON_CONSUMING_SESSION_STATUSES: ReadonlySet<ScheduleStatus> =
  new Set<ScheduleStatus>([
    'cancelled',
    'cancelled_with_makeup',
    'postponed',
    'scheduled',
    'ongoing',
  ])

// ── Topic integrity helpers ───────────────────────────────────────────────────
//
// Every academically consuming session MUST have a valid topic.
// "No topic", empty strings, and null are all rejected.
// Use validateAcademicTopic() at every write boundary.

const INVALID_TOPIC_MARKERS = new Set(['no topic', 'none', 'n/a', '-'])

/**
 * Returns the trimmed topic string if valid, or null if the value should be
 * rejected (empty, whitespace-only, or a known placeholder like "No topic").
 */
export function validateAcademicTopic(raw: string | null | undefined): string | null {
  if (!raw) return null
  const t = raw.trim()
  if (t.length === 0) return null
  if (INVALID_TOPIC_MARKERS.has(t.toLowerCase())) return null
  return t
}
