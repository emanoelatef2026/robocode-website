import type { GroupCoreInput, GroupUpdateCore } from './validators'

// Parses a JSON-encoded array of student UUIDs from form data.
export function parseStudentIds(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

// Builds the DB insert payload for a new group.
export function buildGroupInsert(data: GroupCoreInput): Record<string, unknown> {
  const base: Record<string, unknown> = {
    branch_id:   data.branch_id,
    name:        data.name,
    type:        data.type,
    capacity:    data.capacity     ?? null,
    status:      'forming',
    day_of_week: data.day_of_week  ?? null,
    time:        data.start_time   ?? null,
    start_date:  data.start_date   ?? null,
    notes:       data.notes        ?? null,
    robocode_share_percent: data.robocode_share_percent ?? 100,
  }
  if (data.duration_minutes !== undefined) base.duration_minutes = data.duration_minutes
  if (data.end_date)                        base.end_date         = data.end_date
  if (data.meeting_link)                    base.meeting_link     = data.meeting_link
  return base
}

// Builds the DB update payload for an existing group.
export function buildGroupUpdate(data: GroupUpdateCore): Record<string, unknown> {
  const upd: Record<string, unknown> = {
    name:        data.name,
    type:        data.type,
    capacity:    data.capacity    !== undefined ? (data.capacity ?? null) : undefined,
    day_of_week: data.day_of_week ?? null,
    time:        data.start_time  ?? null,
    start_date:  data.start_date  ?? null,
    notes:       data.notes       ?? null,
    end_date:    data.end_date    ?? null,
    meeting_link: data.meeting_link ?? null,
  }
  if ('status' in data && data.status)           upd.status           = data.status
  if (data.duration_minutes !== undefined)        upd.duration_minutes = data.duration_minutes
  if (data.robocode_share_percent !== undefined)  upd.robocode_share_percent = data.robocode_share_percent
  return upd
}

// Returns only defined entries (for safe partial updates).
export function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}
