import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { LEVEL_THRESHOLDS, MAX_LEVEL, XP_AWARDS } from './types'
import type { XPProgress, StudentGameProfile } from './types'

// ─── Level math ───────────────────────────────────────────────────────────────

export function calculateLevel(xp: number): number {
  let level = 1
  for (let i = 1; i < MAX_LEVEL; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1
    else break
  }
  return level
}

export function getLevelProgress(xp: number): XPProgress {
  const level       = calculateLevel(xp)
  const levelIdx    = level - 1
  const levelStartXp = LEVEL_THRESHOLDS[levelIdx] ?? 0
  const nextLevelXp  = level < MAX_LEVEL ? (LEVEL_THRESHOLDS[levelIdx + 1] ?? levelStartXp) : levelStartXp
  const currentXp    = xp - levelStartXp
  const levelRange   = nextLevelXp - levelStartXp
  const progressPct  = levelRange > 0 ? Math.min(100, Math.round((currentXp / levelRange) * 100)) : 100

  return { level, totalXp: xp, levelStartXp, nextLevelXp, currentXp, progressPct }
}

// ─── Core XP award ───────────────────────────────────────────────────────────
// Awards XP atomically via the award_xp() Postgres function (migration 0123).
// The SQL function uses a row-level UPDATE lock to prevent lost-update races.
// Fire-and-forget safe: errors are swallowed — XP is never critical path.

export async function awardXP(
  studentId: string,
  amount: number,
  isActivityForStreak = false
): Promise<{ newTotal: number; newLevel: number; leveledUp: boolean }> {
  if (amount <= 0) return { newTotal: 0, newLevel: 1, leveledUp: false }

  const db = createServiceClient()

  const { data } = await db.rpc('award_xp', {
    p_student_id:  studentId,
    p_amount:      amount,
    p_is_activity: isActivityForStreak,
  })

  const row = (data as any)?.[0]
  if (!row) return { newTotal: 0, newLevel: 1, leveledUp: false }

  return {
    newTotal:  Number(row.new_total_xp ?? 0),
    newLevel:  Number(row.new_level    ?? 1),
    leveledUp: Boolean(row.leveled_up),
  }
}

// ─── Fetch student game profile ────────────────────────────────────────────────

export async function getStudentGameProfile(studentId: string): Promise<StudentGameProfile | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('students')
    .select('total_xp, current_level, current_streak, best_streak, last_activity_date')
    .eq('id', studentId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!data) return null
  const r = data as any
  const xp = Number(r.total_xp ?? 0)

  return {
    totalXp:          xp,
    currentLevel:     Number(r.current_level   ?? 1),
    currentStreak:    Number(r.current_streak  ?? 0),
    bestStreak:       Number(r.best_streak     ?? 0),
    lastActivityDate: r.last_activity_date ?? null,
    progress:         getLevelProgress(xp),
  }
}

// Re-export award constants so callers don't need to import types separately
export { XP_AWARDS }
