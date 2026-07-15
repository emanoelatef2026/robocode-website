import { requirePortalRole } from '@/modules/rbac/guards'
import { getInstructorByUserId } from '@/modules/instructor-portal/queries'
import { getUnreadNotificationCount } from '@/modules/notifications/queries'
import InstructorShell from '@/components/portal/instructor/InstructorShell'

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortalRole('instructor')

  // Fetch unread count server-side so the bell badge is populated on first paint.
  // Falls back to 0 on error — non-fatal.
  let unreadNotifications = 0
  try {
    unreadNotifications = await getUnreadNotificationCount(user.id)
  } catch {
    // ignore
  }

  // TODO: Move notification seeding to a scheduled job once background workers are introduced.
  // Seed notifications for sessions starting soon (fire-and-forget, non-blocking).
  void (async () => {
    try {
      const { seedSessionStartingNotification, seedSpecialSessionReminderNotification } = await import('@/modules/notifications/actions')
      const { listInstructorGroups, getInstructorByUserId: getInstructor } = await import('@/modules/instructor-portal/queries')
      const { getTodaySpecialSessions } = await import('@/modules/special-sessions/queries')
      const instructor = await getInstructor(user.id)
      if (instructor) {
        const [groups, todaySessions] = await Promise.all([
          listInstructorGroups(instructor.id),
          getTodaySpecialSessions(instructor.id),
        ])
        await Promise.allSettled([
          ...groups
            .filter((g) => g.next_session_at)
            .map((g) =>
              seedSessionStartingNotification(
                user.id,
                g.group_course_id,
                g.group_name,
                g.next_session_at!,
              )
            ),
          ...todaySessions
            .filter((s) => s.status === 'scheduled' || s.status === 'ongoing')
            .map((s) =>
              seedSpecialSessionReminderNotification(
                user.id,
                s.id,
                s.type,
                s.scheduled_at,
              )
            ),
        ])
      }
    } catch {
      // ignore — notifications are non-critical
    }
  })()

  return (
    <InstructorShell unreadNotifications={unreadNotifications} email={user.email}>
      {children}
    </InstructorShell>
  )
}
