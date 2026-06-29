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

  // TODO:
  // Move SESSION_STARTING generation to a scheduled job
  // once background workers are introduced.
  //
  // Seed notifications for sessions starting soon (fire-and-forget).
  // We do this in a separate async block so it doesn't block the render.
  void (async () => {
    try {
      const { seedSessionStartingNotification } = await import('@/modules/notifications/actions')
      const { listInstructorGroups, getInstructorByUserId: getInstructor } = await import('@/modules/instructor-portal/queries')
      const instructor = await getInstructor(user.id)
      if (instructor) {
        const groups = await listInstructorGroups(instructor.id)
        await Promise.allSettled(
          groups
            .filter((g) => g.next_session_at)
            .map((g) =>
              seedSessionStartingNotification(
                user.id,
                g.group_course_id,
                g.group_name,
                g.next_session_at!,
              )
            )
        )
      }
    } catch {
      // ignore — notifications are non-critical
    }
  })()

  return (
    <InstructorShell unreadNotifications={unreadNotifications}>
      {children}
    </InstructorShell>
  )
}
