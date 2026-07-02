import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

type DB = ReturnType<typeof createServiceClient>

const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

// Fills the schedules table forward for a group_course, from its most recent
// non-cancelled session (or the group's start_date) up to total_sessions,
// stepping weekly on the group's day_of_week/time. Skips silently when the
// group has no day_of_week/time set, or the plan is open-ended/unbounded —
// those groups still rely on manual "Add Session" entries.
export async function generateGroupSchedules(
  db:              DB,
  groupId:         string,
  groupCourseId:   string,
  totalSessions:   number | null,
  createdBy:       string | null,
): Promise<void> {
  if (!totalSessions || totalSessions <= 0) return

  // Note: only select columns guaranteed to exist on `groups` — duration_minutes/
  // meeting_link/end_date come from an optional migration that isn't applied on
  // every environment (see group-crud.ts's STABLE-column retry for the same reason).
  const { data: group } = await db
    .from('groups')
    .select('branch_id, day_of_week, time, start_date')
    .eq('id', groupId)
    .single()

  if (!group || !group.day_of_week || !group.time) return

  const dayIndex = DAY_INDEX[group.day_of_week as string]
  if (dayIndex === undefined) return

  const [hours, minutes] = (group.time as string).split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return

  const { data: existing } = await db
    .from('schedules')
    .select('scheduled_at')
    .eq('group_course_id', groupCourseId)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: false })

  const existingCount = existing?.length ?? 0
  const remaining = totalSessions - existingCount
  if (remaining <= 0) return

  const anchor = existing?.[0]?.scheduled_at
    ? new Date(existing[0].scheduled_at as string)
    : group.start_date
      ? new Date(`${group.start_date}T00:00:00`)
      : new Date()

  const next = new Date(anchor)
  next.setHours(hours, minutes, 0, 0)
  if (existing?.[0]?.scheduled_at) {
    // Step past the last known session onto the next matching weekday.
    next.setDate(next.getDate() + 7)
  } else {
    // Roll forward to the first occurrence of the group's weekday on/after the anchor.
    const delta = (dayIndex - next.getDay() + 7) % 7
    next.setDate(next.getDate() + delta)
  }

  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < remaining; i++) {
    rows.push({
      group_course_id:  groupCourseId,
      branch_id:        group.branch_id,
      scheduled_at:     new Date(next).toISOString(),
      duration_minutes: 90,
      type:             'regular',
      delivery:         'offline',
      status:           'scheduled',
      created_by:       createdBy,
    })
    next.setDate(next.getDate() + 7)
  }

  if (rows.length) {
    await db.from('schedules').insert(rows)
  }
}
