import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { BADGE_DEFS, type BadgeDef } from './types'

// ─── Award a badge (idempotent) ───────────────────────────────────────────────

async function awardBadge(studentId: string, portfolioId: string | null, def: BadgeDef): Promise<boolean> {
  const db = createServiceClient()

  const { data: existing } = await db
    .from('student_badges')
    .select('id')
    .eq('student_id', studentId)
    .eq('badge_name', def.badge_name)
    .maybeSingle()

  if (existing) return false

  await db.from('student_badges').insert({
    student_id:   studentId,
    portfolio_id: portfolioId,
    badge_name:   def.badge_name,
    description:  def.description,
  })

  return true
}

// ─── Check and award all applicable badges ────────────────────────────────────
// Runs all condition checks. Idempotent — safe to call repeatedly.

export async function checkAndAwardBadges(studentId: string): Promise<void> {
  const db = createServiceClient()

  const { data: student } = await db
    .from('students')
    .select('total_xp, current_level, current_streak, best_streak')
    .eq('id', studentId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!student) return
  const s = student as any

  const xp     = Number(s.total_xp      ?? 0)
  const level  = Number(s.current_level ?? 1)
  const streak = Number(s.best_streak   ?? 0)

  // Portfolio id (for badge linking)
  const { data: portRow } = await db
    .from('student_portfolios')
    .select('id')
    .eq('student_id', studentId)
    .maybeSingle()
  const portfolioId = (portRow as any)?.id ?? null

  // Video count
  let videoCount = 0
  if (portfolioId) {
    const { count: vc } = await db
      .from('portfolio_projects')
      .select('id', { count: 'exact', head: true })
      .eq('portfolio_id', portfolioId)
      .not('video_url', 'is', null)
      .eq('is_archived', false)
    videoCount = vc ?? 0
  }

  // Project count
  let projectCount = 0
  if (portfolioId) {
    const { count: pc } = await db
      .from('portfolio_projects')
      .select('id', { count: 'exact', head: true })
      .eq('portfolio_id', portfolioId)
      .eq('is_archived', false)
    projectCount = pc ?? 0
  }

  // Certificate count
  const { count: certCount } = await db
    .from('certificates')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('status', 'active')

  const conditionMet: Record<BadgeDef['condition'], boolean> = {
    level_5:        level  >= 5,
    level_10:       level  >= 10,
    streak_7:       streak >= 7,
    streak_30:      streak >= 30,
    videos_5:       videoCount   >= 5,
    videos_25:      videoCount   >= 25,
    projects_10:    projectCount >= 10,
    xp_1000:        xp     >= 1000,
    xp_5000:        xp     >= 5000,
    certificates_1: (certCount ?? 0) >= 1,
  }

  for (const def of BADGE_DEFS) {
    if (conditionMet[def.condition]) {
      await awardBadge(studentId, portfolioId, def)
    }
  }
}
