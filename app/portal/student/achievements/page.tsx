import { requirePortalRole } from '@/modules/rbac/guards'
import { getOwnPortfolioDetail } from '@/modules/portfolio/queries'
import { getOwnCertificates } from '@/modules/certificates/queries'
import { createServiceClient } from '@/lib/supabase/service'
import { getStudentCompetitions } from '@/modules/student-competitions/queries'
import EmptyState from '@/components/admin/EmptyState'
import Link from 'next/link'
import { getStudentGameProfile } from '@/modules/gamification/xp-service'
import { xpMilestone } from '@/modules/gamification/progress'

const ACHIEVEMENT_ICON: Record<string, string> = {
  project:     '🎨',
  competition: '🎖️',
  certificate: '📜',
  leadership:  '👑',
  attendance:  '✅',
  innovation:  '🚀',
  milestone:   '🌟',
  custom:      '🏅',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function StudentAchievementsPage() {
  const user = await requirePortalRole('student')

  const db = createServiceClient()
  const { data: studentRow } = await db
    .from('students').select('id').eq('user_id', user.id).maybeSingle()
  const studentId = (studentRow as any)?.id ?? null

  const [portfolioDetail, certificates, competitions, gameProfile] = await Promise.all([
    getOwnPortfolioDetail(user.id),
    getOwnCertificates(user.id),
    studentId ? getStudentCompetitions(studentId) : Promise.resolve([]),
    studentId ? getStudentGameProfile(studentId) : Promise.resolve(null),
  ])

  const achievements = portfolioDetail?.achievements ?? []
  const badges        = portfolioDetail?.badges ?? []
  const competitionAwards = competitions.filter(c => c.rank || c.award)

  const totalUnlocked = achievements.length + badges.length
  const nextLevel = xpMilestone(gameProfile?.totalXp ?? 0)
  const nextStreakBadge = (gameProfile?.bestStreak ?? 0) < 7 ? 7 : (gameProfile?.bestStreak ?? 0) < 30 ? 30 : null

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-base font-bold text-[#0B1F3A]">Achievements</h1>
        <p className="mt-0.5 text-[12.5px] text-[#64748B]">Badges, milestones and awards you&apos;ve earned along the way.</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="ds-card p-3 text-center">
          <p className="text-[20px] font-extrabold text-[#0B1F3A]">{totalUnlocked}</p>
          <p className="text-[11px] font-semibold text-[#64748B]">Unlocked</p>
        </div>
        <div className="ds-card p-3 text-center">
          <p className="text-[20px] font-extrabold text-[#0B1F3A]">{certificates.length}</p>
          <p className="text-[11px] font-semibold text-[#64748B]">Certificates</p>
        </div>
        <div className="ds-card p-3 text-center">
          <p className="text-[20px] font-extrabold text-[#0B1F3A]">{competitionAwards.length}</p>
          <p className="text-[11px] font-semibold text-[#64748B]">Competition Awards</p>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#D7E0EA] bg-[#0B1F3A] p-4 text-white">
          <p className="text-sm font-bold text-[#BDECF5]">Next level</p>
          <p className="mt-2 text-2xl font-extrabold">Level {gameProfile?.currentLevel ?? 1}</p>
          <p className="mt-1 text-sm text-white/80">{nextLevel.remaining ? `${nextLevel.remaining.toLocaleString()} XP to Level ${(gameProfile?.currentLevel ?? 1) + 1}` : 'Top level reached'}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-[#FF8A1F]" style={{ width: `${nextLevel.percent}%` }} /></div>
        </div>
        <div className="rounded-2xl border border-[#D7E0EA] bg-white p-4">
          <p className="text-sm font-bold text-[#0B1F3A]">Your consistency</p>
          <p className="mt-2 text-2xl font-extrabold text-[#0B1F3A]">{gameProfile?.currentStreak ?? 0} learning days</p>
          <p className="mt-1 text-sm text-[#475569]">Best streak: {gameProfile?.bestStreak ?? 0} days</p>
          <p className="mt-2 text-xs leading-relaxed text-[#475569]">Recorded attendance or graded work on consecutive days extends your streak. A missed day resets the current streak; your best stays saved.</p>
          {nextStreakBadge && <p className="mt-2 rounded-lg bg-[#FFF7ED] px-3 py-2 text-xs font-bold text-[#9A3412]">{nextStreakBadge - (gameProfile?.bestStreak ?? 0)} more consecutive learning days to the {nextStreakBadge}-day badge.</p>}
        </div>
      </section>

      {/* Badges */}
      <section>
        <h2 className="mb-2 px-0.5 text-[12px] font-bold uppercase tracking-wider text-[#64748B]">Badges</h2>
        {badges.length === 0 ? (
          <EmptyState title="No badges yet" description="Keep learning consistently to unlock your first badge." />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {badges.map(b => (
              <div key={b.id} className="ds-card p-3 text-center">
                <p className="text-[24px] leading-none">{b.badge_name.split(' ')[0]}</p>
                <p className="mt-1.5 text-[12px] font-bold text-[#0B1F3A]">{b.badge_name.replace(/^\S+\s/, '')}</p>
                {b.description && <p className="mt-0.5 text-[11px] text-[#64748B]">{b.description}</p>}
                <p className="mt-1 text-[11px] text-[#94A3B8]">{formatDate(b.awarded_at)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Achievements */}
      <section>
        <h2 className="mb-2 px-0.5 text-[12px] font-bold uppercase tracking-wider text-[#64748B]">Milestones & Achievements</h2>
        {achievements.length === 0 ? (
          <EmptyState title="No achievements yet" description="Complete projects, attend sessions, and grow your XP to unlock achievements." />
        ) : (
          <div className="space-y-2">
            {achievements.map(a => (
              <div key={a.id} className="flex items-center gap-3 ds-card px-3.5 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F8FAFC] text-[18px]">
                  {ACHIEVEMENT_ICON[a.achievement_type] ?? '🏅'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-bold text-[#0B1F3A]">{a.title}</p>
                  {a.description && <p className="mt-0.5 text-[12px] text-[#64748B]">{a.description}</p>}
                </div>
                <span className="shrink-0 text-[11px] text-[#94A3B8]">{formatDate(a.date_awarded)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Competition awards */}
      {competitionAwards.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between px-0.5">
            <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#64748B]">Competition Awards</h2>
            <Link href="/portal/student/competitions" className="text-[12px] font-semibold text-[#FF8A1F] hover:underline">View all →</Link>
          </div>
          <div className="space-y-2">
            {competitionAwards.map(c => (
              <div key={c.id} className="flex items-center gap-3 ds-card px-3.5 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFFBEB] text-[18px]">🎖️</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-bold text-[#0B1F3A]">{c.competition_name}</p>
                  <p className="mt-0.5 text-[12px] text-[#64748B]">{[c.award, c.rank].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="shrink-0 text-[11px] text-[#94A3B8]">{c.year}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Course completion / certificates */}
      <section>
        <div className="mb-2 flex items-center justify-between px-0.5">
          <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#64748B]">Course Completion</h2>
          <Link href="/portal/student/certificates" className="text-[12px] font-semibold text-[#FF8A1F] hover:underline">View certificates →</Link>
        </div>
        {certificates.length === 0 ? (
          <EmptyState title="No certificates yet" description="Finish your enrolled sessions to earn your first certificate." />
        ) : (
          <div className="space-y-2">
            {certificates.slice(0, 5).map(c => (
              <div key={c.id} className="flex items-center gap-3 ds-card px-3.5 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F5F3FF] text-[18px]">📜</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-bold text-[#0B1F3A]">{c.title}</p>
                  <p className="mt-0.5 text-[12px] text-[#64748B]">{c.course_title ?? '—'}</p>
                </div>
                <span className="shrink-0 text-[11px] text-[#94A3B8]">{formatDate(c.issued_at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
