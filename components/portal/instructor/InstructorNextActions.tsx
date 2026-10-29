import Link from 'next/link'
import type { TeachingTasks } from '@/modules/instructor-portal/task-queries'
import type { TodaySession } from '@/modules/instructor-portal/types'
import SessionIcon from '@/app/portal/instructor/groups/[id]/sessions/[sid]/SessionIcon'
import WorkflowNotice from './WorkflowNotice'

export default function InstructorNextActions({ tasks, today, pendingReviews, unavailable }: { tasks: TeachingTasks; today: TodaySession[]; pendingReviews: number; unavailable: boolean }) {
  const upcoming = today.filter(s => s.status === 'scheduled').slice(0, 2)
  const hasWork = tasks.ongoing.length + tasks.reviews.length + upcoming.length + pendingReviews > 0
  return <section aria-label="Your next steps" className="ds-card my-4 p-4 md:p-5">
    <h2 className="flex items-center gap-2 text-lg font-bold text-(--navy)"><SessionIcon name="attendance" />Your next steps</h2>
    <p className="mt-1 text-sm text-(--text-2)">Continue open classes first, then check today’s classes and reviews.</p>
    {unavailable && <WorkflowNotice tone="warning">We could not load all class tasks. Open My Groups to check your classes.</WorkflowNotice>}
    <div className="mt-3 divide-y divide-(--border-soft)">
      {tasks.ongoing.map(s => <Action key={s.sessionId} title={s.groupName} detail="You are the lead · Class still open" label="Continue my class" href={`/portal/instructor/groups/${s.groupId}/sessions/${s.sessionId}`} icon="play" />)}
      {upcoming.map(s => <Action key={s.id} title={s.group_name} detail={new Date(s.scheduled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' }) + ' · Today'} label="Open class" href={s.session_type === 'trial' || s.session_type === 'makeup' ? `/portal/instructor/special-sessions/${s.id}` : `/portal/instructor/groups/${s.group_id}`} icon="late" />)}
      {tasks.reviews.slice(0, 4).map(s => <Action key={s.sessionId} title={s.groupName} detail="Assistant changes waiting for your review" label="Review changes" href={`/portal/instructor/groups/${s.groupId}/sessions/${s.sessionId}#change-requests`} icon="notes" />)}
      {tasks.reviews.length > 4 && <Link href="/portal/instructor/review" className="inline-flex min-h-11 items-center text-sm font-semibold text-(--cyan-strong)">View more assistant changes</Link>}
      {pendingReviews > 0 && <Action title="Student work" detail="Homework and projects waiting for feedback" label="Start reviewing" href="/portal/instructor/review" icon="homework" />}
    </div>
    {!unavailable && !hasWork && <p className="mt-3 text-sm font-medium text-(--green-dark)">You’re up to date. Check My Groups for your next class.</p>}
    <Link href="/portal/instructor/groups" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-(--cyan-strong)">View my groups<SessionIcon name="arrow" /></Link>
  </section>
}

function Action({ title, detail, label, href, icon }: { title: string; detail: string; label: string; href: string; icon: 'play' | 'late' | 'notes' | 'homework' }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 py-3"><div className="flex min-w-0 items-center gap-3"><span className="rounded-lg bg-(--bg-muted) p-2 text-(--cyan-strong)"><SessionIcon name={icon} /></span><div className="min-w-0"><p className="break-words text-sm font-semibold text-(--navy)">{title}</p><p className="mt-1 text-xs font-medium text-(--text-2)">{detail}</p></div></div><Link href={href} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-(--border) px-3 text-sm font-semibold text-(--navy) hover:bg-(--bg-muted)">{label}<SessionIcon name="arrow" /></Link></div>
}
