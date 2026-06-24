import { requirePortalRole } from '@/modules/rbac/guards'
import { getStudentDashboardData } from '@/modules/student-portal/queries'
import { getPendingFeedbackSessions } from '@/modules/feedback/queries'
import { createServiceClient } from '@/lib/supabase/service'
import { LEVEL_THRESHOLDS, MAX_LEVEL } from '@/modules/gamification/types'
import Link from 'next/link'
import type { UpcomingHomework, RecentFeedbackItem, StudentDashboardData } from '@/modules/student-portal/types'
import SessionFeedbackWidget from './SessionFeedbackWidget'

// ── Helpers ───────────────────────────────────────────────────────────────────

function ProgressBar({ value, color = '#FF8A1F', bg = '#F1F5F9' }: { value: number; color?: string; bg?: string }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: bg }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

const DAY_LABELS: Record<string, string> = {
  sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
}

function formatTime(t: string | null): string {
  if (!t) return ''
  try {
    const [h, m] = t.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const hour   = h % 12 || 12
    return `${hour}:${m.toString().padStart(2, '0')} ${period}`
  } catch {
    return t
  }
}

function calculateLevel(xp: number): number {
  let level = 1
  for (let i = 1; i < MAX_LEVEL; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1
    else break
  }
  return level
}

// ── Level badge (color-coded per tier) ───────────────────────────────────────

function LevelBadge({ level, size = 'sm' }: { level: number; size?: 'sm' | 'lg' }) {
  const tiers = [
    { min: 1,  max: 3,  bg: 'bg-slate-700',   text: 'text-slate-200',  label: 'Rookie'   },
    { min: 4,  max: 6,  bg: 'bg-blue-600',     text: 'text-blue-100',   label: 'Explorer' },
    { min: 7,  max: 9,  bg: 'bg-violet-600',   text: 'text-violet-100', label: 'Builder'  },
    { min: 10, max: 12, bg: 'bg-amber-500',    text: 'text-amber-100',  label: 'Expert'   },
    { min: 13, max: 15, bg: 'bg-orange-500',   text: 'text-orange-100', label: 'Master'   },
  ]
  const tier = tiers.find(t => level >= t.min && level <= t.max) ?? tiers[0]

  if (size === 'lg') {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${tier.bg}`}>
        <span className="text-xs">⭐</span>
        <span className={`text-[11px] font-bold ${tier.text}`}>Lv.{level} {tier.label}</span>
      </div>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${tier.bg} ${tier.text}`}>
      ⭐ Lv.{level}
    </span>
  )
}

// ── Hero Banner (gradient card — gamification HUD) ────────────────────────────

function HeroBanner({ data }: { data: StudentDashboardData }) {
  const isMaxLevel = data.current_level >= MAX_LEVEL
  const firstName  = data.student_name?.split(' ')[0] ?? 'Student'

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ background: 'linear-gradient(135deg, #0B1F3A 0%, #16304F 60%, #1E3A5F 100%)' }}>
      {/* Subtle background circles */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#FF8A1F]/10" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-[#FFD166]/5" />

      <div className="relative px-4 pb-4 pt-4">
        {/* Name + badge row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-extrabold leading-tight text-white">
              Hey, {firstName}! 👋
            </p>
            {data.group_name && (
              <p className="mt-0.5 truncate text-[10.5px] text-white/45">
                {data.group_name}{data.course_title ? ` · ${data.course_title}` : ''}
              </p>
            )}
          </div>
          <div className="shrink-0">
            {data.is_student_of_week ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-extrabold text-[#0B1F3A]">
                🏆 Star of the Week!
              </span>
            ) : (
              <LevelBadge level={data.current_level} size="sm" />
            )}
          </div>
        </div>

        {/* XP section */}
        <div className="mt-4">
          <div className="mb-2 flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-[28px] font-extrabold leading-none text-white"
                style={{ fontFamily: 'var(--font-orbitron)' }}
              >
                {data.total_xp.toLocaleString()}
              </span>
              <span className="text-[12px] font-semibold text-white/50">XP</span>
            </div>
            <span className="text-[10.5px] text-white/50">
              {isMaxLevel
                ? '🏆 Max Level!'
                : `${data.xp_to_next_level.toLocaleString()} XP → Lv.${data.current_level + 1}`}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{
                width: `${data.xp_progress_pct}%`,
                background: 'linear-gradient(90deg, #FF8A1F 0%, #FFD166 100%)',
              }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[9.5px] text-white/35">Level {data.current_level}</span>
            <span className="text-[9.5px] text-white/35">
              {isMaxLevel ? 'MAX' : `Level ${data.current_level + 1}`}
            </span>
          </div>
        </div>

        {/* Stat chips row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Streak */}
          <div className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-[5px]">
            <span className="text-[14px]">🔥</span>
            <span className="text-[11px] font-bold text-white">{data.current_streak}</span>
            <span className="text-[9px] text-white/50">day streak</span>
          </div>

          {/* Group rank */}
          {data.group_rank != null && (
            <div className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-[5px]">
              <span className="text-[14px]">{data.group_rank === 1 ? '🥇' : data.group_rank === 2 ? '🥈' : data.group_rank === 3 ? '🥉' : '🏆'}</span>
              <span className="text-[11px] font-bold text-white">#{data.group_rank}</span>
              <span className="text-[9px] text-white/50">in group</span>
            </div>
          )}

          {/* Achievements */}
          {data.achievement_count > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-[5px]">
              <span className="text-[14px]">🏅</span>
              <span className="text-[11px] font-bold text-white">{data.achievement_count}</span>
              <span className="text-[9px] text-white/50">badges</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Session Progress Card ─────────────────────────────────────────────────────

function SessionCard({
  data,
  sessionPct,
  nextClassLabel,
}: {
  data: StudentDashboardData
  sessionPct: number
  nextClassLabel: string | null
}) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white px-3.5 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Sessions</p>
        <span className="rounded-full bg-[#FFF1E2] px-2 py-0.5 text-[10px] font-bold text-[#FF8A1F]">
          {sessionPct}%
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-[22px] font-extrabold leading-none text-[#0B1F3A]">
          {data.consumed_sessions}
        </span>
        <span className="text-[12px] text-[#64748B]">/ {data.enrolled_sessions} sessions</span>
        {data.enrolled_sessions === 0 ? (
          <span className="text-[10px] text-[#94A3B8]">No active package</span>
        ) : data.remaining_sessions > 0 ? (
          <span className="text-[10px] text-[#94A3B8]">{data.remaining_sessions} left</span>
        ) : null}
      </div>
      <div className="mt-1.5">
        <ProgressBar value={sessionPct} />
      </div>
      {nextClassLabel && (
        <p className="mt-1.5 text-[11px] text-[#64748B]">
          Next class: <span className="font-bold text-[#0B1F3A]">{nextClassLabel}</span>
        </p>
      )}
    </div>
  )
}

// ── Colored stat card ─────────────────────────────────────────────────────────

interface StatCardProps {
  label:   string
  emoji:   string
  value:   string
  sub:     string
  href?:   string
  bgFrom:  string
  bgTo:    string
  textColor: string
  subColor:  string
}

function StatCard({ label, emoji, value, sub, href, bgFrom, bgTo, textColor, subColor }: StatCardProps) {
  const inner = (
    <div
      className="relative overflow-hidden rounded-2xl p-3 h-full"
      style={{ background: `linear-gradient(135deg, ${bgFrom} 0%, ${bgTo} 100%)` }}
    >
      <div className="flex items-center justify-between">
        <p className={`text-[9.5px] font-bold uppercase tracking-wider ${subColor}`}>{label}</p>
        <span className="text-[18px]">{emoji}</span>
      </div>
      <p className={`mt-1.5 text-[22px] font-extrabold leading-none ${textColor}`}>{value}</p>
      <p className={`mt-0.5 text-[10px] font-medium ${subColor}`}>{sub}</p>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block transition active:scale-[0.97]">
        {inner}
      </Link>
    )
  }
  return inner
}

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

// ── Achievements mini-card ────────────────────────────────────────────────────

function AchievementsMini({ achievement_count, badge_count, certificates_count }: {
  achievement_count: number; badge_count: number; certificates_count: number
}) {
  const total = achievement_count + badge_count
  if (total === 0 && certificates_count === 0) return null

  return (
    <div className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-white px-3.5 py-2.5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-xl">
          🏅
        </div>
        <div>
          <p className="text-[12px] font-bold text-[#0B1F3A]">Your Achievements</p>
          <p className="text-[10px] text-[#64748B]">
            {achievement_count} unlocked · {badge_count} badge{badge_count !== 1 ? 's' : ''} · {certificates_count} cert{certificates_count !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      <span className="text-[10px] text-[#FF8A1F]">→</span>
    </div>
  )
}

// ── Next Actions / Missions ───────────────────────────────────────────────────

function deriveNextActions(data: StudentDashboardData): Array<{ label: string; href: string; kind: string }> {
  const actions: Array<{ label: string; href: string; kind: string }> = []

  if (!data.group_id) {
    actions.push({ label: 'Contact your admin to join a group', href: '#', kind: 'info' })
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
    homework:    { icon: '📝', bg: 'bg-amber-50',   text: 'text-amber-700'   },
    session:     { icon: '🏃', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    portfolio:   { icon: '🎨', bg: 'bg-purple-50',  text: 'text-purple-700'  },
    certificate: { icon: '🏆', bg: 'bg-amber-50',   text: 'text-amber-700'   },
    xp:          { icon: '⭐', bg: 'bg-blue-50',    text: 'text-blue-700'    },
    info:        { icon: 'ℹ️', bg: 'bg-slate-50',   text: 'text-slate-600'   },
  }

  return (
    <section>
      <h2 className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
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
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#0B1F3A]">Upcoming Homework</p>
        <Link href="/portal/student/assignments" className="text-xs text-[#FF8A1F] hover:underline">View all →</Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-[#94A3B8]">No pending homework.</p>
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
                <p className={`shrink-0 text-xs ${new Date(hw.due_at) < new Date() ? 'font-semibold text-red-500' : 'text-[#94A3B8]'}`}>
                  Due {new Date(hw.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </p>
              ) : (
                <p className="shrink-0 text-xs text-[#94A3B8]">No due date</p>
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
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <p className="mb-2.5 text-sm font-semibold text-[#0B1F3A]">Recent Feedback</p>
      {items.length === 0 ? (
        <p className="text-sm text-[#94A3B8]">No feedback yet.</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div key={item.submission_id} className="rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-[#0B1F3A]">{item.assignment_title}</p>
                {item.score != null && item.max_score != null && (
                  <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                    {item.score}/{item.max_score}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[#64748B]">{item.public_feedback}</p>
              <p className="mt-1 text-[10px] text-[#94A3B8]">
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

  const [data, feedbackSessions] = await Promise.all([
    getStudentDashboardData(user.id),
    studentId ? getPendingFeedbackSessions(studentId) : Promise.resolve([]),
  ])

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 text-center">
          <p className="text-sm font-medium text-[#0B1F3A]">Account not fully set up yet.</p>
          <p className="mt-1 text-sm text-[#94A3B8]">Contact your administrator.</p>
        </div>
      </div>
    )
  }

  const sessionPct = data.enrolled_sessions > 0
    ? Math.round((data.consumed_sessions / data.enrolled_sessions) * 100)
    : 0
  const notEnrolled   = !data.group_id
  const nextActions   = deriveNextActions(data)

  const nextClassLabel = data.day_of_week
    ? `${DAY_LABELS[data.day_of_week.toLowerCase()] ?? data.day_of_week}${data.group_time ? ` ${formatTime(data.group_time)}` : ''}`
    : null

  return (
    <div className="mx-auto max-w-3xl space-y-3">

      {/* ── Hero gamification banner ─────────────────────────────────────────── */}
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
        <HeroBanner data={data} />
      )}

      {/* ── Session progress ─────────────────────────────────────────────────── */}
      {!notEnrolled && (
        <SessionCard data={data} sessionPct={sessionPct} nextClassLabel={nextClassLabel} />
      )}

      {!notEnrolled && (
        <>
          {/* ── Stats grid (4 colored cards) ─────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard
              label="Attendance"
              emoji="✅"
              value={`${data.att_pct}%`}
              sub={data.att_total > 0 ? `${data.att_present} present · ${data.att_absent} absent` : 'No records yet'}
              href="/portal/student/attendance"
              bgFrom="#F0FDF4"
              bgTo="#DCFCE7"
              textColor="text-emerald-700"
              subColor="text-emerald-600/70"
            />
            <StatCard
              label="Tasks"
              emoji="📋"
              value={data.assignments_total === 0 ? '0' : `${data.assignments_submitted}/${data.assignments_total}`}
              sub={data.assignments_total === 0
                ? 'None yet'
                : data.assignments_graded > 0
                  ? `${data.assignments_graded} graded`
                  : `${data.assignments_submitted} submitted`}
              href="/portal/student/assignments"
              bgFrom="#FFFBEB"
              bgTo="#FEF3C7"
              textColor="text-amber-700"
              subColor="text-amber-600/70"
            />
            <StatCard
              label="Projects"
              emoji="🎨"
              value={String(data.portfolio_projects)}
              sub={data.portfolio_projects === 0 ? 'Add your first!' : `${data.portfolio_reviewed} reviewed`}
              href="/portal/student/portfolio"
              bgFrom="#F5F3FF"
              bgTo="#EDE9FE"
              textColor="text-violet-700"
              subColor="text-violet-600/70"
            />
            <StatCard
              label="Score"
              emoji="📊"
              value={data.overall_pct != null ? `${Math.round(data.overall_pct)}%` : '—'}
              sub={data.overall_pct != null
                ? data.overall_pct >= 75 ? 'Great work! 🌟' : 'Keep going!'
                : 'No grades yet'}
              bgFrom="#EFF6FF"
              bgTo="#DBEAFE"
              textColor="text-blue-700"
              subColor="text-blue-600/70"
            />
          </div>

          {/* ── Achievements mini-card ───────────────────────────────────────── */}
          <AchievementsMini
            achievement_count={data.achievement_count}
            badge_count={data.badge_count}
            certificates_count={data.certificates_count}
          />

          {/* ── Leaderboard CTA ──────────────────────────────────────────────── */}
          {data.group_rank != null && (
            <LeaderboardCTA rank={data.group_rank} total={data.group_rank_total ?? 1} />
          )}

          {/* ── Missions ─────────────────────────────────────────────────────── */}
          <MissionsCard actions={nextActions} />

          {/* ── Session feedback ─────────────────────────────────────────────── */}
          {feedbackSessions.length > 0 && (
            <SessionFeedbackWidget sessions={feedbackSessions} />
          )}

          {/* ── Desktop-only: upcoming + feedback columns ─────────────────────── */}
          <div className="hidden gap-3 md:grid md:grid-cols-2">
            <UpcomingCard items={data.upcoming_homework} />
            <FeedbackCard items={data.recent_feedback} />
          </div>
        </>
      )}
    </div>
  )
}
