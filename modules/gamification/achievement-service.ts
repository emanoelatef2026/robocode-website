import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { logTimelineEvent } from '@/lib/timeline'
import { seedAchievementEarnedNotification } from '@/modules/notifications/actions'
import { getStudentUserId } from '@/modules/notifications/queries'
import { ACHIEVEMENT_DEFS, type AchievementDef } from './types'
import { awardXP } from './xp-service'

// ─── Unlock a single named achievement (idempotent) ───────────────────────────
// Returns true if newly unlocked, false if already existed.

async function unlockAchievement(
  studentId: string,
  portfolioId: string | null,
  def: AchievementDef
): Promise<boolean> {
  const db = createServiceClient()

  // Check if already awarded (by title — titles are canonical per ACHIEVEMENT_DEFS)
  const { data: existing } = await db
    .from('student_achievements')
    .select('id')
    .eq('student_id', studentId)
    .eq('title', def.title)
    .maybeSingle()

  if (existing) return false

  const { data: achievement } = await db
    .from('student_achievements')
    .insert({
      student_id:       studentId,
      portfolio_id:     portfolioId,
      title:            def.title,
      description:      def.description,
      achievement_type: def.type,
      date_awarded:     new Date().toISOString().slice(0, 10),
    })
    .select('id')
    .single()

  // Award bonus XP for unlocking this achievement (if any)
  if (def.xpReward > 0) {
    await awardXP(studentId, def.xpReward, false)
  }

  void logTimelineEvent({
    student_id: studentId,
    event_type: 'ACHIEVEMENT_EARNED',
    notes:      def.title,
  }).catch(() => {})

  try {
    const achievementId = (achievement as any)?.id as string | undefined
    const studentUserId = await getStudentUserId(studentId)
    if (achievementId && studentUserId) await seedAchievementEarnedNotification(studentUserId, achievementId, def.title)
  } catch {
    // non-critical
  }

  return true
}

// ─── Resolve portfolio id (null-safe) ────────────────────────────────────────

export async function resolvePortfolioId(studentId: string): Promise<string | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('student_portfolios')
    .select('id')
    .eq('student_id', studentId)
    .maybeSingle()
  return (data as any)?.id ?? null
}

// ─── Check and unlock all applicable achievements ────────────────────────────
// Designed to be called after any activity that could trigger an achievement.
// Runs ALL checks every time (cheap: at most ~10 DB reads, all indexed).

export async function checkAndUnlockAchievements(studentId: string): Promise<void> {
  const db          = createServiceClient()
  const portfolioId = await resolvePortfolioId(studentId)

  // ── Attendance milestones ─────────────────────────────────────────────────

  const { count: attCount } = await db
    .from('attendance_records')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .in('status', ['present', 'late', 'makeup'])
    .is('invalidated_at', null)

  if ((attCount ?? 0) >= 1) {
    await unlockAchievement(studentId, portfolioId, ACHIEVEMENT_DEFS.find(a => a.title === 'First Attendance')!)
  }

  // ── Assignment milestones ─────────────────────────────────────────────────

  const { count: subCount } = await db
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)

  if ((subCount ?? 0) >= 1) {
    await unlockAchievement(studentId, portfolioId, ACHIEVEMENT_DEFS.find(a => a.title === 'First Assignment')!)
  }

  // ── Portfolio project milestones ──────────────────────────────────────────

  if (portfolioId) {
    const { count: projCount } = await db
      .from('portfolio_projects')
      .select('id', { count: 'exact', head: true })
      .eq('portfolio_id', portfolioId)
      .eq('is_archived', false)

    const pc = projCount ?? 0
    if (pc >= 1)  await unlockAchievement(studentId, portfolioId, ACHIEVEMENT_DEFS.find(a => a.title === 'First Project')!)
    if (pc >= 5)  await unlockAchievement(studentId, portfolioId, ACHIEVEMENT_DEFS.find(a => a.title === '5 Projects')!)
    if (pc >= 10) await unlockAchievement(studentId, portfolioId, ACHIEVEMENT_DEFS.find(a => a.title === '10 Projects')!)

    // Video milestones — projects with a non-null video_url
    const { count: vidCount } = await db
      .from('portfolio_projects')
      .select('id', { count: 'exact', head: true })
      .eq('portfolio_id', portfolioId)
      .eq('is_archived', false)
      .not('video_url', 'is', null)

    const vc = vidCount ?? 0
    if (vc >= 1)  await unlockAchievement(studentId, portfolioId, ACHIEVEMENT_DEFS.find(a => a.title === 'First Video')!)
    if (vc >= 5)  await unlockAchievement(studentId, portfolioId, ACHIEVEMENT_DEFS.find(a => a.title === '5 Videos')!)
    if (vc >= 10) await unlockAchievement(studentId, portfolioId, ACHIEVEMENT_DEFS.find(a => a.title === '10 Videos')!)
    if (vc >= 25) await unlockAchievement(studentId, portfolioId, ACHIEVEMENT_DEFS.find(a => a.title === '25 Videos')!)
  }

  // ── XP milestones ─────────────────────────────────────────────────────────

  const { data: student } = await db
    .from('students')
    .select('total_xp')
    .eq('id', studentId)
    .maybeSingle()
  const xp = Number((student as any)?.total_xp ?? 0)

  if (xp >= 1000)  await unlockAchievement(studentId, portfolioId, ACHIEVEMENT_DEFS.find(a => a.title === '1000 XP')!)
  if (xp >= 5000)  await unlockAchievement(studentId, portfolioId, ACHIEVEMENT_DEFS.find(a => a.title === '5000 XP')!)
  if (xp >= 10000) await unlockAchievement(studentId, portfolioId, ACHIEVEMENT_DEFS.find(a => a.title === '10000 XP')!)

  // ── Certificate milestones ────────────────────────────────────────────────

  const { count: certCount } = await db
    .from('certificates')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('status', 'active')

  if ((certCount ?? 0) >= 1) {
    await unlockAchievement(studentId, portfolioId, ACHIEVEMENT_DEFS.find(a => a.title === 'First Certificate')!)
  }
}

// ─── Course-specific achievement (called after certificate issuance) ──────────
// Unlocks specialization achievements based on certificate course title.

export async function checkCourseAchievement(studentId: string, courseTitle: string | null): Promise<void> {
  if (!courseTitle) return
  const portfolioId = await resolvePortfolioId(studentId)
  const title       = courseTitle.toLowerCase()

  if (title.includes('python'))   await unlockAchievement(studentId, portfolioId, ACHIEVEMENT_DEFS.find(a => a.title === 'Python Explorer')!)
  if (title.includes('ai') || title.includes('artificial intelligence'))
    await unlockAchievement(studentId, portfolioId, ACHIEVEMENT_DEFS.find(a => a.title === 'AI Explorer')!)
  if (title.includes('robot'))    await unlockAchievement(studentId, portfolioId, ACHIEVEMENT_DEFS.find(a => a.title === 'Robotics Builder')!)
  if (title.includes('game'))     await unlockAchievement(studentId, portfolioId, ACHIEVEMENT_DEFS.find(a => a.title === 'Game Developer')!)
}

// ─── Attendance-specific: perfect attendance bonus ────────────────────────────
// Called after a session is recorded. If all students in the session were present/late,
// award each a bonus. This is a lightweight check.

export async function checkPerfectAttendanceAchievement(
  studentId: string,
  scheduleId: string
): Promise<void> {
  const db = createServiceClient()

  // Get total active students in the group for this session
  const { data: schedRow } = await db
    .from('schedules')
    .select('group_course_id, group_courses!schedules_group_course_id_fkey(group_id)')
    .eq('id', scheduleId)
    .maybeSingle()

  const groupId = (schedRow as any)?.group_courses?.group_id
  if (!groupId) return

  const { count: groupSize } = await db
    .from('group_students')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('status', 'active')

  const { count: presentCount } = await db
    .from('attendance_records')
    .select('id', { count: 'exact', head: true })
    .eq('schedule_id', scheduleId)
    .in('status', ['present', 'late', 'makeup'])
    .is('invalidated_at', null)

  if ((groupSize ?? 0) > 0 && presentCount === groupSize) {
    const portfolioId = await resolvePortfolioId(studentId)
    await unlockAchievement(
      studentId,
      portfolioId,
      ACHIEVEMENT_DEFS.find(a => a.title === 'Perfect Attendance')!
    )
  }
}
