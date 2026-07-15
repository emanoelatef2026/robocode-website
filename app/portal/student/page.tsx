import { requirePortalRole } from '@/modules/rbac/guards'
import {
  getStudentDashboardData,
  getStudentLearningCards,
  getStudentProfileHeader,
} from '@/modules/student-portal/queries'
import { getPendingFeedbackSessions } from '@/modules/feedback/queries'
import { getStudentEvaluations } from '@/modules/student-evaluations/queries'
import { EVALUATION_CRITERION_LABELS } from '@/modules/student-evaluations/types'
import { getStudentCompetitions } from '@/modules/student-competitions/queries'
import { getStudentNotes } from '@/modules/student-notes/queries'
import { getStudentTimeline as getTimelineFeed, TIMELINE_EVENT_LABELS } from '@/lib/timeline'
import { createServiceClient } from '@/lib/supabase/service'
import { MAX_LEVEL } from '@/modules/gamification/types'
import Link from 'next/link'
import type { UpcomingHomework, RecentFeedbackItem } from '@/modules/student-portal/types'
import SessionFeedbackWidget from './SessionFeedbackWidget'
import HeroHeader from '@/components/portal/student/HeroHeader'
import LearningCard from '@/components/portal/student/LearningCard'
import QuickStatsGrid, { type QuickStat } from '@/components/portal/student/QuickStatsGrid'
import SectionPreviewCard from '@/components/portal/student/SectionPreviewCard'

// ── Leaderboard CTA ───────────────────────────────────────────────────────────

function LeaderboardCTA({ rank, total }: { rank: number; total: number }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏆'
  return (
    <Link
      href="/portal/student/leaderboard"
      className="flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-gradient-to-r from-[#0B1F3A] to-[#162A48] px-4 py-3 transition active:scale-[0.98]"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{medal}</span>
        <div>
          <p className="text-[12.5px] font-bold text-white">Group Leaderboard</p>
          <p className="text-[10px] text-white/50">You are #{rank} of {total} students</p>
        </div>
      </div>
      <span className="rounded-full bg-[#FF8A1F] px-2.5 py-1 text-[10px] font-bold text-white">View →</span>
    </Link>
  )
}

// ── Quick Actions row ─────────────────────────────────────────────────────────

function QuickActionsRow() {
  const actions = [
    { label: 'Continue Learning', href: '/portal/student/assignments', icon: '📝' },
    { label: 'View Attendance',   href: '/portal/student/attendance',  icon: '✅' },
    { label: 'View Evaluations',  href: '/portal/student/evaluations', icon: '📊' },
    { label: 'View Certificates', href: '/portal/student/certificates',icon: '📜' },
    { label: 'View Competitions', href: '/portal/student/competitions',icon: '🎖️' },
  ]
  return (
    <section>
      <h2 className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
        Quick Actions
      </h2>
      <div className="flex flex-wrap gap-2">
        {actions.map(a => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white px-3.5 py-2 text-[12px] font-semibold text-[#0B1F3A] transition hover:border-[#FF8A1F] active:scale-[0.97]"
          >
            <span>{a.icon}</span>{a.label}
          </Link>
        ))}
      </div>
    </section>
  )
}

// ── Next Actions / Missions ───────────────────────────────────────────────────

function deriveNextActions(data: {
  group_id: string | null
  upcoming_homework: UpcomingHomework[]
  att_total: number
  consumed_sessions: number
  portfolio_projects: number
  total_xp: number
  enrolled_sessions: number
}): Array<{ label: string; href: string; kind: string }> {
  const actions: Array<{ label: string; href: string; kind: string }> = []

  if (!data.group_id) {
    actions.push({ label: 'Contact your admin to join a group', href: '/#branches', kind: 'info' })
    return actions
  }

  for (const hw of data.upcoming_homework.slice(0, 2)) {
    actions.push({ label: `Complete: ${hw.title}`, href: `/portal/student/assignments/${hw.id}`, kind: 'homework' })
  }

  if (data.att_total === 0 && data.consumed_sessions > 0) {
    actions.push({ label: 'Attend your next session to earn XP!', href: '/portal/student/attendance', kind: 'session' })
  }

  if (data.portfolio_projects === 0) {
    actions.push({ label: 'Upload your first project → earn 100 XP', href: '/portal/student/portfolio', kind: 'portfolio' })
  }

  if (data.portfolio_projects > 0 && data.total_xp < 500) {
    actions.push({ label: 'Add a video to your project → earn 150 XP!', href: '/portal/student/portfolio', kind: 'xp' })
  }

  if (data.enrolled_sessions > 0 && data.consumed_sessions >= data.enrolled_sessions) {
    actions.push({ label: 'Claim your certificate! 🎉', href: '/portal/student/certificates', kind: 'certificate' })
  }

  return actions.slice(0, 3)
}

function MissionsCard({ actions }: { actions: Array<{ label: string; href: string; kind: string }> }) {
  if (actions.length === 0) return null

  const config: Record<string, { icon: string; bg: string; text: string }> = {
    homework:    { icon: '📝', bg: 'bg-[#FFFBEB]',   text: 'text-[#B45309]'   },
    session:     { icon: '🏃', bg: 'bg-[#E7F8EE]', text: 'text-[#15803D]' },
    portfolio:   { icon: '🎨', bg: 'bg-purple-50',  text: 'text-purple-700'  },
    certificate: { icon: '🏆', bg: 'bg-[#FFFBEB]',   text: 'text-[#B45309]'   },
    xp:          { icon: '⭐', bg: 'bg-[#EFF6FF]',    text: 'text-[#1D4ED8]'    },
    info:        { icon: 'ℹ️', bg: 'bg-[#F8FAFC]',   text: 'text-[#475569]'   },
  }

  return (
    <section>
      <h2 className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
        🎯 Your Missions
      </h2>
      <div className="space-y-2">
        {actions.map((action, i) => {
          const c = config[action.kind] ?? config.info
          return (
            <Link
              key={i}
              href={action.href}
              className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white px-3.5 py-3 transition hover:border-[#FF8A1F]/40 hover:shadow-sm active:scale-[0.98]"
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[15px] ${c.bg}`}>
                {c.icon}
              </div>
              <p className="flex-1 text-[12.5px] font-medium text-[#0B1F3A]">{action.label}</p>
              <span className="shrink-0 text-[11px] font-bold text-[#FF8A1F]">→</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

// ── Desktop-only secondary cards ──────────────────────────────────────────────

function UpcomingCard({ items }: { items: UpcomingHomework[] }) {
  return (
    <div className="ds-card p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#0B1F3A]">Upcoming Homework</p>
        <Link href="/portal/student/assignments" className="text-xs text-[#FF8A1F] hover:underline">View all →</Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-[#64748B]">No pending homework.</p>
      ) : (
        <div className="space-y-2">
          {items.map((hw) => (
            <Link
              key={hw.id}
              href={`/portal/student/assignments/${hw.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2 transition hover:border-[#FF8A1F]/40"
            >
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#0B1F3A]">{hw.title}</p>
              {hw.due_at ? (
                <p className={`shrink-0 text-xs ${new Date(hw.due_at) < new Date() ? 'font-semibold text-[#EF4444]' : 'text-[#64748B]'}`}>
                  Due {new Date(hw.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </p>
              ) : (
                <p className="shrink-0 text-xs text-[#64748B]">No due date</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function FeedbackCard({ items }: { items: RecentFeedbackItem[] }) {
  return (
    <div className="ds-card p-4">
      <p className="mb-2.5 text-sm font-semibold text-[#0B1F3A]">Recent Feedback</p>
      {items.length === 0 ? (
        <p className="text-sm text-[#64748B]">No feedback yet.</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div key={item.submission_id} className="rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-[#0B1F3A]">{item.assignment_title}</p>
                {item.score != null && item.max_score != null && (
                  <span className="shrink-0 rounded-full bg-[#E7F8EE] px-2 py-0.5 text-xs font-semibold text-[#15803D]">
                    {item.score}/{item.max_score}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[#64748B]">{item.public_feedback}</p>
              <p className="mt-1 text-[10px] text-[#64748B]">
                {new Date(item.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StudentDashboardPage() {
  const user = await requirePortalRole('student')

  const db = createServiceClient()
  const { data: studentRow } = await db
    .from('students').select('id').eq('user_id', user.id).maybeSingle()
  const studentId = (studentRow as any)?.id ?? null

  const [
    data, feedbackSessions, learningCards, profile,
    evaluations, competitions, notes, timeline, completedCoursesCount,
  ] = await Promise.all([
    getStudentDashboardData(user.id),
    studentId ? getPendingFeedbackSessions(studentId) : Promise.resolve([]),
    getStudentLearningCards(user.id),
    getStudentProfileHeader(user.id),
    studentId ? getStudentEvaluations(studentId, 'student') : Promise.resolve([]),
    studentId ? getStudentCompetitions(studentId) : Promise.resolve([]),
    studentId ? getStudentNotes(studentId, { userId: user.id, kind: 'student' }) : Promise.resolve([]),
    studentId ? getTimelineFeed(studentId, null, 5) : Promise.resolve([]),
    studentId
      ? db.from('student_enrollments').select('id', { count: 'exact', head: true })
          .eq('student_id', studentId).eq('status', 'COMPLETED').then(r => r.count ?? 0)
      : Promise.resolve(0),
  ])

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 text-center">
          <p className="text-sm font-medium text-[#0B1F3A]">Account not fully set up yet.</p>
          <p className="mt-1 text-sm text-[#64748B]">Contact your administrator.</p>
        </div>
      </div>
    )
  }

  const notEnrolled = learningCards.length === 0
  const nextActions = deriveNextActions(data)

  const quickStats: QuickStat[] = [
    { label: 'Active Courses', emoji: '📚', value: String(learningCards.length), sub: learningCards.length === 1 ? '1 course' : `${learningCards.length} courses`, href: undefined, bgFrom: '#EFF6FF', bgTo: '#DBEAFE', textColor: 'text-[#1D4ED8]', subColor: 'text-[#2563EB]/70' },
    { label: 'Completed', emoji: '🎓', value: String(completedCoursesCount), sub: completedCoursesCount === 0 ? 'None yet' : 'courses finished', bgFrom: '#F0FDF4', bgTo: '#DCFCE7', textColor: 'text-[#15803D]', subColor: 'text-[#10B981]/70' },
    { label: 'Attendance', emoji: '✅', value: `${data.att_pct}%`, sub: data.att_total > 0 ? `${data.att_present} present` : 'No records yet', href: '/portal/student/attendance', bgFrom: '#FFFBEB', bgTo: '#FEF3C7', textColor: 'text-[#B45309]', subColor: 'text-[#F59E0B]/70' },
    { label: 'Certificates', emoji: '📜', value: String(data.certificates_count), sub: data.certificates_count === 0 ? 'None yet' : 'earned', href: '/portal/student/certificates', bgFrom: '#F5F3FF', bgTo: '#EDE9FE', textColor: 'text-violet-700', subColor: 'text-violet-600/70' },
    { label: 'Competitions', emoji: '🎖️', value: String(competitions.length), sub: competitions.length === 0 ? 'None yet' : 'joined', href: '/portal/student/competitions', bgFrom: '#FFF1E2', bgTo: '#FFE4C7', textColor: 'text-[#B45309]', subColor: 'text-[#FF8A1F]/70' },
    { label: 'Achievements', emoji: '🏅', value: String(data.achievement_count + data.badge_count), sub: 'unlocked', href: '/portal/student/achievements', bgFrom: '#FEF2F2', bgTo: '#FEE2E2', textColor: 'text-[#B91C1C]', subColor: 'text-[#EF4444]/70' },
  ]

  const latestEvaluation = evaluations[0] ?? null
  const latestCompetition = competitions[0] ?? null
  const latestNote = notes[0] ?? null
  const latestTimelineEvent = timeline[0] ?? null

  return (
    <div className="mx-auto max-w-7xl space-y-4">

      {/* ── Section 1: Hero Header ───────────────────────────────────────────── */}
      {notEnrolled ? (
        <div className="overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #162A48 100%)' }}>
          <div className="px-4 py-5">
            <p className="text-[18px] font-extrabold text-white">
              Hey, {data.student_name?.split(' ')[0] ?? 'Student'}! 👋
            </p>
            <p className="mt-1 text-[12px] text-white/50">
              Your dashboard is ready — ask your admin to enroll you in a group to get started!
            </p>
            <Link
              href="/portal/student/assignments"
              className="mt-3 inline-block rounded-full bg-[#FF8A1F] px-3 py-1.5 text-[11px] font-bold text-white"
            >
              View assignments →
            </Link>
          </div>
        </div>
      ) : (
        <HeroHeader
          studentName={data.student_name}
          studentCode={profile?.student_code ?? null}
          branchName={profile?.branch_name ?? null}
          status={profile?.status ?? 'active'}
          totalXp={data.total_xp}
          currentLevel={data.current_level}
          maxLevel={MAX_LEVEL}
          xpProgressPct={data.xp_progress_pct}
          xpToNextLevel={data.xp_to_next_level}
          currentStreak={data.current_streak}
          groupRank={data.group_rank}
          isStudentOfWeek={data.is_student_of_week}
          activeCoursesCount={learningCards.length}
          achievementCount={data.achievement_count}
          badgeCount={data.badge_count}
          certificatesCount={data.certificates_count}
          competitionsCount={competitions.length}
        />
      )}

      {!notEnrolled && (
        <>
          {/* ── Section 2: Current Learning ───────────────────────────────────── */}
          <section>
            <h2 className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
              Current Learning
            </h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {learningCards.map(card => <LearningCard key={card.group_id} data={card} />)}
            </div>
          </section>

          {/* ── Section 9: Quick Statistics ───────────────────────────────────── */}
          <section>
            <h2 className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
              Quick Statistics
            </h2>
            <QuickStatsGrid stats={quickStats} />
          </section>

          {/* ── Leaderboard CTA ──────────────────────────────────────────────── */}
          {data.group_rank != null && (
            <LeaderboardCTA rank={data.group_rank} total={data.group_rank_total ?? 1} />
          )}

          {/* ── Section 10: Quick Actions ─────────────────────────────────────── */}
          <QuickActionsRow />

          {/* ── Sections 3–8 previews: Journey / Achievements / Evaluations / Competitions / Notes / Certificates ── */}
          <section>
            <h2 className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
              Your Progress
            </h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <SectionPreviewCard
                icon="🧭" iconBg="bg-[#EFF6FF]"
                title="Learning Journey"
                hasItems={timeline.length > 0}
                preview={latestTimelineEvent ? `${TIMELINE_EVENT_LABELS[latestTimelineEvent.event_type]} · ${new Date(latestTimelineEvent.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : undefined}
                emptyText="Your milestones will appear here as you learn."
                href="/portal/student/journey"
              />
              <SectionPreviewCard
                icon="🏅" iconBg="bg-purple-50"
                title="Achievements"
                count={data.achievement_count + data.badge_count} countLabel="unlocked"
                hasItems={(data.achievement_count + data.badge_count) > 0}
                preview="Badges, milestones & course completions"
                emptyText="Complete sessions and projects to unlock your first badge."
                href="/portal/student/achievements"
              />
              <SectionPreviewCard
                icon="📊" iconBg="bg-[#E7F8EE]"
                title="Evaluations"
                count={evaluations.length} countLabel="recorded"
                hasItems={evaluations.length > 0}
                preview={latestEvaluation ? `Latest: ${EVALUATION_CRITERION_LABELS[latestEvaluation.criterion]}` : undefined}
                emptyText="Your instructor's evaluations will appear here."
                href="/portal/student/evaluations"
              />
              <SectionPreviewCard
                icon="🎖️" iconBg="bg-[#FFFBEB]"
                title="Competitions"
                count={competitions.length} countLabel="joined"
                hasItems={competitions.length > 0}
                preview={latestCompetition ? `${latestCompetition.competition_name} · ${latestCompetition.year}` : undefined}
                emptyText="No competitions yet — ask your team leader about upcoming events."
                href="/portal/student/competitions"
              />
              <SectionPreviewCard
                icon="📌" iconBg="bg-[#FFF1E2]"
                title="Notes & Instructions"
                count={notes.length} countLabel="from staff"
                hasItems={notes.length > 0}
                preview={latestNote ? latestNote.content.slice(0, 60) : undefined}
                emptyText="Notes and instructions shared by your instructor will appear here."
                href="/portal/student/notes"
              />
              <SectionPreviewCard
                icon="📜" iconBg="bg-[#F5F3FF]"
                title="Certificates"
                count={data.certificates_count} countLabel="earned"
                hasItems={data.certificates_count > 0}
                preview="View and download your certificates"
                emptyText="Complete your sessions to earn your first certificate."
                href="/portal/student/certificates"
              />
            </div>
          </section>

          {/* ── Missions ─────────────────────────────────────────────────────── */}
          <MissionsCard actions={nextActions} />

          {/* ── Session feedback ─────────────────────────────────────────────── */}
          {feedbackSessions.length > 0 && (
            <SessionFeedbackWidget sessions={feedbackSessions} />
          )}

          {/* ── Upcoming homework + recent feedback ───────────────────────────── */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <UpcomingCard items={data.upcoming_homework} />
            <FeedbackCard items={data.recent_feedback} />
          </div>
        </>
      )}
    </div>
  )
}
