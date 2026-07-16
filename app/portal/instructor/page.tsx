import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getInstructorByUserId,
  listInstructorGroups,
  listPendingSubmissions,
  getStudentsRequiringAttention,
  getInstructorDashboardStats,
  getTodaySessions,
  getUpcomingSessionsForInstructor,
  getTopStudentsAcrossInstructorGroups,
} from '@/modules/instructor-portal/queries'
import { getInstructorRatingSummary } from '@/modules/feedback/queries'
import type { InstructorRatingSummary } from '@/modules/feedback/types'
import { getUnreadNotificationCount, getNotificationFeed } from '@/modules/notifications/queries'
import { getInstructorPaymentOverview } from '@/modules/instructor-payments/queries'
import { fmtEGP } from '@/modules/instructor-payments/types'
import { listProjectsForInstructorReview } from '@/modules/portfolio/queries'
import Link from 'next/link'
import KpiCard        from '@/components/admin/KpiCard'
import SectionDivider from '@/components/admin/SectionDivider'
import StatusBadge    from '@/components/admin/StatusBadge'
import EmptyState     from '@/components/admin/EmptyState'
import InstructorGroupCard  from '@/components/portal/instructor/InstructorGroupCard'
import TodaySessionCard     from '@/components/portal/instructor/TodaySessionCard'
import InstructorHero       from '@/components/portal/instructor/InstructorHero'
import SectionPreviewCard   from '@/components/portal/student/SectionPreviewCard'

function Chevron() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]">
      <path fillRule="evenodd" d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06L7.28 12.78a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" clipRule="evenodd" />
    </svg>
  )
}

export default async function InstructorDashboardPage() {
  const user = await requirePortalRole('instructor')

  const instructor = await getInstructorByUserId(user.id)
  if (!instructor) {
    return (
      <EmptyState
        title="No instructor record found"
        description="Contact your team leader to link your account."
      />
    )
  }

  const name = [instructor.first_name, instructor.last_name].filter(Boolean).join(' ') || instructor.email

  let groups:         Awaited<ReturnType<typeof listInstructorGroups>>                    = []
  let pending:        Awaited<ReturnType<typeof listPendingSubmissions>>                  = []
  let attention:      Awaited<ReturnType<typeof getStudentsRequiringAttention>>           = []
  let stats:          Awaited<ReturnType<typeof getInstructorDashboardStats>>             = {
    groupCount: 0, studentCount: 0, completedSessions: 0, pendingReviews: 0,
  }
  let todaySessions:    Awaited<ReturnType<typeof getTodaySessions>>                      = []
  let upcomingSessions: Awaited<ReturnType<typeof getUpcomingSessionsForInstructor>>       = []
  let topStudents:      Awaited<ReturnType<typeof getTopStudentsAcrossInstructorGroups>>   = []
  let pendingProjects:  Awaited<ReturnType<typeof listProjectsForInstructorReview>>        = []
  let rating: InstructorRatingSummary | null = null
  let unreadNotifications = 0
  let thisMonthEarnings   = 0
  let notificationFeed: Awaited<ReturnType<typeof getNotificationFeed>> = { notifications: [], unread_count: 0 }

  await Promise.allSettled([
    listInstructorGroups(instructor.id).then((r)               => { groups            = r }),
    listPendingSubmissions(instructor.id, 999).then((r)        => { pending           = r }),
    getStudentsRequiringAttention(instructor.id).then((r)      => { attention         = r }),
    getInstructorDashboardStats(instructor.id).then((r)        => { stats             = r }),
    getTodaySessions(instructor.id).then((r)                   => { todaySessions     = r }),
    getUpcomingSessionsForInstructor(instructor.id, 4).then((r) => { upcomingSessions = r }),
    getTopStudentsAcrossInstructorGroups(instructor.id, 5).then((r) => { topStudents  = r }),
    listProjectsForInstructorReview(instructor.id, 'pending_review').then((r) => { pendingProjects = r }),
    getInstructorRatingSummary(instructor.id).then((r)         => { rating            = r }),
    getUnreadNotificationCount(user.id).then((r)                => { unreadNotifications = r }),
    getNotificationFeed(user.id).then((r)                       => { notificationFeed  = r }),
    getInstructorPaymentOverview(instructor.id, user.id, instructor.branch_id)
      .then((r) => { thisMonthEarnings = r.approved_this_month }),
  ])

  const activeGroups   = groups.filter((g) => !!g.course_title)
  const totalCompleted = groups.reduce((sum, g) => sum + g.completed_sessions, 0)
  const branchName     = groups.find((g) => g.branch_name)?.branch_name ?? null

  // Quick-start: the first actionable session (ongoing → scheduled → any)
  const quickStart =
    todaySessions.find((s) => s.status === 'ongoing') ??
    todaySessions.find((s) => s.status === 'scheduled') ??
    null

  return (
    <div>

      <InstructorHero
        name={name}
        branchName={branchName}
        todaySessionCount={todaySessions.length}
        pendingReviewsCount={pending.length}
        thisMonthEarnings={fmtEGP(thisMonthEarnings)}
        ratingAvg={rating != null ? (rating as InstructorRatingSummary).avg_overall : null}
        ratingCount={rating != null ? (rating as InstructorRatingSummary).total_responses : null}
        quickStart={quickStart}
      />

      {/* ── TODAY'S SESSIONS ─────────────────────────────────────────────── */}
      <SectionDivider title="Today's Sessions" />
      {todaySessions.length === 0 ? (
        <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-6 text-center text-sm text-[#94A3B8]">
          No sessions today 🎉
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {todaySessions.map((s) => (
            <TodaySessionCard key={s.id} session={s} />
          ))}
        </div>
      )}

      {/* ── UPCOMING CLASSES ─────────────────────────────────────────────── */}
      {upcomingSessions.length > 0 && (
        <>
          <SectionDivider title="Upcoming Classes" />
          <div className="overflow-hidden ds-card divide-y divide-[#F1F5F9]">
            {upcomingSessions.map((s) => (
              <Link
                key={s.id}
                href={`/portal/instructor/groups/${s.group_id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-[#F8FAFC] md:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#0B1F3A]">{s.group_name}</p>
                  <p className="truncate text-xs text-[#64748B]">
                    {s.course_title}{' · '}
                    {new Date(s.scheduled_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' · '}
                    {new Date(s.scheduled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <Chevron />
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ── OVERVIEW KPIs ────────────────────────────────────────────────── */}
      <SectionDivider title="Overview" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="This Month Earnings"
          value={fmtEGP(thisMonthEarnings)}
          href="/portal/instructor/payments"
          barColor="#15803D"
          bars={[35, 40, 48, 50, 55, 60, 65]}
        />
        <KpiCard
          label="My Groups"
          value={stats.groupCount}
          href="/portal/instructor/groups"
          barColor="#38BDF8"
          bars={[40, 45, 50, 55, 60, 65, 70]}
        />
        <KpiCard
          label="My Students"
          value={stats.studentCount}
          href="/portal/instructor/students/search"
          barColor="#10B981"
          bars={[55, 60, 62, 65, 68, 72, 78]}
        />
        <KpiCard
          label="Sessions Done"
          value={totalCompleted}
          href="/portal/instructor/history"
          barColor="#6366F1"
          bars={[20, 30, 35, 40, 45, 50, 60]}
        />
        <KpiCard
          label="Pending HW"
          value={pending.length}
          href="/portal/instructor/homework"
          barColor="#F59E0B"
          alert={pending.length > 0}
          bars={[5, 8, 6, 10, 7, 9, 8]}
          delta={pending.length > 0 ? 'Needs review' : undefined}
          deltaUp={false}
        />
        <KpiCard
          label="Notifications"
          value={unreadNotifications}
          href="/portal/instructor"
          barColor="#EF4444"
          alert={unreadNotifications > 0}
          bars={[1, 2, 0, 3, 1, 2, 1]}
          delta={unreadNotifications > 0 ? 'Unread' : undefined}
          deltaUp={false}
        />
      </div>

      {/* ── MY ACTIVE GROUPS ─────────────────────────────────────────────── */}
      {activeGroups.length > 0 && (
        <>
          <SectionDivider title="My Active Groups" />
          <div className="grid gap-3 sm:grid-cols-2">
            {activeGroups.map((g) => (
              <InstructorGroupCard key={g.group_id} g={g} />
            ))}
          </div>
        </>
      )}

      {/* ── TOP STUDENTS + PROJECTS AWAITING REVIEW ─────────────────────────── */}
      {(topStudents.length > 0 || pendingProjects.length > 0) && (
        <>
          <SectionDivider title="Highlights" />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <SectionPreviewCard
              icon="🏆"
              iconBg="bg-[#FFFBEB]"
              title="Top Students"
              hasItems={topStudents.length > 0}
              preview={topStudents.length > 0
                ? topStudents.slice(0, 3).map((s) => s.student_name).join(', ')
                : undefined}
              emptyText="No XP activity yet"
              href="/portal/instructor/groups"
            />
            <SectionPreviewCard
              icon="🎨"
              iconBg="bg-[#EFF6FF]"
              title="Projects Awaiting Review"
              count={pendingProjects.length}
              countLabel="pending"
              hasItems={pendingProjects.length > 0}
              preview={pendingProjects.length > 0
                ? pendingProjects.slice(0, 3).map((p) => p.student_name).join(', ')
                : undefined}
              emptyText="Nothing to review"
              href="/portal/instructor/portfolio"
            />
          </div>
        </>
      )}

      {/* ── PENDING REVIEWS ──────────────────────────────────────────────── */}
      {pending.length > 0 && (
        <>
          <div className="mb-3 mt-7 flex items-center gap-[10px]">
            <span className="whitespace-nowrap text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
              Pending Reviews
            </span>
            <div className="h-px flex-1 bg-[#eef1f6]" />
            <Link
              href="/portal/instructor/homework"
              className="shrink-0 whitespace-nowrap text-[10.5px] font-semibold text-[#FF8A1F] hover:underline"
            >
              View all →
            </Link>
          </div>

          <div className="ds-card divide-y divide-[#F1F5F9]">
            {pending.slice(0, 5).map((s) => (
              <Link
                key={s.submission_id}
                href={`/portal/instructor/homework/${s.submission_id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-[#F8FAFC] md:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#0B1F3A]">{s.student_name}</p>
                  <p className="truncate text-xs text-[#64748B]">{s.assignment_title}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusBadge status={s.status} />
                  {s.is_late && <StatusBadge status="late" />}
                </div>
              </Link>
            ))}
            {pending.length > 5 && (
              <Link
                href="/portal/instructor/homework"
                className="block px-5 py-2.5 text-xs font-semibold text-[#FF8A1F] hover:underline"
              >
                +{pending.length - 5} more →
              </Link>
            )}
          </div>
        </>
      )}

      {/* ── STUDENTS REQUIRING ATTENTION ─────────────────────────────────── */}
      {attention.length > 0 && (
        <>
          <SectionDivider title="Needs Attention" />
          <div className="ds-card divide-y divide-[#F1F5F9]">
            {attention.map((s) => (
              <Link
                key={`${s.student_id}:${s.group_id}`}
                href={s.href}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-[#F8FAFC] md:px-5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FEE2E2] text-xs font-bold text-[#EF4444]">
                  {s.absence_count}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#0B1F3A]">{s.student_name}</p>
                  <p className="truncate text-xs text-[#64748B]">{s.group_name} · {s.reason}</p>
                </div>
                <Chevron />
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ── RECENT NOTIFICATIONS ─────────────────────────────────────────── */}
      {notificationFeed.notifications.length > 0 && (
        <>
          <SectionDivider title="Recent Notifications" />
          <div className="ds-card divide-y divide-[#F1F5F9]">
            {notificationFeed.notifications.slice(0, 5).map((n) => (
              <Link
                key={n.id}
                href={n.href ?? '/portal/instructor'}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-[#F8FAFC] md:px-5"
              >
                {!n.is_read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF8A1F]" />}
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${n.is_read ? 'text-[#64748B]' : 'font-medium text-[#0B1F3A]'}`}>{n.title}</p>
                  {n.body && <p className="truncate text-xs text-[#94A3B8]">{n.body}</p>}
                </div>
                <span className="shrink-0 text-[10px] text-[#94A3B8]">
                  {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ── EMPTY STATE ──────────────────────────────────────────────────── */}
      {groups.length === 0 && (
        <EmptyState
          title="No groups assigned yet"
          description="Contact your Team Leader to receive group assignments."
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-8 w-8 text-[#94A3B8]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          }
        />
      )}

    </div>
  )
}
